class LlmProviderSetting < ApplicationRecord
  belongs_to :account

  PROVIDERS = %w[minimax openai openrouter together groq anthropic gemini local openai_compatible].freeze

  # Provider-specific defaults. New providers can be added without code
  # changes — the UI will surface any provider present in this hash.
  PROVIDER_DEFAULTS = {
    'minimax' => {
      label: 'MiniMax (OpenAI-compatible)',
      api_base: 'https://api.minimaxi.com/v1',
      chat_model: 'MiniMax-Text-01',
      vision_model: 'MiniMax-VL-01',
      audio_transcription_model: 'MiniMax-asr-01',
      embedding_model: 'embo-01',
      capabilities: {
        text: true,
        images: true,
        audio_input: true,
        audio_output: true,
        video: true,
        tool_calling: true,
        embeddings: true
      }
    },
    'openai' => {
      label: 'OpenAI',
      api_base: 'https://api.openai.com/v1',
      chat_model: 'gpt-4.1-mini',
      vision_model: 'gpt-4.1',
      audio_transcription_model: 'gpt-4o-mini-transcribe',
      embedding_model: 'text-embedding-3-small',
      capabilities: {
        text: true,
        images: true,
        audio_input: true,
        audio_output: true,
        video: false,
        tool_calling: true,
        embeddings: true
      }
    },
    'openrouter' => {
      label: 'OpenRouter',
      api_base: 'https://openrouter.ai/api/v1',
      chat_model: 'openai/gpt-4.1-mini',
      vision_model: 'openai/gpt-4.1',
      audio_transcription_model: 'openai/whisper-1',
      embedding_model: 'openai/text-embedding-3-small',
      capabilities: {
        text: true,
        images: true,
        audio_input: false,
        audio_output: false,
        video: false,
        tool_calling: true,
        embeddings: true
      }
    },
    'together' => {
      label: 'Together.ai',
      api_base: 'https://api.together.xyz/v1',
      chat_model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      vision_model: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
      audio_transcription_model: 'whisper-large-v3',
      embedding_model: 'BAAI/bge-large-en-v1.5',
      capabilities: {
        text: true,
        images: true,
        audio_input: true,
        audio_output: false,
        video: false,
        tool_calling: true,
        embeddings: true
      }
    },
    'groq' => {
      label: 'Groq',
      api_base: 'https://api.groq.com/openai/v1',
      chat_model: 'llama-3.3-70b-versatile',
      vision_model: 'llama-3.2-90b-vision-preview',
      audio_transcription_model: 'whisper-large-v3',
      embedding_model: nil,
      capabilities: {
        text: true,
        images: true,
        audio_input: true,
        audio_output: false,
        video: false,
        tool_calling: true,
        embeddings: false
      }
    },
    'anthropic' => {
      label: 'Anthropic',
      api_base: 'https://api.anthropic.com/v1',
      chat_model: 'claude-sonnet-4-5',
      vision_model: 'claude-sonnet-4-5',
      audio_transcription_model: nil,
      embedding_model: nil,
      capabilities: {
        text: true,
        images: true,
        audio_input: false,
        audio_output: false,
        video: false,
        tool_calling: true,
        embeddings: false
      }
    },
    'gemini' => {
      label: 'Google Gemini',
      api_base: 'https://generativelanguage.googleapis.com/v1beta',
      chat_model: 'gemini-1.5-pro',
      vision_model: 'gemini-1.5-pro',
      audio_transcription_model: 'gemini-1.5-pro',
      embedding_model: 'text-embedding-004',
      capabilities: {
        text: true,
        images: true,
        audio_input: true,
        audio_output: true,
        video: true,
        tool_calling: true,
        embeddings: true
      }
    },
    'local' => {
      label: 'Self-hosted (vLLM / llama.cpp / Ollama)',
      api_base: 'http://localhost:8000/v1',
      chat_model: 'meta-llama/Llama-3.1-70B-Instruct',
      vision_model: nil,
      audio_transcription_model: nil,
      embedding_model: 'BAAI/bge-large-en-v1.5',
      capabilities: {
        text: true,
        images: false,
        audio_input: false,
        audio_output: false,
        video: false,
        tool_calling: true,
        embeddings: true
      }
    },
    'openai_compatible' => {
      label: 'Custom OpenAI-compatible endpoint',
      api_base: nil,
      chat_model: nil,
      vision_model: nil,
      audio_transcription_model: nil,
      embedding_model: nil,
      capabilities: {
        text: true,
        images: false,
        audio_input: false,
        audio_output: false,
        video: false,
        tool_calling: true,
        embeddings: false
      }
    }
  }.freeze

  validates :provider, presence: true, inclusion: { in: PROVIDERS }
  validates :api_base, presence: true, format: { with: %r{\Ahttps?://} }
  validates :api_key, presence: true
  validates :provider, uniqueness: { scope: :account_id }

  # ActiveRecord Encryption. The IV column is auto-handled by Rails 7
  # when using `encrypts`, but we add it explicitly so the migration
  # declares the schema (helps the next person reading it).
  if Chatwoot.encryption_configured?
    encrypts :api_key
  end

  scope :enabled, -> { where(enabled: true) }
  scope :default_for_account, ->(account) {
    where(account: account, is_default: true, enabled: true).first
  }
  scope :ordered, -> { order(is_default: :desc, created_at: :asc) }

  before_save :ensure_single_default, if: :is_default?

  # Returns the effective settings (with provider defaults filled in for
  # any field the operator left blank).
  def effective_settings
    defaults = PROVIDER_DEFAULTS[provider] || {}
    {
      label: label.presence || defaults['label'] || provider.titleize,
      api_base: api_base.presence || defaults['api_base'],
      chat_model: chat_model.presence || defaults['chat_model'],
      vision_model: vision_model.presence || defaults['vision_model'] || chat_model.presence || defaults['chat_model'],
      audio_transcription_model: audio_transcription_model.presence || defaults['audio_transcription_model'],
      embedding_model: embedding_model.presence || defaults['embedding_model'],
      capabilities: capabilities.presence || defaults['capabilities'] || {}
    }
  end

  def supports?(capability)
    effective_settings[:capabilities][capability.to_sym] == true
  end

  def self.default_for(account)
    return nil if account.nil?

    account.llm_provider_settings.enabled.find_by(is_default: true) ||
      account.llm_provider_settings.enabled.first
  end

  private

  def ensure_single_default
    return unless is_default_changed? && is_default

    self.class.where(account_id: account_id, is_default: true)
        .where.not(id: id)
        .update_all(is_default: false)
  end
end
