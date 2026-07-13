class EnableAllFeaturesForChambeabot < ActiveRecord::Migration[7.0]
  # The previous unlock migration (20260710190000) only flipped the
  # `premium` and `chatwoot_internal` features. Several
  # user-facing integrations were left disabled because their default
  # in features.yml is `enabled: false`:
  #
  #   - linear_integration          (Linear app integration)
  #   - notion_integration          (Notion app integration)
  #   - crm_integration             (CRM app integration)
  #   - whatsapp_campaign           (campaigns over WhatsApp)
  #   - whatsapp_embedded_signup    (Meta embedded signup - deprecated)
  #   - sla                         (SLA policies)
  #   - audit_logs                  (audit trail)
  #   - custom_roles                (per-account custom roles)
  #   - crm_v2                      (lead filter)
  #   - companies                   (companies on contacts - safe, no-op)
  #   - advanced_search             (time filter in search)
  #   - search_with_gin             (GIN full-text search)
  #   - advanced_search_indexing    (search indexer)
  #   - advanced_assignment         (assignment v2 rules)
  #   - csat_review_notes           (private notes on CSAT)
  #   - captain_document_auto_sync  (already on by default)
  #   - conversation_required_attributes
  #   - report_rollup
  #   - inbox_view                  (chatwoot_internal)
  #   - conversation_unread_counts  (chatwoot_internal)
  #
  # This migration enables ALL of them on existing accounts and on the
  # ACCOUNT_LEVEL_FEATURE_DEFAULTS registry so future accounts inherit
  # the same set.
  #
  # Skipped intentionally:
  #   - channel_voice (premium voice — would require Twilio + carrier setup;
  #     enabling the flag would show the "Voice" menu entry with no real
  #     wiring). Defer until the user adds Twilio.
  #   - reply_mailer_migration (chatwoot_internal migration flag, only
  #     useful while migrating the email builder; not user-facing).
  #   - quoted_email_reply, message_reply_to, insert_article_in_reply,
  #     whatsapp_embedded_signup — all marked deprecated in features.yml.
  #   - ip_lookup, custom_reply_email, custom_reply_domain — require
  #     third-party service configuration (IPinfo / Postmark / Mailgun)
  #     before they are useful; enable separately when those are wired.
  #   - disable_branding — leave OFF. Chambeabot branding is intentional.
  def up
    enable_account_level_defaults
    apply_to_existing_accounts
  end

  def down
    # Idempotent — leave the registry intact. Re-running up() re-applies.
  end

  private

  ENABLED_EXTRA_FEATURES = %w[
    linear_integration
    notion_integration
    crm_integration
    whatsapp_campaign
    sla
    audit_logs
    custom_roles
    crm_v2
    companies
    advanced_search
    search_with_gin
    advanced_search_indexing
    advanced_assignment
    csat_review_notes
    conversation_required_attributes
    report_rollup
    inbox_view
    conversation_unread_counts
  ].freeze

  def enable_account_level_defaults
    config = InstallationConfig.find_or_initialize_by(name: 'ACCOUNT_LEVEL_FEATURE_DEFAULTS')
    existing = Array(config.value)
    existing_names = existing.map { |f| f['name'] || f[:name] }

    ENABLED_EXTRA_FEATURES.each do |feature|
      next if existing_names.include?(feature)

      existing << { 'name' => feature, 'enabled' => true }
    end

    config.value = existing
    config.locked = false
    config.save!
    Rails.logger.info "[enable_all_features] ACCOUNT_LEVEL_FEATURE_DEFAULTS now lists #{existing.size} features"
  end

  def apply_to_existing_accounts
    Account.find_each do |account|
      ENABLED_EXTRA_FEATURES.each do |feature|
        next if account.feature_enabled?(feature)

        account.enable_features!(feature)
      end
    end
    Rails.logger.info "[enable_all_features] applied to #{Account.count} account(s)"
  end
end
