class Api::V1::Accounts::OperatorAgent::MessagesController < Api::V1::Accounts::BaseController
  before_action :set_thread

  def index
    messages = @thread.messages.ordered
    pending = OperatorAgent::PendingAction.joins(:message)
                                         .where(messages: { thread_id: @thread.id })
                                         .where(status: 'awaiting_confirmation')
    render json: {
      messages: messages.map do |m|
        {
          id: m.id,
          role: m.role,
          content: m.content,
          tool_calls: m.tool_calls,
          status: m.status,
          created_at: m.created_at
        }
      end,
      pending_actions: pending.map do |pa|
        {
          id: pa.id,
          message_id: pa.message_id,
          tool_name: pa.tool_name,
          tool_args: pa.tool_args,
          status: pa.status,
          expires_at: pa.expires_at
        }
      end
    }
  end

  def create
    content = message_params[:content].to_s.strip
    return render json: { error: 'Message content is required' }, status: :unprocessable_entity if content.blank?

    @message = @thread.messages.create!(
      role: 'user',
      content: content,
      status: 'complete'
    )
    @message.enqueue_response_job

    render json: message_response_payload, status: :accepted
  rescue StandardError => e
    Rails.logger.error "[OperatorAgent::MessagesController#create] #{e.class.name}: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

  def set_thread
    @thread = Current.account.operator_agent_threads
                     .where(user_id: Current.user.id)
                     .find(params[:thread_id])
  end

  def message_params
    params.permit(:content)
  end

  def message_response_payload
    {
      message: serialize_message(@message),
      pending_actions: @pending_actions.map { |pa| serialize_pending_action(pa) }
    }
  end

  def serialize_message(msg)
    {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      tool_calls: msg.tool_calls,
      status: msg.status,
      created_at: msg.created_at
    }
  end

  def serialize_pending_action(pa)
    {
      id: pa.id,
      tool_name: pa.tool_name,
      tool_args: pa.tool_args,
      status: pa.status,
      expires_at: pa.expires_at
    }
  end
end
