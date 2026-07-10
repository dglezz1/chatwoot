# frozen_string_literal: true

# Custom ActionMailer delivery method that delivers via the Resend HTTPS API
# (https://resend.com/docs/api-reference/emails/send-email). This bypasses
# Railway's outbound SMTP port block (25/465/587/2525) which affects Hobby
# and Trial plans — see https://docs.railway.com/networking/outbound-networking#email-delivery
#
# Switch on by setting `MAILER_DELIVERY_METHOD=resend` in the environment.
# Requires:
#   - RESEND_API_KEY (re_xxx)
#   - Optionally RESEND_API_BASE (defaults to https://api.resend.com)
#
# All other ActionMailer features (default_url_options, attachments, inline
# images, multiple recipients, reply-to) are supported because we translate the
# Mail::Message into the documented Resend request body.
module Mail
  class ResendDelivery
    attr_accessor :settings

    def initialize(values = {})
      @settings = {
        api_key: ENV.fetch('RESEND_API_KEY', nil),
        api_base: ENV.fetch('RESEND_API_BASE', 'https://api.resend.com'),
        open_timeout: ENV.fetch('RESEND_OPEN_TIMEOUT', '5').to_i,
        read_timeout: ENV.fetch('RESEND_READ_TIMEOUT', '10').to_i,
        max_retries: ENV.fetch('RESEND_MAX_RETRIES', '1').to_i,
        from_override: ENV['MAILER_SENDER_EMAIL'].presence
      }.merge(values)
    end

    def deliver!(mail)
      payload = build_payload(mail)
      response = post_with_retries(payload)
      if response.is_a?(Net::HTTPSuccess)
        # Resend returns { "id" => "..." } on success
        response_object = JSON.parse(response.body)
        Rails.logger.info(
          "[ResendDelivery] Delivered email id=#{response_object['id']} subject=#{mail.subject.inspect} " \
            "to=#{Array(mail.to).inspect}"
        )
        response_object
      else
        body = response.body.to_s
        Rails.logger.error("[ResendDelivery] API error status=#{response.code} body=#{body}")
        raise Net::ProtocolError, "Resend API returned #{response.code}: #{body}"
      end
    end

    private

    def build_payload(mail)
      payload = {
        from: extract_from(mail),
        to: extract_addresses(mail.to),
        subject: mail.subject.to_s
      }

      payload[:cc] = extract_addresses(mail.cc) if mail.cc&.any?
      payload[:bcc] = extract_addresses(mail.bcc) if mail.bcc&.any?
      payload[:reply_to] = extract_addresses(mail.reply_to) if mail.reply_to&.any?

      if (html = collect_html_part(mail))
        payload[:html] = html
      end

      if (text = collect_text_part(mail))
        payload[:text] = text
      end

      payload[:text] ||= strip_html(mail.body.decoded) unless payload[:html].present?

      # Attachments (Resend supports up to 40MB total via `attachments`)
      if (attachments = collect_attachments(mail)) && attachments.any?
        payload[:attachments] = attachments
      end

      # Custom headers (skip auto-added ones; keep only X- prefixed for safety)
      custom = extract_custom_headers(mail)
      payload[:headers] = custom if custom.any?

      payload
    end

    def extract_from(mail)
      # MAILER_SENDER_EMAIL is the canonical Chambeabot sender; otherwise use the
      # message's envelope from (which Rails sets via MAILER_SENDER_EMAIL too)
      if @settings[:from_override].present?
        @settings[:from_override]
      elsif mail.from&.any?
        # mail.from is an array; use the first with a friendly name if present
        from_addr = mail.from.first
        from_name = mail[:from].display_names.first
        from_name.present? ? "#{from_name} <#{from_addr}>" : from_addr
      else
        'noreply@chambeabot.com'
      end
    end

    def extract_addresses(addr_list)
      Array(addr_list).map do |entry|
        if entry.is_a?(Mail::Address)
          entry.format
        else
          # Strip any display name (Resend handles "Name <addr>" itself)
          entry.to_s
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

      if mail.text_part
        mail.text_part.body.decoded
      end
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
          filename: att.filename,
          content: Base64.strict_encode64(att.body.decoded)
          # Resend also supports `path` for URL-based attachments but we
          # stream inline since Chatwoot already has the file in memory.
        }
      end
    end

    # Headers Resend understands: https://resend.com/docs/api-reference/emails/send-email
    RESEND_HEADER_WHITELIST = %w[X-* Reply-To].freeze

    def extract_custom_headers(mail)
      mail.header_fields.each_with_object({}) do |field, acc|
        name = field.name.to_s
        next if %w[From To Cc Bcc Subject Date Message-ID MIME-Version Content-Type
                   Content-Transfer-Encoding Reply-To].include?(name)

        acc[name] = field.value.to_s if name.start_with?('X-')
      end
    end

    def post_with_retries(payload)
      attempts = 0
      begin
        attempts += 1
        post_once(payload)
      rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNRESET, Errno::EHOSTUNREACH,
             OpenSSL::SSL::SSLError => e
        retry if attempts <= @settings[:max_retries]

        Rails.logger.error("[ResendDelivery] Giving up after #{attempts} attempts: #{e.class}: #{e.message}")
        raise
      end
    end

    def post_once(payload)
      uri = URI.parse("#{@settings[:api_base]}/emails")
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == 'https'
      http.open_timeout = @settings[:open_timeout]
      http.read_timeout = @settings[:read_timeout]

      request = Net::HTTP::Post.new(uri.request_uri)
      request['Authorization'] = "Bearer #{@settings[:api_key]}"
      request['Content-Type'] = 'application/json'
      request['User-Agent'] = "chambeabot-chatwoot/#{Rails.application.class.module_parent_name rescue 'chatwoot'} (Rails #{Rails.version})"
      request.body = JSON.generate(payload)

      http.request(request)
    end
  end
end
