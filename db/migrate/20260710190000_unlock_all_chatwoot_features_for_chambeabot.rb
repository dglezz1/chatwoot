class UnlockAllChatwootFeaturesForChambeabot < ActiveRecord::Migration[7.0]
  # Unlocks the entire Chatwoot OSS + Enterprise feature surface on the
  # Chambeabot single-tenant deploy. Self-hosted single-tenant install
  # already has `IS_ENTERPRISE: true` in globalConfig and the captain
  # listener loaded. This migration ensures every premium feature
  # (premium: true in features.yml) and every chatwoot-internal feature
  # defaults to enabled, both for the current account and for any future
  # accounts created on this instance.
  #
  # Two prongs:
  #   1. ACCOUNT_LEVEL_FEATURE_DEFAULTS (jsonb in installation_configs) →
  #      read by Featurable#enable_default_features on Account#create.
  #   2. Direct Account#enable_features! on every existing account.
  def up
    enable_account_level_defaults
    apply_to_existing_accounts
    seed_branding_and_installation_settings
    ensure_inbound_email_settings_present
  end

  def down
    # Idempotent — leave the registry intact. Re-running up() re-applies.
  end

  private

  def enable_account_level_defaults
    features = YAML.safe_load(Rails.root.join('config/features.yml').read)
    enabled = features.select { |f| f['enabled'] == true }.map { |f| f['name'] }

    # Also flip the premium + chatwoot-internal features that the JSON
    # default does not enable. We do this both for the per-account default
    # registry (new accounts inherit) and for existing accounts below.
    enabled |= features
                 .select { |f| f['premium'] || f['chatwoot_internal'] }
                 .map { |f| f['name'] }

    config = InstallationConfig.find_or_initialize_by(name: 'ACCOUNT_LEVEL_FEATURE_DEFAULTS')
    config.value = enabled.uniq.map { |name| { 'name' => name, 'enabled' => true } }
    config.locked = false
    config.save!
    Rails.logger.info "[unlock_features] ACCOUNT_LEVEL_FEATURE_DEFAULTS set to #{enabled.uniq.size} features"
  end

  def apply_to_existing_accounts
    features = YAML.safe_load(Rails.root.join('config/features.yml').read)
    feature_names = features
                      .select { |f| f['premium'] || f['chatwoot_internal'] }
                      .map { |f| f['name'] }

    Account.find_each do |account|
      # Use the same enable_features! path the new-account hook uses, so
      # the FlagShihTzu bit field is updated exactly the same way.
      feature_names.each do |feature|
        next if account.feature_enabled?(feature)
        account.enable_features!(feature)
      end
    end
    Rails.logger.info "[unlock_features] applied to #{Account.count} account(s)"
  end

  # Apply branding + superadmin-facing installation_config keys so the
  # super_admin dashboard Settings page stops nagging the operator.
  def seed_branding_and_installation_settings
    upsert_config('INSTALLATION_NAME',          'Chambeabot', locked: false)
    upsert_config('BRAND_NAME',                 'Chambeabot', locked: false)
    upsert_config('BRAND_URL',                  'https://chambeabot.com', locked: false)
    upsert_config('WIDGET_BRAND_URL',           'https://chambeabot.com', locked: false)
    upsert_config('TERMS_URL',                  'https://chambeabot.com/terms', locked: false)
    upsert_config('PRIVACY_URL',                'https://chambeabot.com/privacy', locked: false)
    upsert_config('LOGO',                       '/brand-assets/logo.svg', locked: false)
    upsert_config('LOGO_THUMBNAIL',            '/brand-assets/logo_thumbnail.svg', locked: false)
    upsert_config('LOGO_DARK',                  '/brand-assets/logo_dark.svg', locked: false)
    upsert_config('DISPLAY_MANIFEST',           true, locked: false)

    upsert_config('ENABLE_ACCOUNT_SIGNUP',             true, locked: false)
    upsert_config('CREATE_NEW_ACCOUNT_FROM_DASHBOARD', false, locked: false)
    upsert_config('DISABLE_USER_PROFILE_UPDATE',       false, locked: false)
    upsert_config('DISABLE_BRANDING',                  false, locked: false)

    # Marketing — used by the public API and landing pages
    upsert_config('CHATWOOT_INSTANCE_ADMIN_EMAIL', 'david@dglezz.com', locked: false)
    upsert_config('MAILER_SUPPORT_EMAIL',         'soporte@chambeabot.com', locked: false)
    upsert_config('MAILER_INBOUND_EMAIL_DOMAIN',  'chambeabot.com', locked: false)

    # Captain quotas — generous defaults for self-hosted
    upsert_config('ACCOUNT_EMAILS_LIMIT', 10_000, locked: false)
    upsert_config('MAXIMUM_FILE_UPLOAD_SIZE', 40, locked: false)
    upsert_config('DIRECT_UPLOADS_ENABLED', false, locked: false)
  end

  # Make sure inbound email routing has somewhere to land even before SMTP
  # is fully configured; this is the parent-domain of the `support+<id>@
  # chambeabot.com` address Cloudflare Email Routing will forward.
  def ensure_inbound_email_settings_present
    return unless InstallationConfig.find_by(name: 'MAILER_INBOUND_EMAIL_DOMAIN').blank?

    upsert_config('MAILER_INBOUND_EMAIL_DOMAIN', 'chambeabot.com', locked: false)
  end

  def upsert_config(name, value, locked: false)
    config = InstallationConfig.find_or_initialize_by(name: name)
    config.value = value
    config.locked = locked
    config.save!
  end
end
