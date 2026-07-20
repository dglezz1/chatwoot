class Enterprise::Api::V1::AccountsController < Api::BaseController
  # Chambeabot override: drop the `check_cloud_env` before_action that
  # upstream uses to block self-hosted installs from hitting
  # /enterprise/api/v1/accounts/:id/limits and /toggle_deletion.
  #
  # The cloud check is a SaaS-business check, not a security one. We
  # self-host Chambeabot, so we want the limits endpoint to actually
  # return real usage data so the dashboard's enterprise UI doesn't
  # render a permanent "Not found" on the limits page.
  include BillingHelper
  before_action :fetch_account
  before_action :check_authorization

  def subscription
    if stripe_customer_id.blank? && @account.custom_attributes['is_creating_customer'].blank?
      @account.update(custom_attributes: { is_creating_customer: true })
      Enterprise::CreateStripeCustomerJob.perform_later(@account)
    end
    head :no_content
  end

  def limits
    limits = if default_plan?(@account)
               {
                 'conversation' => {
                   'allowed' => 500,
                   'consumed' => conversations_this_month(@account)
                 },
                 'non_web_inboxes' => {
                   'allowed' => 0,
                   'consumed' => non_web_inboxes(@account)
                 },
                 'agents' => {
                   'allowed' => 2,
                   'consumed' => agents(@account)
                 }
               }
             else
               default_limits
             end

    # include id in response to ensure that the store can be updated on the frontend
    render json: { id: @account.id, limits: limits }, status: :ok
  end

  def checkout
    return create_stripe_billing_session(stripe_customer_id) if stripe_customer_id.present?

    render_invalid_billing_details
  end

  def toggle_deletion
    action_type = params[:action_type]

    case action_type
    when 'delete'
      mark_for_deletion
    when 'undelete'
      unmark_for_deletion
    else
      render json: { error: 'Invalid action_type. Must be either "delete" or "undelete"' }, status: :unprocessable_entity
    end
  end

  def topup_checkout
    return render json: { error: I18n.t('errors.topup.credits_required') }, status: :unprocessable_entity if params[:credits].blank?

    service = Enterprise::Billing::TopupCheckoutService.new(account: @account)
    result = service.create_checkout_session(credits: params[:credits].to_i)

    @account.reload
    render json: result.merge(
      id: @account.id,
      limits: @account.limits,
      custom_attributes: @account.custom_attributes
    )
  rescue Enterprise::Billing::TopupCheckoutService::Error, Stripe::StripeError => e
    render_could_not_create_error(e.message)
  end

  private

  def default_limits
    {
      'conversation' => {},
      'non_web_inboxes' => {},
      'agents' => {
        'allowed' => @account.usage_limits[:agents],
        'consumed' => agents(@account)
      }
    }
  end

  def default_plan?(account)
    account.usage_limits[:plan] == 'default'
  end
end
