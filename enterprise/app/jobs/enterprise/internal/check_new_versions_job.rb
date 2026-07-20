module Enterprise::Internal::CheckNewVersionsJob
  def perform
    super
    update_plan_info
    reconcile_premium_config_and_features
  end

  private

  def update_plan_info
    return if @instance_info.blank?

    # Chambeabot: self-hosted instances that have been manually set to
    # 'enterprise' must not be downgraded by hub.2.chatwoot.com, which
    # always returns 'community' for unregistered self-hosted installs.
    # Detect Chambeabot via CW_EDITION (preferred) or via the FRONTEND_URL
    # domain — either signal is enough to opt out of the hub's downgrade.
    current_plan = InstallationConfig.find_by(name: 'INSTALLATION_PRICING_PLAN')&.value
    chambeabot_self_hosted = chambeabot_instance?

    if chambeabot_self_hosted && current_plan == 'enterprise'
      Rails.logger.info '[CheckNewVersionsJob] Skipping hub plan sync: ' \
                        'Chambeabot self-hosted is already on enterprise plan.'
      # Still pull support tokens (they're free) but never touch the plan.
      update_installation_config(key: 'CHATWOOT_SUPPORT_WEBSITE_TOKEN', value: @instance_info['chatwoot_support_website_token'])
      update_installation_config(key: 'CHATWOOT_SUPPORT_IDENTIFIER_HASH', value: @instance_info['chatwoot_support_identifier_hash'])
      update_installation_config(key: 'CHATWOOT_SUPPORT_SCRIPT_URL', value: @instance_info['chatwoot_support_script_url'])
      return
    end

    update_installation_config(key: 'INSTALLATION_PRICING_PLAN', value: @instance_info['plan'])
    update_installation_config(key: 'INSTALLATION_PRICING_PLAN_QUANTITY', value: @instance_info['plan_quantity'])
    update_installation_config(key: 'CHATWOOT_SUPPORT_WEBSITE_TOKEN', value: @instance_info['chatwoot_support_website_token'])
    update_installation_config(key: 'CHATWOOT_SUPPORT_IDENTIFIER_HASH', value: @instance_info['chatwoot_support_identifier_hash'])
    update_installation_config(key: 'CHATWOOT_SUPPORT_SCRIPT_URL', value: @instance_info['chatwoot_support_script_url'])
  end

  def update_installation_config(key:, value:)
    config = InstallationConfig.find_or_initialize_by(name: key)
    config.value = value
    config.locked = true
    config.save!
  end

  def reconcile_premium_config_and_features
    # Chambeabot: never reconcile premium config when self-hosted —
    # the reconciles downgrades features based on the hub's "community"
    # verdict, which is wrong for a self-hosted Chambeabot install.
    return if chambeabot_instance?

    Internal::ReconcilePlanConfigService.new.perform
  end

  def chambeabot_instance?
    return true if ENV['CW_EDITION'].to_s.downcase.include?('chambeabot')
    return true if ENV['FRONTEND_URL'].to_s.include?('chambeabot.com')

    false
  end
end
