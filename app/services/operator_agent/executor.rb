module OperatorAgent
  # Runs a single message through the LLM with tool calling.
  #
  # Pipeline:
  # 1. Persist the user message
  # 2. Load previous messages from the thread (chronological)
  # 3. Build an Agents::Agent with the registered tool set
  # 4. Run the LLM (RubyLLM.chat under the hood)
  # 5. Persist the assistant response + any tool call records
  # 6. If the response is a pending_action, also persist a
  #    OperatorAgent::PendingAction row and stop (no further LLM call)
  # 7. Audit every tool call
  #
  # The LLM provider is whatever is configured via the env-only
  # Llm::AccountProviderResolver / Agents.configure — i.e. whatever
  # CAPTAIN_OPEN_AI_* env vars are set in Railway.
  class Executor
    MAX_TURNS = 6

    def initialize(thread:, user_message:)
      @thread = thread
      @account = thread.account
      @user = thread.user
      @user_message = user_message
    end

    def perform
      user_msg = persist_user_message
      history = load_message_history

      result = run_with_tools(history)

      assistant_msg = persist_assistant_response(result)
      handle_pending_actions(result, assistant_msg) if result[:pending_action].present?

      assistant_msg
    rescue StandardError => e
      ChatwootExceptionTracker.new(e, account: @account).capture_exception
      Rails.logger.error "[OperatorAgent::Executor] error: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")

      fail_user_message(user_msg) if user_msg&.persisted?
      raise
    end

    private

    def persist_user_message
      @thread.messages.create!(
        role: 'user',
        content: @user_message.to_s,
        status: 'complete'
      )
    end

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

    def extract_tool_calls(agent_result)
      return [] unless agent_result.respond_to?(:context)

      tool_calls = agent_result.context&.dig(:last_tool_calls) ||
                   agent_result.context&.dig(:tool_calls) ||
                   []
      Array(tool_calls)
    end

    def extract_pending_action(tool_calls)
      pending = tool_calls.find { |tc| tc.is_a?(Hash) && tc[:pending_action] == true }
      pending
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
      # The model is whatever the env resolver picks up. The agents
      # gem will use RubyLLM.chat which routes to MiniMax / OpenAI /
      # whatever the env says. We don't pin it here so swapping
      # providers in Railway env requires zero code changes.
      InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_MODEL')&.value.presence ||
        ENV['CAPTAIN_OPEN_AI_MODEL'].presence ||
        'MiniMax-M3'
    end

    def system_prompt
      <<~PROMPT
        You are Chambeabot Operator, an AI assistant embedded in the
        Chambeabot CRM dashboard. You help the account operator (admin or
        agent) configure and operate the CRM using natural language.

        Capabilities (in this order of preference):
        1. Inspect the account (list inboxes, contacts, agents, labels, etc.)
        2. Configure the account (Phase 2: create/update/delete things — pending confirmation)
        3. Diagnose problems (logs, channel health, Captain state)
        4. Run multi-step setup flows (Phase 3: WhatsApp OpenWA onboarding, Captain binding, pipeline setup)

        The account is named "#{@account.name}" (id: #{@account.id}).
        Today is #{Date.current.strftime('%Y-%m-%d')}. The operator's name is "#{@user.name}".

        Communication rules:
        - Reply in the operator's language (Spanish for this account unless told otherwise).
        - Be concise. Use bullet points and short paragraphs. Tables when listing 3+ items.
        - Always cite the IDs of records you reference so the operator can act on them.
        - If a tool returns an error, explain what failed and what the operator can do.
        - If you need more information, ask ONE clarifying question. Don't ask 5 at once.
        - Never make up record IDs. If a tool didn't return a result, say "I don't see that".
        - Never suggest destructive actions (delete, update) without first listing the current state
          and asking the operator to confirm. (Phase 2: pending actions enforce this automatically.)
      PROMPT
    end

    def persist_assistant_response(result)
      content = result[:output].is_a?(Hash) ? result[:output][:content].to_s : result[:output].to_s
      tool_calls = result[:tool_calls].map do |tc|
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
        tool_calls: tool_calls,
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

    def fail_user_message(user_msg)
      user_msg&.update(status: 'failed', error: 'Executor failed; see logs')
    end
  end
end
