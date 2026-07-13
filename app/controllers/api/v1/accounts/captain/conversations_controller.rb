class Api::V1::Accounts::Captain::ConversationsController < Api::V1::Accounts::BaseController
  before_action :fetch_conversation

  # POST /api/v1/accounts/:account_id/captain/conversations/:id/pause
  # Body: { paused: true|false, reason: "optional" }
  #
  # When `paused: true`, Captain (V1 + V2) will skip auto-replying on this
  # conversation. The conversation stays in pending status so the human
  # agent can still type — and as soon as the agent replies, the
  # `waiting_since` clock starts. Toggle off to re-enable the bot.
  def pause
    apply_pause(
      paused: pause_params[:paused] != false,
      reason: pause_params[:reason]
    )
    render json: serialized_conversation_state
  end

  # DELETE = resume (alias for backwards compat with the UI)
  alias_method :resume, :pause
  def resume
    apply_pause(paused: false, reason: pause_params[:reason])
    render json: serialized_conversation_state
  end

  # GET /api/v1/accounts/:account_id/captain/conversations/:id/status
  # Returns whether Captain is currently paused on this conversation.
  def status
    render json: serialized_conversation_state
  end

  private

  def fetch_conversation
    @conversation = Current.account.conversations.find_by!(display_id: params[:id])
    authorize!(:manage, @conversation)
  end

  def pause_params
    params.permit(:paused, :reason)
  end

  def apply_pause(paused:, reason: nil)
    attrs = @conversation.additional_attributes.deep_dup
    attrs['captain_paused'] = paused
    attrs['captain_paused_at'] = Time.current.iso8601 if paused
    attrs['captain_paused_reason'] = reason if reason.present?
    attrs.delete('captain_paused_at') unless paused
    attrs.delete('captain_paused_reason') unless paused

    @conversation.update!(additional_attributes: attrs)

    # Record a private note so the audit trail is visible to the team.
    @conversation.messages.create!(
      account: Current.account,
      inbox: @conversation.inbox,
      sender: Current.user,
      message_type: :outgoing,
      private: true,
      content: paused \
        ? "🤖 Bot pausado por #{Current.user&.name || 'agente'}#{reason.present? ? " — #{reason}" : ''}"
        : "🤖 Bot reactivado por #{Current.user&.name || 'agente'}"
    )
  end

  def serialized_conversation_state
    {
      conversation_id: @conversation.display_id,
      captain_paused: @conversation.additional_attributes&.dig('captain_paused') == true,
      captain_paused_at: @conversation.additional_attributes&.dig('captain_paused_at'),
      captain_paused_reason: @conversation.additional_attributes&.dig('captain_paused_reason'),
      status: @conversation.status
    }
  end
end
