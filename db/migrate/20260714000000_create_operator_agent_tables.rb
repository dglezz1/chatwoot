class CreateOperatorAgentTables < ActiveRecord::Migration[7.1]
  def change
    create_table :operator_agent_threads do |t|
      t.references :account, null: false, foreign_key: true, index: true
      t.references :user, null: false, foreign_key: true, index: true
      t.string :title
      t.datetime :archived_at
      t.timestamps
    end

    create_table :operator_agent_messages do |t|
      t.references :thread, null: false, foreign_key: { to_table: :operator_agent_threads }, index: true
      t.string :role, null: false # 'user' | 'assistant' | 'tool' | 'system'
      t.text :content
      t.jsonb :tool_calls, default: []
      t.string :tool_call_id
      t.string :status, default: 'complete' # 'pending' | 'streaming' | 'complete' | 'failed'
      t.text :error
      t.timestamps
    end

    add_index :operator_agent_messages, :created_at
    add_index :operator_agent_messages, [:thread_id, :created_at]

    create_table :operator_agent_pending_actions do |t|
      t.references :message, null: false, foreign_key: { to_table: :operator_agent_messages }, index: true
      t.string :tool_name, null: false
      t.jsonb :tool_args, default: {}
      t.string :status, default: 'awaiting_confirmation' # 'awaiting_confirmation' | 'confirmed' | 'cancelled' | 'executed' | 'failed'
      t.datetime :expires_at
      t.jsonb :result
      t.text :error
      t.timestamps
    end

    add_index :operator_agent_pending_actions, :status
    add_index :operator_agent_pending_actions, :expires_at

    create_table :operator_agent_action_logs do |t|
      t.references :account, null: false, foreign_key: true, index: true
      t.references :user, null: false, foreign_key: true
      t.references :thread, null: true, foreign_key: { to_table: :operator_agent_threads }
      t.string :tool_name, null: false
      t.jsonb :tool_args, default: {}
      t.text :tool_result
      t.string :status, null: false # 'success' | 'error' | 'awaiting_confirmation' | 'cancelled'
      t.integer :duration_ms
      t.datetime :created_at, null: false
    end

    add_index :operator_agent_action_logs, [:account_id, :created_at]
    add_index :operator_agent_action_logs, :tool_name
  end
end
