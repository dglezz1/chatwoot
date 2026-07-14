# == Schema Information
#
# Table name: operator_agent_threads
#
#  id           :bigint           not null, primary key
#  account_id   :bigint           not null
#  user_id      :bigint           not null
#  title        :string
#  archived_at  :datetime
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#
# Indexes
#
#  index_operator_agent_threads_on_account_id  (account_id)
#  index_operator_agent_threads_on_user_id     (user_id)
#
class OperatorAgent::Thread < ApplicationRecord
  self.table_name = 'operator_agent_threads'

  belongs_to :account
  belongs_to :user

  has_many :messages, class_name: 'OperatorAgent::Message',
                      foreign_key: :thread_id,
                      dependent: :destroy,
                      inverse_of: :thread
  has_many :pending_actions, through: :messages,
                             class_name: 'OperatorAgent::PendingAction',
                             foreign_key: :message_id

  validates :account_id, :user_id, presence: true

  scope :active, -> { where(archived_at: nil) }
  scope :archived, -> { where.not(archived_at: nil) }
  scope :recent, -> { order(created_at: :desc) }

  def archive!
    update!(archived_at: Time.current)
  end

  def archived?
    archived_at.present?
  end
end
