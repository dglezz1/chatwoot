class OperatorAgent::Tools::CreateCustomAttributeTool < OperatorAgent::Tools::BaseTool
  description 'Create a new custom attribute definition (for conversations or contacts). Non-destructive.'

  param :attribute_key, type: 'string', desc: 'Machine key (e.g. "plan", "company")', required: true
  param :attribute_model, type: 'string', desc: 'Either "conversation_attribute" or "contact_attribute"', required: true
  param :attribute_display_name, type: 'string', desc: 'Human-readable label', required: true
  param :attribute_display_type, type: 'string', desc: 'One of: text, number, currency, percent, link, date, list', required: true
  param :attribute_values, type: 'array', desc: 'For list type: array of allowed values, e.g. ["new", "qualified", "won"]', required: false

  def perform(_tool_context, attribute_key:, attribute_model:, attribute_display_name:, attribute_display_type:, attribute_values: nil)
    if attribute_key.blank? || attribute_display_name.blank?
      return err('attribute_key and attribute_display_name are required.')
    end

    model_int = case attribute_model.to_s
                when 'conversation_attribute' then 0
                when 'contact_attribute' then 1
                else return err("attribute_model must be 'conversation_attribute' or 'contact_attribute'.")
                end

    type_int = case attribute_display_type.to_s
               when 'text' then 0
               when 'number' then 1
               when 'currency' then 2
               when 'percent' then 3
               when 'link' then 4
               when 'date' then 5
               when 'list' then 6
               else return err("attribute_display_type must be one of: text, number, currency, percent, link, date, list.")
               end

    existing = CustomAttributeDefinition.where(account_id: @account.id, attribute_key: attribute_key, attribute_model: model_int).first
    return err("Custom attribute '#{attribute_key}' ya existe (##{existing.id}).") if existing

    attr_def = CustomAttributeDefinition.create!(
      account_id: @account.id,
      attribute_key: attribute_key,
      attribute_model: model_int,
      attribute_display_name: attribute_display_name,
      attribute_display_type: type_int,
      attribute_values: attribute_values.is_a?(Array) ? attribute_values : []
    )

    log_tool_usage('create_custom_attribute', id: attr_def.id, key: attribute_key)
    "✅ Custom attribute '#{attribute_key}' creado (##{attr_def.id}, #{attribute_model}, tipo #{attribute_display_type})."
  rescue StandardError => e
    err("Failed to create custom attribute: #{e.message}")
  end
end
