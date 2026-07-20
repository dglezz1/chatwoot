class RestoreChambeabotBranding < ActiveRecord::Migration[7.0]
  # Chambeabot: the daily Enterprise::Internal::CheckNewVersionsJob, when
  # the hub returned plan='community', ran Internal::ReconcilePlanConfigService
  # which reset the installation branding back to the upstream "Chatwoot"
  # defaults. With the check-job guard in place (commit 08bb3bf) the plan
  # downgrade no longer happens, but the *current* InstallationConfig rows
  # still hold the overwritten values. This migration re-applies the
  # Chambeabot branding that the ffefcaf migration seeded.
  def up
    upsert_config('INSTALLATION_NAME',  'Chambeabot',           locked: false)
    upsert_config('BRAND_NAME',         'Chambeabot',           locked: false)
    upsert_config('BRAND_URL',          'https://chambeabot.com', locked: false)
    upsert_config('WIDGET_BRAND_URL',   'https://chambeabot.com', locked: false)
    upsert_config('TERMS_URL',          'https://chambeabot.com/terms',    locked: false)
    upsert_config('PRIVACY_URL',        'https://chambeabot.com/privacy',  locked: false)
    upsert_config('LOGO',               '/brand-assets/logo.svg',           locked: false)
    upsert_config('LOGO_THUMBNAIL',     '/brand-assets/logo_thumbnail.svg', locked: false)
    upsert_config('LOGO_DARK',          '/brand-assets/logo_dark.svg',      locked: false)
    upsert_config('DISPLAY_MANIFEST',   true, locked: false)

    GlobalConfig.clear_cache if defined?(GlobalConfig)
    Rails.cache.clear if defined?(Rails)
  end

  def down
    # Idempotent — re-running up() re-applies the brand.
  end

  private

  def upsert_config(name, value, locked: false)
    return unless defined?(InstallationConfig)

    c = InstallationConfig.find_or_initialize_by(name: name)
    c.value = value
    c.locked = locked
    c.save!
  end
end
