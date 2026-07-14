# == Schema Information
#
# Table name: operator_agent_pending_actions
#
#  id         :bigint           not null, primary key
#  message_id :bigint           not null
#  tool_name  :string           not null
#  tool_args  :jsonb            default({})
#  status     :string           default("awaiting_confirmation")
#  expires_at :datetime
#  result     :jsonb
#  error      :text
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_operator_agent_pending_actions_on_message_id  (message_id)
#  index_operator_agent_pending_actions_on_status      (status)
#  index_operator_agent_pending_actions_on_expires_at  (expires_at)
#
class OperatorAgent::PendingAction < ApplicationRecord
  self.table_name = 'operator_agent_pending_actions'

  STATUSES = %w[awaiting_confirmation confirmed cancelled executed failed].freeze

  belongs_to :message, class_name: 'OperatorAgent::Message',
                       foreign_key: :message_id,
                       inverse_of: :pending_actions

  validates :tool_name, presence: true
  validates :status, inclusion: { in: STATUSES }

  scope :awaiting, -> { where(status: 'awaiting_confirmation') }
  scope :executable, -> { awaiting.where('expires_at IS NULL OR expires_at > ?', Time.current) }
  scope :expired, -> { awaiting.where('expires_at IS NOT NULL AND expires_at <= ?', Time.current) }

  before_validation :set_default_expiry, on: :create

  def awaiting_confirmation?
    status == 'awaiting_confirmation'
  end

  def executed?
    status == 'executed'
  end

  def cancelled?
    status == 'cancelled'
  end

  def expired?
    expires_at.present? && expires_at <= Time.current
  end

  def cancel!
    update!(status: 'cancelled')
  end

  def mark_executed!(result)
    update!(status: 'executed', result: result)
  end

  def mark_failed!(error)
    update!(status: 'failed', error: error.to_s)
  end

  private

  def set_default_expiry
    self.expires_at ||= 24.hours.from_now
  end
end
