module OperatorAgent
  # Runs a single message through the LLM with tool calling.
  #
  # Pipeline:
  # 1. The user message is already persisted by the controller.
  # 2. Load previous messages from the thread (chronological).
  # 3. Build an Agents::Agent with the registered tool set.
  # 4. Run the LLM (RubyLLM.chat under the hood) with max 6 turns.
  # 5. If the final response is a pending_action, persist a
  #    OperatorAgent::PendingAction row and tell the LLM to
  #    ask the operator to confirm. No more LLM calls this turn.
  # 6. If the response is normal text, persist it as the assistant
  #    message and audit every tool call.
  #
  # The LLM provider is whatever is configured via the env-only
  # Llm::AccountProviderResolver / Agents.configure — i.e. whatever
  # CAPTAIN_OPEN_AI_* env vars are set in Railway.
  class Executor
    MAX_TURNS = 6

    def initialize(thread:, user_message:, confirmed_action_id: nil)
      @thread = thread
      @account = thread.account
      @user = thread.user
      @user_message = user_message
      @confirmed_action_id = confirmed_action_id
    end

    def perform
      history = load_message_history

      result = run_with_tools(history)
      tool_calls = result[:tool_calls] || []

      assistant_msg = persist_assistant_response(result, tool_calls)
      drain_pending_queue(assistant_msg)
      mark_pending_actions_in_message(assistant_msg) if result[:pending_action].present?

      audit_tool_calls(tool_calls)
      assistant_msg
    rescue StandardError => e
      ChatwootExceptionTracker.new(e, account: @account).capture_exception
      Rails.logger.error "[OperatorAgent::Executor] error: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")

      raise
    end

    private

    def load_message_history
      @thread.messages.ordered.map(&:as_llm_message)
    end

    def run_with_tools(history)
      agent = build_agent
      context = {
        account_id: @account.id,
        user_id: @user.id,
        thread_id: @thread.id
      }
      context[:confirmed_action_id] = @confirmed_action_id if @confirmed_action_id.present?

      result = Agents::Runner.with_agents(agent).run(
        history.last[:content].to_s,
        context: context,
        max_turns: MAX_TURNS
      )

      extract_result(result)
    end

    def extract_result(agent_result)
      output = agent_result.respond_to?(:output) ? agent_result.output : agent_result
      tool_calls = extract_tool_calls(agent_result)

      {
        output: output,
        tool_calls: tool_calls,
        pending_action: extract_pending_action(tool_calls)
      }
    end

    # The agents gem (ai-agents 0.12) does not surface tool_calls
    # directly on the result. They live inside context[:conversation_history]
    # as the last assistant message's :tool_calls array.
    def extract_tool_calls(agent_result)
      return [] unless agent_result.respond_to?(:context)

      history = agent_result.context&.dig(:conversation_history) || []
      history.reverse.each do |msg|
        tc = msg[:tool_calls] || msg['tool_calls']
        return Array(tc) if tc.present?
      end
      []
    end

    # Pending actions are NOT in the tool_call object — they're encoded
    # in the tool's RESULT string. The tool returns
    # "PENDING_ACTION|{json}\n{summary}" and we parse the marker.
    def extract_pending_action(tool_calls)
      tool_calls.each do |tc|
        next unless tc.is_a?(Hash)
        result = tc[:result] || tc['result']
        next unless result.is_a?(String) && result.start_with?('PENDING_ACTION|')
        payload = result.sub(/^PENDING_ACTION\|/, '').split("\n", 2).first.to_s
        parsed = JSON.parse(payload) rescue nil
        return parsed if parsed.is_a?(Hash)
      end
      nil
    end

    def build_agent
      Agents::Agent.new(
        name: 'chambeabot_operator',
        instructions: system_prompt,
        tools: registered_tools,
        model: chat_model,
        temperature: 0.4
      )
    end

    def registered_tools
      OperatorAgent::ToolRegistry.tools_for(account: @account, user: @user)
    end

    def chat_model
      InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_MODEL')&.value.presence ||
        ENV['CAPTAIN_OPEN_AI_MODEL'].presence ||
        'MiniMax-M3'
    end

    def system_prompt
      <<~PROMPT
        You are Chambeabot Operator, an AI assistant embedded in the
        Chambeabot CRM dashboard. You help the account operator (admin or
        agent) configure and operate the CRM using natural language.

        The account is named "#{@account.name}" (id: #{@account.id}).
        Today is #{Date.current.strftime('%Y-%m-%d')}. The operator's name is "#{@user.name}".

        CRITICAL RULES — read these carefully:

        1. ALWAYS use a tool to read or change state. Never invent IDs,
           names, or results from your training data.
        2. When you need to identify a record by name (e.g. "label
           called 'vip'"), first call the list tool (e.g. list_labels)
           to get the exact ID, THEN call the write tool with the ID.
        3. DESTRUCTIVE tools: ALWAYS call them. Do NOT describe what
           you would do. The system automatically creates a pending
           action when you call a destructive tool — the operator
           confirms via the UI. After the tool call, your job is to
           tell the operator "Action queued — please confirm in the UI"
           and stop.
        4. Reply in Spanish (this account's language) unless told otherwise.
        5. Be concise: tables for 3+ items, bullets otherwise.
        6. Always cite the IDs you reference.

        Common patterns:
        - "List all X" → call list_X, format the result as a table
        - "Show me X" → call list_X with a filter
        - "Create X with foo=bar" → call create_X
        - "Update X to Y" → if you don't have the ID, list first; then update_X (destructive, just call it)
        - "Delete X" → list to find ID; then delete_X (destructive, just call it)
        - "Set up WhatsApp" → setup_whatsapp_openwa (handles the whole flow, destructive)
      PROMPT
    end

    def persist_assistant_response(result, tool_calls)
      content = result[:output].is_a?(Hash) ? result[:output][:content].to_s : result[:output].to_s
      tcs = tool_calls.map do |tc|
        {
          name: tc[:name] || tc['name'],
          args: tc[:args] || tc['args'],
          id: tc[:id] || tc['id'],
          result: (tc[:result] || tc['result']).to_s.truncate(2_000)
        }.compact
      end

      @thread.messages.create!(
        role: 'assistant',
        content: content.presence || '(no response)',
        tool_calls: tcs,
        status: 'complete'
      )
    end

    def handle_pending_actions(result, assistant_msg)
      pa = result[:pending_action]
      OperatorAgent::PendingAction.create!(
        message: assistant_msg,
        tool_name: pa[:tool_name] || pa['tool_name'],
        tool_args: pa[:tool_args] || pa['tool_args'] || {},
        status: 'awaiting_confirmation'
      )
    end

    def drain_pending_queue(assistant_msg)
      pending = OperatorAgent::Tools::BaseTool.drain_pending_queue
      pending.each do |item|
        OperatorAgent::PendingAction.create!(
          message: assistant_msg,
          tool_name: item[:tool_name],
          tool_args: item[:tool_args] || {},
          status: 'awaiting_confirmation'
        )
      end
    end

    def mark_pending_actions_in_message(assistant_msg)
      # No-op for now; the PendingAction rows are already created by
      # drain_pending_queue. The marker info in the tool_call result
      # remains for the audit log.
    end

    def audit_tool_calls(tool_calls)
      tool_calls.each do |tc|
        next unless tc.is_a?(Hash)
        name = tc[:name] || tc['name']
        next unless name

        result = (tc[:result] || tc['result']).to_s
        is_pending = result.start_with?('PENDING_ACTION|')
        OperatorAgent::ActionLog.record!(
          account: @account,
          user: @user,
          thread: @thread,
          tool_name: name.to_s,
          tool_args: tc[:args] || tc['args'] || {},
          tool_result: result.truncate(1_000),
          status: is_pending ? 'awaiting_confirmation' : (result.start_with?('ERROR:') ? 'error' : 'success'),
          duration_ms: nil
        )
      end
    end
  end
end
