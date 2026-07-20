class ForceInstallationPricingPlanEnterprise < ActiveRecord::Migration[7.0]
  # Chambeabot: force INSTALLATION_PRICING_PLAN to 'enterprise' so
  # ChatwootApp.self_hosted_enterprise? returns true and the dashboard
  # exposes premium features (SAML, audit logs, SLA, custom roles,
  # captain integrations, etc).
  #
  # Why this is needed: the daily enterprise job
  # (Enterprise::Internal::CheckNewVersionsJob) pings hub.2.chatwoot.com
  # and overwrites INSTALLATION_PRICING_PLAN with whatever the hub
  # returns. For an unregistered self-hosted install the hub always
  # returns 'community', so the plan is silently downgraded every night.
  # A companion patch to that job (gated on CW_EDITION env) makes this
  # migration durable — without it, the plan would revert within 24h.
  def up
    %w[INSTALLATION_PRICING_PLAN INSTALLATION_PRICING_PLAN_QUANTITY].each do |name|
      c = InstallationConfig.find_or_initialize_by(name: name)
      c.value = (name == 'INSTALLATION_PRICING_PLAN') ? 'enterprise' : 100_000
      c.locked = true
      c.save!
    end

    # Mirror what the missing enterprise migration set on the account.
    # The reconcile-plan job, when it sees 'community', disables these
    # features. Re-enable them so a single check in the dashboard
    # doesn't show a paywall for an admin.
    if defined?(Account) && ActiveRecord::Base.connection.table_exists?('accounts')
      %w[disable_branding audit_logs sla custom_roles captain_integration
         captain_document_auto_sync csat_review_notes
         conversation_required_attributes].each do |f|
        next unless Account.respond_to?(:column_names) && Account.respond_to?(:find_each)

        Account.find_each do |a|
          a.enable_features!(f) if a.respond_to?(:enable_features!) && !a.feature_enabled?(f)
        end
      end
    end

    GlobalConfig.clear_cache if defined?(GlobalConfig)
    Rails.cache.clear if defined?(Rails)
  end

  def down
    # Idempotent — re-running up() restores 'enterprise'. We don't
    # downgrade on rollback because doing so would re-trigger the same
    # silent-downgrade bug the migration is meant to prevent.
  end
end
