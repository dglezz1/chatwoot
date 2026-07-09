# backfill-openwa-lids.rb — Backfill `additional_attributes.openwa_chat_id`
# for existing contacts whose source_id is an OpenWA-derived LID, not a
# real phone number.
#
# Run this ONCE after deploying the OpenWA integration on a database that
# already has contacts. Subsequent incoming messages will fill the field
# automatically via Whatsapp::Openwa::LidIdentifierJob.
#
# Usage:
#   docker cp bin/backfill-openwa-lids.rb chatwoot-rails-1:/app/bin/
#   docker exec chatwoot-rails-1 bundle exec rails runner /app/bin/backfill-openwa-lids.rb
#
# The script is idempotent — re-running won't overwrite existing values.

require 'net/http'
require 'uri'
require 'json'

SESSION_NAME = ENV.fetch('OPENWA_SESSION_NAME', 'chatwoot-main')
API_BASE     = ENV.fetch('OPENWA_API_BASE_URL', 'http://openwa:2785')
API_KEY      = ENV.fetch('OPENWA_API_KEY', '')

# ---------- 1. Find session id ----------
session_id = ENV['OPENWA_SESSION_ID']
unless session_id
  uri = URI.parse("#{API_BASE}/api/sessions")
  req = Net::HTTP::Get.new(uri, 'X-Api-Key' => API_KEY)
  begin
    res = Net::HTTP.start(uri.hostname, uri.port) { |h| h.request(req) }
    sessions = JSON.parse(res.body) rescue []
    match = sessions.find { |s| s['name'] == SESSION_NAME }
    session_id = match && match['id']
  rescue StandardError => e
    warn "Could not query OpenWA sessions: #{e.message}"
  end
end

if session_id.nil?
  warn 'No OpenWA session id available; running without contact map (will only normalize existing data).'
end

# ---------- 2. Build { phone_digits => best_chat_id } map from OpenWA contacts ----------
chat_id_map = {}
if session_id
  uri = URI.parse("#{API_BASE}/api/sessions/#{session_id}/contacts")
  req = Net::HTTP::Get.new(uri, 'X-Api-Key' => API_KEY)
  begin
    res = Net::HTTP.start(uri.hostname, uri.port) { |h| h.request(req) }
    contacts = JSON.parse(res.body) rescue []
    contacts.each do |c|
      number  = c['number'].to_s.gsub(/\D/, '')
      chat_id = c['id']
      next if number.blank? || chat_id.blank?

      existing = chat_id_map[number]
      # Prefer @c.us (standard) over @lid for the same number
      if existing.nil? || (existing.end_with?('@lid') && chat_id.end_with?('@c.us'))
        chat_id_map[number] = chat_id
      end
    end
    puts "Loaded #{chat_id_map.size} chatId mappings from OpenWA"
  rescue StandardError => e
    warn "Failed to fetch OpenWA contacts: #{e.message}"
  end
end

# ---------- 3. Walk every contact and backfill ----------
backfilled   = 0
already_set  = 0
unresolved   = 0
total_with_phone = 0

Contact.where.not(phone_number: [nil, '']).find_each do |contact|
  total_with_phone += 1
  attrs  = contact.additional_attributes || {}
  stored = attrs['openwa_chat_id']

  if stored.is_a?(String) && stored.include?('@')
    already_set += 1
    next
  end

  digits   = contact.phone_number.to_s.gsub(/\D/, '')
  chat_id  = chat_id_map[digits]

  if chat_id.nil?
    unresolved += 1
    next
  end

  new_attrs = attrs.merge(
    'openwa_chat_id' => chat_id,
    'social_profiles' => (attrs['social_profiles'] || {}).merge('whatsapp' => chat_id)
  )
  contact.update!(additional_attributes: new_attrs)
  backfilled += 1
end

puts ''
puts '=== Backfill summary ==='
puts "  Contacts with phone_number     : #{total_with_phone}"
puts "  Already had openwa_chat_id     : #{already_set}"
puts "  Backfilled from OpenWA map     : #{backfilled}"
puts "  Unresolved (need incoming msg) : #{unresolved}"
puts ''
puts 'For unresolved contacts, send an incoming message from that contact — the'
puts 'LidIdentifierJob will persist the full chatId automatically.'