class EnableCaptainFeaturesOnExistingAccounts < ActiveRecord::Migration[7.0]
  # Captain (captain_integration, captain_integration_v2, captain_v1_action_classifier,
  # captain_document_auto_sync, custom_tools) is gated by per-account feature flags.
  # By default they're `enabled: false` in config/features.yml. Pre-existing accounts
  # (created before the defaults flipped) need their feature_flags bitfield updated.
  #
  # This migration enables the Captain feature suite on every existing account so the
  # dashboard sidebar shows the Captain entrypoints (Settings → Captain, Assistant, etc.)
  # and the auto-reply pipeline is allowed to fire on assigned inboxes.
  def up
    return unless ActiveRecord::Base.connection.table_exists?(:accounts)

    flag_columns = %w[
      captain_integration
      captain_integration_v2
      captain_v1_action_classifier
      captain_document_auto_sync
      custom_tools
    ]

    Account.find_each do |account|
      flag_columns.each do |feature|
        next if account.feature_enabled?(feature)
        account.enable_features!(feature)
      end
    end
  end

  def down
    return unless ActiveRecord::Base.connection.table_exists?(:accounts)

    flag_columns = %w[
      captain_integration
      captain_integration_v2
      captain_v1_action_classifier
      captain_document_auto_sync
      custom_tools
    ]

    Account.find_each do |account|
      flag_columns.each do |feature|
        next unless account.feature_enabled?(feature)
        account.disable_features!(feature)
      end
    end
  end
end
