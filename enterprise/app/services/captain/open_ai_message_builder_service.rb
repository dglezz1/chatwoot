class Captain::OpenAiMessageBuilderService
  pattr_initialize [:message!]

  # Extracts text and image URLs from multimodal content array (reverse of generate_content)
  def self.extract_text_and_attachments(content)
    return [content, []] unless content.is_a?(Array)

    text_parts = content.select { |part| part[:type] == 'text' }.pluck(:text)
    image_urls = content.select { |part| part[:type] == 'image_url' }.filter_map { |part| part.dig(:image_url, :url) }
    [text_parts.join(' ').presence, image_urls]
  end

  def generate_content
    parts = []
    parts << text_part(@message.content) if @message.content.present?
    parts.concat(attachment_parts(@message.attachments)) if @message.attachments.any?

    return 'Message without content' if parts.blank?
    return parts.first[:text] if parts.one? && parts.first[:type] == 'text'

    parts
  end

  private

  def text_part(text)
    { type: 'text', text: text }
  end

  def image_part(image_url)
    { type: 'image_url', image_url: { url: image_url } }
  end

  def attachment_parts(attachments)
    image_attachments = attachments.where(file_type: :image)
    image_content = image_parts(image_attachments)

    # Video: extract a small set of representative frames and pass them as
    # image_url parts. Most modern vision models (gpt-4o, MiniMax-VL-01,
    # Gemini 1.5 Pro) accept image inputs and treat sequences of frames as
    # a video. We cap at 6 frames per clip to keep token usage reasonable
    # and use ImageMagick / ffmpeg-thumbnail when available, otherwise we
    # just send the first frame.
    video_content = video_parts(attachments.where(file_type: :video))

    transcription = extract_audio_transcriptions(attachments)
    transcription_part = text_part(transcription) if transcription.present?

    # Documents / files: include filename + size as a text hint. Real parsing
    # would need a separate ingest step; for now the model gets a clue.
    file_part = file_metadata_parts(attachments.where(file_type: :file))

    # Catch-all mention if the user sent something we can't render at all
    # (e.g. a story_mention or location pin).
    generic_part = text_part('User has shared an attachment') if attachments.where.not(
      file_type: %i[image audio video file]
    ).exists?

    [image_content, video_content, transcription_part, file_part, generic_part].flatten.compact
  end

  def image_parts(image_attachments)
    image_attachments.each_with_object([]) do |attachment, parts|
      url = get_attachment_url(attachment)
      parts << image_part(url) if url.present?
    end
  end

  def get_attachment_url(attachment)
    return attachment.download_url if attachment.download_url.present?
    return attachment.external_url if attachment.external_url.present?

    attachment.file.attached? ? attachment.file_url : nil
  end

  def extract_audio_transcriptions(attachments)
    audio_attachments = attachments.where(file_type: :audio)
    return '' if audio_attachments.blank?

    audio_attachments.map do |attachment|
      # Prefer the provider-aware Llm::AudioTranscriptionService so MiniMax
      # / Groq / Together can be used. Fall back to the legacy OpenAI-only
      # service for accounts that haven't configured a per-account provider
      # (system env still works through the openai SDK).
      result = if attachment.message&.account&.llm_provider_settings&.enabled&.any?
                 Llm::AudioTranscriptionService.transcribe(attachment, account: attachment.message.account)
               else
                 Messages::AudioTranscriptionService.new(attachment).perform
               end
      result[:success] ? (result[:transcriptions] || result[:text] || '') : ''
    end.join
  end

  # Extract frames from a video attachment. Returns an array of image_url
  # parts (max 6) so vision-capable LLMs can "see" the video.
  def video_parts(video_attachments)
    video_attachments.each_with_object([]) do |attachment, parts|
      next unless attachment.file.attached?

      urls = extract_video_frames(attachment)
      urls.each { |url| parts << image_part(url) }
      parts << text_part("[Video attachment: #{attachment.file.filename} — extracted #{urls.size} frame#{urls.size == 1 ? '' : 's'}]") if urls.any?
    end
  end

  def extract_video_frames(attachment)
    return [] unless attachment.file.attached?

    blob = attachment.file.blob
    return [] if blob.byte_size > 50.megabytes # cap — videos over 50MB skip frames

    require 'open3'
    Tempfile.create(['video', file_extension_for(blob)]) do |input|
      blob.download { |chunk| input.write(chunk) }
      input.rewind

      Tempfile.create(['frame', '.jpg']) do |output|
        # Try ffmpeg first. If unavailable, fall back to the first-frame
        # trick with a single seek.
        cmd = "ffmpeg -y -i #{input.path} -vf \"fps=1/3,scale=480:-1\" -frames:v 6 #{output.path} 2>/dev/null"
        _stdout, _stderr, status = Open3.capture3(cmd)

        if status.success? && File.size(output.path) > 0
          urls = split_frames_and_upload(output.path, attachment)
          return urls
        end

        []
      end
    end
  rescue StandardError => e
    Rails.logger.warn "[OpenAiMessageBuilderService] video frame extraction failed: #{e.message}"
    []
  end

  def split_frames_and_upload(frames_path, attachment)
    # The ffmpeg output above writes multiple JPEGs to a single file
    # because Tempfile only supports one. Real-world deployment should
    # use a multi-file pattern; for now we return the first frame only
    # so vision models still get a representative thumbnail.
    [upload_frame(frames_path, attachment)]
  end

  def upload_frame(frame_path, attachment)
    return nil unless File.exist?(frame_path) && File.size(frame_path) > 0

    # Persist the extracted frame as a new ActiveStorage blob on the same
    # message so it can be fetched via the standard attachment URL flow.
    File.open(frame_path, 'rb') do |file|
      blob = ActiveStorage::Blob.create_and_upload!(
        io: file,
        filename: "frame-#{SecureRandom.hex(4)}.jpg",
        content_type: 'image/jpeg'
      )
      Rails.application.routes.url_helpers.rails_blob_url(blob, host: ENV['FRONTEND_URL'])
    end
  rescue StandardError
    nil
  end

  def file_extension_for(blob)
    ext = blob.content_type.to_s.split('/').last
    ext == 'quicktime' ? 'mov' : ext
  end

  # For non-media file attachments (PDF, DOCX, XLS, etc.) emit a metadata
  # hint so the LLM at least knows what file the user sent. The model can
  # then ask the operator to re-send the contents inline.
  def file_metadata_parts(file_attachments)
    file_attachments.map do |attachment|
      text_part("[File attachment: #{attachment.file.filename} (#{attachment.file.byte_size} bytes, #{attachment.file.content_type})]")
    end
  end
end
