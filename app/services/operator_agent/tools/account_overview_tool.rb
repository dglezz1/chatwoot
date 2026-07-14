class OperatorAgent::Tools::AccountOverviewTool < OperatorAgent::Tools::BaseTool
  description 'Get a high-level summary of the account: name, plan, user count, inboxes, conversations, Captain status.'

  def perform(_tool_context)
    inbox_count = account_scoped(Inbox).count
    contact_count = account_scoped(Contact).count
    conv_count = account_scoped(Conversation).count
    open_conv_count = account_scoped(Conversation).where(status: :open).count
    agent_count = @account.account_users.count
    label_count = account_scoped(Label).count
    captain_assistants = Captain::Assistant.where(account_id: @account.id)
    captain_inboxes = CaptainInbox.where(account_id: @account.id)
    custom_attrs = CustomAttributeDefinition.where(account_id: @account.id).count

    usage = @account.usage_limits || {}
    cap = usage[:captain] || {}

    <<~TEXT
      ## Resumen de la cuenta: #{@account.name} (##{@account.id})

      **Plan:** #{@account.custom_attributes&.dig('plan') || '—'}
      **Locales:** #{@account.locale || '—'}
      **Timezone:** #{@account.timezone || '—'}

      ### Recursos
      - **#{inbox_count}** inboxes
      - **#{contact_count}** contactos
      - **#{conv_count}** conversaciones (#{open_conv_count} abiertas)
      - **#{agent_count}** agentes
      - **#{label_count}** labels
      - **#{custom_attrs}** custom attributes

      ### Captain
      - **#{captain_assistants.count}** assistants configurados
      - **#{captain_inboxes.count}** inbox(es) con Captain vinculado
      #{captain_assistants.empty? ? '' : captain_assistants.map { |a| "  - Assistant ##{a.id} '#{a.name}' (desc: #{a.description.to_s.truncate(80)})" }.join("\n")}

      ### Captain usage (último ciclo)
      - Respuestas disponibles: #{cap.dig(:responses, :current_available) || '—'}
      - Límite de respuestas: #{cap.dig(:responses, :limit) || '—'}
    TEXT
  rescue StandardError => e
    err("Failed to load account overview: #{e.message}")
  end
end
