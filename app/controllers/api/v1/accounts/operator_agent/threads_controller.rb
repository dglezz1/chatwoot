class Api::V1::Accounts::OperatorAgent::ThreadsController < Api::V1::Accounts::BaseController
  before_action :set_thread, only: [:show, :destroy]

  def index
    @threads = Current.account.operator_agent_threads
                      .where(user_id: Current.user.id)
                      .active
                      .recent
                      .limit(50)
    render json: @threads.map { |t| { id: t.id, title: t.title, created_at: t.created_at } }
  end

  def show
    render json: thread_payload
  end

  def create
    @thread = Current.account.operator_agent_threads.create!(
      user: Current.user,
      title: thread_params[:title].presence || 'Nueva conversación'
    )
  end

  def destroy
    @thread.destroy!
    head :no_content
  end

  private

  def set_thread
    @thread = Current.account.operator_agent_threads
                     .where(user_id: Current.user.id)
                     .find(params[:id])
  end

  def thread_params
    params.permit(:title)
  end

  def thread_payload
    messages = @thread.messages.ordered.to_a
    pending = OperatorAgent::PendingAction.joins(:message)
                                         .where(messages: { thread_id: @thread.id })
                                         .where(status: 'awaiting_confirmation')
                                         .to_a
    {
      id: @thread.id,
      title: @thread.title,
      created_at: @thread.created_at,
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
end
