class Llm::ProviderValidationJob < ApplicationJob
  queue_as :default

  # Asynchronously validates a provider's credentials and updates
  # last_validated_at + last_validation_error. Used after create/update
  # to give the operator feedback without blocking the HTTP response.
  def perform(provider_id)
    provider = LlmProviderSetting.find_by(id: provider_id)
    return unless provider

    result = Llm::ProviderValidator.new(provider).validate
    provider.update!(
      last_validated_at: Time.current,
      last_validation_error: result[:ok] ? nil : result[:error]
    )
  end
end
