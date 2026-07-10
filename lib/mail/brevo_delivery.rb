# frozen_string_literal: true

# Custom ActionMailer delivery method that delivers via the Brevo (formerly
# Sendinblue) HTTPS API. Bypasses Railway's outbound SMTP port block (which
# affects Hobby / Trial plans) — see
# https://docs.railway.com/networking/outbound-networking#email-delivery
#
# Activate by setting `MAILER_DELIVERY_METHOD=brevo` and `BREVO_API_KEY=...`
# in the environment.
#
# Docs: https://developers.brevo.com/reference/send-transac-email
#       POST https://api.brevo.com/v3/smtp/email
#       Header: `api-key: <key>` (NOT `Authorization: Bearer …` like Resend)
module Mail
  class BrevoDelivery
    attr_accessor :settings

    def initialize(values = {})
      @settings = {
        api_key: nil,
        api_base: 'https://api.brevo.com',
        open_timeout: 5,
        read_timeout: 10,
        max_retries: 1,
        from_override: nil
      }.merge(values.to_h)
    end

    def deliver!(mail)
      payload = build_payload(mail)
      response = post_with_retries(payload)
      if response.is_a?(Net::HTTPSuccess)
        response_object = JSON.parse(response.body)
        Rails.logger.info(
          "[BrevoDelivery] Delivered email messageId=#{response_object['messageId']} " \
            "subject=#{mail.subject.inspect} to=#{Array(mail.to).inspect}"
        )
        response_object
      else
        body = response.body.to_s
        Rails.logger.error("[BrevoDelivery] API error status=#{response.code} body=#{body}")
        raise Net::ProtocolError, "Brevo API returned #{response.code}: #{body}"
      end
    end

    private

    def build_payload(mail)
      payload = {
        sender: extract_sender(mail),
        to: extract_recipients(mail.to)
      }
      payload[:subject] = mail.subject.to_s if mail.subject.present?

      payload[:cc] = extract_recipients(mail.cc) if Array(mail.cc).any?
      payload[:bcc] = extract_recipients(mail.bcc) if Array(mail.bcc).any?
      payload[:replyTo] = extract_reply_to(mail.reply_to) if Array(mail.reply_to).any?

      payload[:htmlContent] = collect_html_part(mail) if (collect_html_part(mail))
      payload[:textContent] = collect_text_part(mail) if (collect_text_part(mail))
      payload[:textContent] ||= strip_html(mail.body.decoded) unless payload[:htmlContent].present?

      attachments = collect_attachments(mail)
      payload[:attachment] = attachments if attachments.any?

      payload
    end

    def extract_sender(mail)
      # from_override (set via MAILER_SENDER_EMAIL) is the canonical Chambeabot
      # sender; otherwise use the message's envelope from.
      if @settings[:from_override].present?
        split_address(@settings[:from_override])
      elsif mail.from.present?
        from_addr = Array(mail.from).first
        from_name = mail[:from].display_names.first
        { email: from_addr, name: from_name }.compact
      else
        { email: 'noreply@chambeabot.com' }
      end
    end

    # Brevo expects `to`, `cc`, `bcc` as arrays of `{email, name}` objects
    def extract_recipients(addr_list)
      Array(addr_list).map { |entry| split_address(entry) }
    end

    def extract_reply_to(addr_list)
      # replyTo is a single object, not an array
      entry = Array(addr_list).first
      return nil unless entry

      split_address(entry)
    end

    # "Chambeabot <hola@chambeabot.com>" → {name: "Chambeabot", email: "hola@chambeabot.com"}
    # "hola@chambeabot.com" → {email: "hola@chambeabot.com"}
    def split_address(value)
      if value.is_a?(Mail::Address)
        { email: value.address, name: value.display_name.presence }.compact
      else
        str = value.to_s.strip
        if str =~ /\A(.+?)\s*<(.+@.+?)>\z/
          { email: Regexp.last_match(2), name: Regexp.last_match(1).strip.tr('"', '') }.compact
        else
          { email: str }
        end
      end
    end

    def collect_html_part(mail)
      if mail.html_part
        mail.html_part.body.decoded
      elsif mail.content_type&.include?('text/html')
        mail.body.decoded
      end
    rescue StandardError
      nil
    end

    def collect_text_part(mail)
      return nil unless mail.multipart?
      return nil unless mail.text_part

      mail.text_part.body.decoded
    rescue StandardError
      nil
    end

    def strip_html(html)
      ActionController::Base.helpers.strip_tags(html.to_s).strip
    rescue StandardError
      html.to_s
    end

    def collect_attachments(mail)
      return [] unless mail.attachments&.any?

      mail.attachments.map do |att|
        {
          name: att.filename,
          content: Base64.strict_encode64(att.body.decoded)
        }
      end
    end

    def post_with_retries(payload)
      attempts = 0
      begin
        attempts += 1
        post_once(payload)
      rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNRESET, Errno::EHOSTUNREACH,
             OpenSSL::SSL::SSLError => e
        retry if attempts <= @settings[:max_retries].to_i

        Rails.logger.error("[BrevoDelivery] Giving up after #{attempts} attempts: #{e.class}: #{e.message}")
        raise
      end
    end

    def post_once(payload)
      uri = URI.parse("#{@settings[:api_base]}/v3/smtp/email")
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == 'https'
      http.open_timeout = @settings[:open_timeout].to_i
      http.read_timeout = @settings[:read_timeout].to_i

      request = Net::HTTP::Post.new(uri.request_uri)
      request['api-key'] = @settings[:api_key].to_s
      request['Content-Type'] = 'application/json'
      request['Accept'] = 'application/json'
      request['User-Agent'] = "chambeabot-chatwoot/#{Rails.application.class.module_parent_name rescue 'chatwoot'} (Rails #{Rails.version})"
      request.body = JSON.generate(payload)

      http.request(request)
    end
  end
end
