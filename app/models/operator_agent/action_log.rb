# == Schema Information
#
# Table name: operator_agent_action_logs
#
#  id           :bigint           not null, primary key
#  account_id   :bigint           not null
#  user_id      :bigint           not null
#  thread_id    :bigint
#  tool_name    :string           not null
#  tool_args    :jsonb            default({})
#  tool_result  :text
#  status       :string           not null
#  duration_ms  :integer
#  created_at   :datetime         not null
#
# Indexes
#
#  index_operator_agent_action_logs_on_account_id_and_created_at  (account_id, created_at)
#  index_operator_agent_action_logs_on_tool_name                  (tool_name)
#
class OperatorAgent::ActionLog < ApplicationRecord
  self.table_name = 'operator_agent_action_logs'

  belongs_to :account
  belongs_to :user
  belongs_to :thread, class_name: 'OperatorAgent::Thread',
                      foreign_key: :thread_id,
                      optional: true

  validates :tool_name, :status, :account_id, :user_id, presence: true
  validates :status, inclusion: { in: %w[success error awaiting_confirmation cancelled] }

  scope :recent, -> { order(created_at: :desc) }
  scope :for_account, ->(account_id) { where(account_id: account_id) }

  # Truncate the result to keep the audit log lean. Detailed error info
  # is preserved in the dedicated error column when present.
  MAX_RESULT_BYTES = 4_096

  def self.record!(account:, user:, thread:, tool_name:, tool_args:, tool_result:, status:, duration_ms:)
    create!(
      account: account,
      user: user,
      thread: thread,
      tool_name: tool_name,
      tool_args: tool_args,
      tool_result: tool_result.is_a?(String) ? tool_result.byteslice(0, MAX_RESULT_BYTES) : tool_result.to_json.byteslice(0, MAX_RESULT_BYTES),
      status: status,
      duration_ms: duration_ms,
      created_at: Time.current
    )
  end
end
