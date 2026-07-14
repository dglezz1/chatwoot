class OperatorAgent::ResponseJob < ApplicationJob
  queue_as :default

  def perform(message_id:)
    message = OperatorAgent::Message.find_by(id: message_id)
    return unless message
    return if message.role != 'user' # guard: only respond to user messages
    return if message.status != 'complete' # already processed

    thread = message.thread
    executor = OperatorAgent::Executor.new(thread: thread, user_message: message.content)
    executor.perform
  rescue StandardError => e
    Rails.logger.error "[OperatorAgent::ResponseJob] error: #{e.class.name}: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    ChatwootExceptionTracker.new(e, account: message&.thread&.account).capture_exception

    message&.update(status: 'failed', error: e.message)
    raise
  end
end
