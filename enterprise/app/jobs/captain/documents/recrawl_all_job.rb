class Captain::Documents::RecrawlAllJob < ApplicationJob
  queue_as :scheduled_jobs

  DEFAULT_BATCH_LIMIT = 200

  # Re-sync all syncable documents whose last_synced_at is older than `interval_hours`.
  # Designed to run daily from cron — picks up URL content changes between runs.
  #
  # Usage:
  #   Captain::Documents::RecrawlAllJob.perform_later(interval_hours: 24, batch_limit: 200)
  def perform(interval_hours: 24, batch_limit: DEFAULT_BATCH_LIMIT)
    cutoff = interval_hours.hours.ago
    enqueued = 0

    Captain::Document
      .syncable
      .where(status: :available)
      .where('last_synced_at IS NULL OR last_synced_at < ?', cutoff)
      .order(Arel.sql('last_synced_at ASC NULLS FIRST'))
      .limit(batch_limit)
      .find_each do |doc|
        # Skip if a sync is already in progress (avoid double-processing)
        next if doc.sync_syncing?

        doc.update!(
          sync_status: :syncing,
          sync_step: nil,
          last_sync_error_code: nil,
          last_sync_attempted_at: Time.current
        )
        Captain::Documents::PerformSyncJob.perform_later(doc)
        enqueued += 1
      end

    Rails.logger.info(
      "[Captain::Documents::RecrawlAllJob] enqueued=#{enqueued} interval_hours=#{interval_hours}"
    )
    enqueued
  end
end