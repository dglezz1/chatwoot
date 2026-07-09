module Whatsapp
  module Openwa
    # Syncs the OpenWA contact's profile picture to Chatwoot after a message
    # is received. OpenWA does NOT include the profile pic URL in the
    # webhook payload — we have to call
    # `GET /api/sessions/{id}/contacts/{chat_id}/profile-picture` which
    # returns the canonical `pps.whatsapp.net` URL. Then we hand off to
    # Chatwoot's standard `Avatar::AvatarFromUrlJob` which uses SafeFetch
    # to download + attach the image through ActiveStorage.
    #
    # Rate-limit + dedup is left to AvatarFromUrlJob (it hashes the URL
    # and skips duplicates within a 1-minute window).
    class AvatarSyncJob < ApplicationJob
      queue_as :default

      MAX_RETRIES = 2

      def perform(inbox_id:, phone:, chat_id:)
        inbox = Inbox.find_by(id: inbox_id)
        return if inbox.blank?

        channel = inbox.channel
        return unless channel.is_a?(Channel::Whatsapp) && channel.provider == 'openwa'

        client = Whatsapp::Openwa::Client.new(
          api_base_url: channel.provider_config['api_base_url'],
          api_key: channel.provider_config['api_key'],
          session_id: channel.provider_config['session_id']
        )

        pic_url = client.profile_picture_url(chat_id)
        return if pic_url.blank?

        contact = inbox.contacts.find_by(phone_number: "+#{phone}")
        return if contact.blank?

        # Skip if contact already has an avatar (cheap upsert guard).
        return if contact.avatar.attached?

        Avatar::AvatarFromUrlJob.perform_later(contact, pic_url)

        Rails.logger.info "[OPENWA] Queued avatar download for contact=#{contact.id} chat_id=#{chat_id}"
      rescue Whatsapp::Openwa::Client::Error => e
        Rails.logger.warn "[OPENWA] AvatarSyncJob error: #{e.message}"
        # Re-raise only on transient errors so Sidekiq retries
        raise if e.message.include?('timeout') || e.message.include?('5')
      end
    end
  end
end
