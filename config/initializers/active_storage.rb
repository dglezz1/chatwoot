# Allow audio attachments (call recordings, voice notes) to serve inline so the
# in-app <audio> player can stream them. Without this, ActiveStorage's blob model
# forces Content-Disposition: attachment for any MIME outside the default allowlist
# (images + PDF), which makes the browser download instead of play.
Rails.application.config.active_storage.content_types_allowed_inline += %w[
  audio/webm
  audio/ogg
  audio/mpeg
  audio/mp4
  audio/x-m4a
  audio/wav
  audio/x-wav
]

module ActiveStorageDirectUploadMetadataFilter
  INTERNAL_METADATA_KEYS = %w[identified analyzed composed].freeze

  private

  def blob_args
    super.tap do |args|
      args[:metadata]&.except!(*INTERNAL_METADATA_KEYS, *INTERNAL_METADATA_KEYS.map(&:to_sym))
    end
  end
end

module ActiveStorageProxyRangeLimit
  STREAMING_MAX_RANGES = 1
  STREAMING_CHUNK_MAX_SIZE = 100.megabytes

  private

  def send_blob_byte_range_data(blob, range_header, disposition: nil)
    ranges = Rack::Utils.get_byte_ranges(range_header, blob.byte_size)
    return head(:range_not_satisfiable) unless valid_ranges?(ranges)

    super
  end

  def valid_ranges?(ranges)
    ranges.present? &&
      ranges.any?(&:present?) &&
      ranges.length <= STREAMING_MAX_RANGES &&
      ranges.sum { |range| range.end - range.begin } < STREAMING_CHUNK_MAX_SIZE
  end
end

# Chambeabot: the upstream `ActiveStorage::Representations::BaseController`
# (`set_representation`) calls `@blob.representation(variation_key).processed`,
# which raises `ActiveStorage::FileNotFoundError` (Errno::ENOENT under the
# hood) when the underlying file is missing on disk. That's a 500 by default.
# With the new persistent Railway Volume mounted on /app/storage, *new* uploads
# survive redeploys — but *old* blobs whose files were created in the
# ephemeral container filesystem are now orphans. They show up in the
# dashboard (cached references from previous renders) and 500 on every load.
#
# Catch the FileNotFoundError and return 404 — the image just doesn't exist
# anymore, no point in surfacing a 500 to the user.
module ActiveStorageOrphanRepresentationFallback
  private

  def set_representation
    @representation = @blob.representation(params[:variation_key]).processed
  rescue ActiveSupport::MessageVerifier::InvalidSignature
    head :not_found
  rescue ActiveStorage::FileNotFoundError, Errno::ENOENT => e
    Rails.logger.warn "[ActiveStorage] Orphan representation for blob #{@blob&.key}: #{e.class}: #{e.message}"
    head :not_found
  end
end

Rails.application.config.to_prepare do
  unless ActiveStorage::DirectUploadsController < ActiveStorageDirectUploadMetadataFilter
    ActiveStorage::DirectUploadsController.prepend(ActiveStorageDirectUploadMetadataFilter)
  end

  ActiveStorage::Streaming.prepend(ActiveStorageProxyRangeLimit) unless ActiveStorage::Streaming < ActiveStorageProxyRangeLimit

  ActiveStorage::Representations::BaseController.prepend(ActiveStorageOrphanRepresentationFallback) \
    unless ActiveStorage::Representations::BaseController < ActiveStorageOrphanRepresentationFallback
end
