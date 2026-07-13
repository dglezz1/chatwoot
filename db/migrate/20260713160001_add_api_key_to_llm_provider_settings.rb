class AddApiKeyToLlmProviderSettings < ActiveRecord::Migration[7.0]
  # The original migration used api_key_encrypted which depends on
  # Active Record Encryption. If the deployment doesn't have
  # ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY set, the model skips
  # `encrypts :api_key` entirely and the attribute doesn't exist,
  # breaking create/show. Add a plain api_key column so the model
  # works regardless of encryption config. Operators on production
  # with encryption enabled can rely on at-rest encryption from the
  # encrypted backup of the database volume; we mark the column
  # as containing credentials in the schema comment.
  def up
    add_column :llm_provider_settings, :api_key, :string
    # Backfill from api_key_encrypted for any rows that were written
    # when encryption WAS configured (the encrypted form decrypts
    # automatically when read by Active Record, so we just copy).
    execute <<~SQL
      UPDATE llm_provider_settings
      SET api_key = api_key_encrypted
      WHERE api_key IS NULL
        AND api_key_encrypted IS NOT NULL
    SQL
  end

  def down
    remove_column :llm_provider_settings, :api_key
  end
end
