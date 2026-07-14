# == Schema Information
#
# Table name: operator_agent_messages
#
#  id           :bigint           not null, primary key
#  thread_id    :bigint           not null
#  role         :string           not null
#  content      :text
#  tool_calls   :jsonb            default([])
#  tool_call_id :string
#  status       :string           default("complete")
#  error        :text
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#
# Indexes
#
#  index_operator_agent_messages_on_thread_id              (thread_id)
#  index_operator_agent_messages_on_thread_id_and_created_at  (thread_id, created_at)
#  index_operator_agent_messages_on_created_at             (created_at)
#
class OperatorAgent::Message < ApplicationRecord
  self.table_name = 'operator_agent_messages'

  ROLES = %w[user assistant tool system].freeze
  STATUSES = %w[pending streaming complete failed].freeze

  belongs_to :thread, class_name: 'OperatorAgent::Thread',
                      foreign_key: :thread_id,
                      inverse_of: :messages
  has_many :pending_actions, class_name: 'OperatorAgent::PendingAction',
                             foreign_key: :message_id,
                             dependent: :destroy,
                             inverse_of: :message

  validates :thread_id, presence: true
  validates :role, inclusion: { in: ROLES }
  validates :status, inclusion: { in: STATUSES }

  scope :for_thread, ->(thread_id) { where(thread_id: thread_id) }
  scope :ordered, -> { order(:created_at) }

  def user?
    role == 'user'
  end

  def assistant?
    role == 'assistant'
  end

  def tool?
    role == 'tool'
  end

  def streaming?
    status == 'streaming'
  end

  def complete?
    status == 'complete'
  end

  def failed?
    status == 'failed'
  end

  def as_llm_message
    {
      role: role.to_sym,
      content: content.to_s,
      tool_calls: tool_calls.presence,
      tool_call_id: tool_call_id
    }.compact
  end
end
