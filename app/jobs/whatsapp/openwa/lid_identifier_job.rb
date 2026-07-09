class Whatsapp::Openwa::LidIdentifierJob < ApplicationJob
  queue_as :default

  def perform(inbox_id:, phone:, raw_chat_id:)
    inbox = Inbox.find_by(id: inbox_id)
    return if inbox.blank?

    contact = inbox.contacts.find_by(phone_number: "+#{phone}")
    return if contact.blank?

    current = contact.additional_attributes || {}
    return if current['openwa_chat_id'] == raw_chat_id

    current['openwa_chat_id'] = raw_chat_id
    social_profiles = current['social_profiles'] || {}
    social_profiles['whatsapp'] = raw_chat_id
    current['social_profiles'] = social_profiles

    contact.update!(additional_attributes: current)
  end
end