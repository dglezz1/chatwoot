require 'net/http'
require 'uri'
require 'json'

module Llm
  # Audio transcription for OpenAI-compatible providers.
  # Supports:
  #   - OpenAI: whisper-1, gpt-4o-mini-transcribe, gpt-4o-transcribe
  #   - MiniMax: MiniMax-asr-01
  #   - Groq: whisper-large-v3 (fast inference)
  #   - Together: whisper-large-v3
  #
  # Audio is sent as multipart/form-data to the /audio/transcriptions endpoint.
  # The OpenAI SDK is intentionally bypassed here because some providers
  # (notably MiniMax) need extra headers (e.g. GROUPId) that the SDK doesn't
  # expose. We use a thin Net::HTTP wrapper instead.
  class AudioTranscriptionService
    class TranscriptionError < StandardError; end

    MAX_FILE_SIZE = 25_000_000  # OpenAI's hard limit (decimal MB)

    def self.transcribe(attachment, account: nil)
      new(attachment, account: account).transcribe
    end

    def initialize(attachment, account: nil)
      @attachment = attachment
      @account = account
      @message = attachment.message
      @account ||= @message&.account
    end

    def transcribe
      return { error: 'Message not found' } if @message.blank?
      return { error: 'No audio file attached' } unless audio?
      return { error: 'Audio too large for transcription (>25 MB)' } if too_large?

      provider = Llm::AccountProviderResolver.resolve(
        feature: 'audio_transcription',
        account: @account
      )

      return { error: 'No LLM provider configured for audio transcription' } if provider[:api_key].blank?
      return { error: 'Provider does not support audio transcription' } unless provider[:capabilities]['audio_input'] == true || provider[:slug] == 'openai' || provider[:slug] == 'minimax'

      call_provider(provider)
    rescue StandardError => e
      Rails.logger.error "[Llm::AudioTranscription] failed: #{e.class.name}: #{e.message}"
      { error: e.message }
    end

    private

    def audio?
      @attachment.file_type.to_s == 'audio'
    end

    def too_large?
      blob = @attachment.file&.blob
      return false unless blob

      blob.byte_size > MAX_FILE_SIZE
    end

    def call_provider(provider)
      uri = URI.join("#{provider[:api_base]}/", 'audio/transcriptions')
      body = build_multipart_body(provider)

      response = post_multipart(uri, provider[:api_key], body)

      if response.code.to_i >= 400
        Rails.logger.warn "[Llm::AudioTranscription] #{provider[:slug]} returned #{response.code}: #{response.body[0, 200]}"
        return { error: "Transcription failed (#{response.code})" }
      end

      parsed = JSON.parse(response.body)
      text = parsed['text'] || parsed.dig('data', 'text') || parsed['transcription']

      { success: true, text: text, provider: provider[:slug], model: provider[:model] }
    end

    def build_multipart_body(provider)
      blob = @attachment.file.blob
      Tempfile.create(['audio', file_extension(blob)]) do |tempfile|
        blob.download { |chunk| tempfile.write(chunk) }
        tempfile.rewind

        # Build multipart body manually — Net::HTTP::MultipartPost is no
        # longer in stdlib in Ruby 3+, so we assemble the parts ourselves.
        boundary = "----LLM-AUDIO-#{SecureRandom.hex(8)}"
        body = build_multipart_payload(tempfile, boundary, provider)
        { body: body, boundary: boundary }
      end
    end

    def build_multipart_payload(tempfile, boundary, provider)
      parts = []
      file_content = tempfile.read
      tempfile.rewind

      parts << "--#{boundary}\r\n"
      parts << "Content-Disposition: form-data; name=\"file\"; filename=\"#{tempfile.basename}\"\r\n"
      parts << "Content-Type: #{audio_mime_type(file_content)}\r\n\r\n"
      parts << file_content
      parts << "\r\n"

      parts << "--#{boundary}\r\n"
      parts << "Content-Disposition: form-data; name=\"model\"\r\n\r\n"
      parts << "#{provider[:model]}\r\n"

      parts << "--#{boundary}\r\n"
      parts << "Content-Disposition: form-data; name=\"response_format\"\r\n\r\n"
      parts << "json\r\n"

      # MiniMax requires GROUPId in headers, not body. The Net::HTTP wrapper
      # below adds it.
      parts << "--#{boundary}--\r\n"
      parts.join.encode('ASCII-8BIT')
    end

    def file_extension(blob)
      ext = blob.content_type.to_s.split('/').last
      ext == 'mpeg' ? 'mp3' : ext
    end

    def audio_mime_type(content)
      # Best-effort detection — most providers accept audio/mpeg, audio/wav,
      # audio/ogg, audio/webm. Default to mpeg which is the most permissive.
      'audio/mpeg'
    end

    def post_multipart(uri, api_key, body_data)
      Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') do |http|
        request = Net::HTTP::Post.new(uri.request_uri)
        request['Authorization'] = "Bearer #{api_key}"
        request['Content-Type'] = "multipart/form-data; boundary=#{body_data[:boundary]}"
        # MiniMax provider requires the GROUPId header on all requests.
        # Without it, the server returns 400.
        if uri.host.include?('minimaxi.com') || uri.host.include?('minimax.com')
          group_id = ENV['MINIMAX_GROUP_ID'].presence || InstallationConfig.find_by(name: 'MINIMAX_GROUP_ID')&.value
          request['GROUPId'] = group_id if group_id.present?
        end
        request.body = body_data[:body]
        http.request(request)
      end
    end
  end
end
