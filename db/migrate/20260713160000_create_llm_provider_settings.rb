class CreateLlmProviderSettings < ActiveRecord::Migration[7.0]
  # Per-account LLM provider credentials. Each account can register one or
  # more LLM providers (minimax, openai, openrouter, together, groq,
  # local vLLM, etc.) and route Captain through them. The credentials
  # are AES-encrypted at rest via ActiveRecord Encryption.
  #
  # The system-wide CAPTAIN_OPEN_AI_* env vars remain the fallback for
  # accounts that haven't configured a provider explicitly.
  def change
    create_table :llm_provider_settings do |t|
      t.references :account, null: false, foreign_key: true, index: true
      t.string  :provider, null: false # "minimax" | "openai" | "openrouter" | etc.
      t.string  :label                              # human-readable name shown in UI
      t.string  :api_base                           # https://api.minimaxi.com/v1
      t.string  :api_key_encrypted                  # encrypted at rest
      t.string  :api_key_iv                         # AR-encryption IV
      t.string  :chat_model                         # default chat model (e.g. MiniMax-Text-01)
      t.string  :vision_model                       # image understanding model
      t.string  :audio_transcription_model          # speech-to-text model
      t.string  :embedding_model                    # RAG embedding model
      t.jsonb   :capabilities, default: {}          # { images: true, audio: true, video: true, ... }
      t.jsonb   :config, default: {}                # provider-specific knobs
      t.boolean :enabled, default: true, null: false
      t.boolean :is_default, default: false, null: false
      t.datetime :last_used_at
      t.datetime :last_validated_at
      t.string  :last_validation_error
      t.timestamps
    end

    add_index :llm_provider_settings, [:account_id, :provider], unique: true,
              name: 'idx_llm_provider_settings_on_account_and_provider'
  end
end
