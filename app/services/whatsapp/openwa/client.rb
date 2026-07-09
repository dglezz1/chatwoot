module Whatsapp
  module Openwa
    # Thin wrapper around the OpenWA REST API. Used by the QR controller
    # + dashboard widget inside Chatwoot.
    #
    # Reads OPENWA_API_KEY + OPENWA_API_BASE_URL from the channel's
    # provider_config so each channel can point at its own OpenWA host.
    class Client
      class Error < StandardError; end

      SESSION_BASE = '/api/sessions'.freeze

      def initialize(api_base_url:, api_key:, session_id:)
        @api_base_url = api_base_url.to_s.sub(%r{/\z}, '')
        @api_key = api_key
        @session_id = session_id
      end

      # GET /api/sessions/{id} → returns full session JSON
      def session
        get("#{SESSION_BASE}/#{@session_id}")
      end

      # POST /api/sessions/{id}/start → returns {"status": "initializing", ...}
      def start!
        post("#{SESSION_BASE}/#{@session_id}/start")
      end

      # POST /api/sessions/{id}/stop → returns {"status": "stopped", ...}
      def stop!
        post("#{SESSION_BASE}/#{@session_id}/stop")
      end

      # GET /api/sessions/{id}/qr → returns {"qrCode": "data:image/png;base64,..."}
      # Returns nil if the session is already authenticated (no QR needed).
      def qr
        get("#{SESSION_BASE}/#{@session_id}/qr")
      rescue Error => e
        # 400 from OpenWA when session is already authenticated
        return nil if e.message.include?('already authenticated')

        raise
      end

      # Fetch health snapshot for the UI status pill.
      def status
        {
          session_id: @session_id,
          name: session['name'],
          status: session['status'],
          phone: session['phone'],
          connected_at: session['connectedAt'] || session['connected_at'],
        }
      rescue Error
        { session_id: @session_id, status: 'unreachable' }
      end

      # GET /api/sessions/{sessionId}/contacts/{chatId}/profile-picture
      # OpenWA returns { "url": "https://pps.whatsapp.net/v/t61..." } which
      # is a publicly-hosted Meta CDN URL. SafeFetch can fetch that directly.
      # Returns nil for groups / no-pic-set / not-found / etc.
      def profile_picture_url(chat_id)
        encoded = chat_id.to_s
        path = "#{SESSION_BASE}/#{@session_id}/contacts/#{CGI.escape(encoded)}/profile-picture"
        result = get(path)
        return nil if result.nil?

        result['url'].presence
      rescue Error
        # 404 / 500 from OpenWA when no pic exists — silent fail
        nil
      end

      private

      def get(path)
        request(:get, path)
      end

      def post(path)
        request(:post, path)
      end

      def request(method, path)
        require 'net/http'
        require 'uri'
        require 'cgi'
        require 'json'

        uri = URI.join("#{@api_base_url}/", path.sub(%r{\A/}, ''))
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = uri.scheme == 'https'
        http.open_timeout = 5
        http.read_timeout = 30

        req =
          case method
          when :get  then Net::HTTP::Get.new(uri.request_uri)
          when :post then Net::HTTP::Post.new(uri.request_uri)
          else raise ArgumentError, "unsupported method #{method}"
          end
        req['X-Api-Key'] = @api_key
        req['Content-Type'] = 'application/json' if method == :post

        res = http.request(req)
        body = res.body.to_s
        parsed = body.empty? ? {} : JSON.parse(body)

        if res.code.to_i >= 400
          raise Error, "#{res.code} #{method.upcase} #{path}: #{parsed['message'] || body[0, 200]}"
        end

        parsed
      end
    end
  end
end
