class Api::V1::Accounts::OperatorAgent::PendingActionsController < Api::V1::Accounts::BaseController
  before_action :set_pending_action

  def confirm
    return render json: { error: 'Action is not awaiting confirmation' }, status: :unprocessable_entity unless @pending_action.awaiting_confirmation?
    return render json: { error: 'Action has expired' }, status: :unprocessable_entity if @pending_action.expired?

    @pending_action.update!(status: 'confirmed')

    result = execute_confirmed_action

    @pending_action.mark_executed!(result.to_s.truncate(2_000))

    audit!(status: 'success', result: result)

    # Persist the result as a new assistant message in the thread
    @pending_action.message.thread.messages.create!(
      role: 'assistant',
      content: format_result_message(result),
      tool_calls: [{
        name: @pending_action.tool_name,
        args: @pending_action.tool_args,
        id: @pending_action.id.to_s,
        result: result.to_s.truncate(1_500)
      }],
      status: 'complete'
    )

    render json: { status: 'executed', result: result.to_s }
  rescue StandardError => e
    Rails.logger.error "[OperatorAgent::PendingActions#confirm] #{e.class.name}: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    @pending_action&.mark_failed!(e.message)
    audit!(status: 'error', result: e.message)
    render json: { error: e.message }, status: :unprocessable_entity
  end

  def cancel
    return render json: { error: 'Action is not awaiting confirmation' }, status: :unprocessable_entity unless @pending_action.awaiting_confirmation?

    @pending_action.cancel!
    audit!(status: 'cancelled', result: 'cancelled by operator')

    @pending_action.message.thread.messages.create!(
      role: 'assistant',
      content: "❌ Acción cancelada por el operador: **#{@pending_action.tool_name}** con argumentos `#{@pending_action.tool_args.to_json.truncate(200)}`.",
      tool_calls: [],
      status: 'complete'
    )

    render json: { status: 'cancelled' }
  end

  private

  def set_pending_action
    @pending_action = OperatorAgent::PendingAction
                       .joins(message: { thread: :account })
                       .where(operator_agent_messages: { thread_id: params[:thread_id] })
                       .where(operator_agent_threads: { user_id: Current.user.id })
                       .where(operator_agent_pending_actions: { id: params[:id] })
                       .first
    raise ActiveRecord::RecordNotFound unless @pending_action
  end

  def execute_confirmed_action
    tool_class = OperatorAgent::ToolRegistry.find_tool_class(@pending_action.tool_name)
    raise "Unknown tool: #{@pending_action.tool_name}" unless tool_class

    tool = tool_class.new(account: Current.account, user: Current.user)

    # Mock the agents gem tool_context with the confirmed_action_id in state
    tool_context = MockToolContext.new(confirmed_action_id: @pending_action.id)

    # Call perform with the original tool_args plus the synthetic tool_context
    tool.perform(tool_context, **@pending_action.tool_args.symbolize_keys)
  end

  def format_result_message(result)
    "✅ Acción ejecutada correctamente:\n\n#{result.to_s}"
  end

  def audit!(status:, result:)
    OperatorAgent::ActionLog.record!(
      account: Current.account,
      user: Current.user,
      thread: @pending_action.message.thread,
      tool_name: @pending_action.tool_name,
      tool_args: @pending_action.tool_args,
      tool_result: result.to_s,
      status: status,
      duration_ms: nil
    )
  end

  # Lightweight stand-in for the agents gem's tool_context. The
  # agents gem's ToolContext has a state hash; we only need the
  # :confirmed_action_id key for the tools to branch.
  class MockToolContext
    attr_reader :state

    def initialize(state = {})
      @state = state.with_indifferent_access
    end
  end
end
