class Api::V1::Accounts::OperatorAgent::CapabilitiesController < Api::V1::Accounts::BaseController
  def index
    render json: {
      tools: OperatorAgent::ToolRegistry.capabilities,
      stats: {
        threads: Current.account.operator_agent_threads.where(user_id: Current.user.id).count,
        actions_today: OperatorAgent::ActionLog.for_account(Current.account.id)
                                              .where('created_at > ?', 24.hours.ago).count
      }
    }
  end
end
