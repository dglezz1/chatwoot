Rails.application.configure do
  #########################################
  # Configuration Related to Action Mailer
  #########################################

  # We need the application frontend url to be used in our emails
  config.action_mailer.default_url_options = { host: ENV['FRONTEND_URL'] } if ENV['FRONTEND_URL'].present?
  # We load certain mailer templates from our database. This ensures changes to it is reflected immediately
  config.action_mailer.perform_caching = false
  config.action_mailer.perform_deliveries = true
  config.action_mailer.raise_delivery_errors = true

  # Config related to smtp
  smtp_settings = {
    address: ENV.fetch('SMTP_ADDRESS', 'localhost'),
    port: ENV.fetch('SMTP_PORT', 587)
  }

  smtp_settings[:authentication] = ENV.fetch('SMTP_AUTHENTICATION', 'login').to_sym if ENV['SMTP_AUTHENTICATION'].present?
  smtp_settings[:domain] = ENV['SMTP_DOMAIN'] if ENV['SMTP_DOMAIN'].present?
  smtp_settings[:user_name] = ENV.fetch('SMTP_USERNAME', nil)
  smtp_settings[:password] = ENV.fetch('SMTP_PASSWORD', nil)
  smtp_settings[:enable_starttls_auto] = ActiveModel::Type::Boolean.new.cast(ENV.fetch('SMTP_ENABLE_STARTTLS_AUTO', true))
  smtp_settings[:openssl_verify_mode] = ENV['SMTP_OPENSSL_VERIFY_MODE'] if ENV['SMTP_OPENSSL_VERIFY_MODE'].present?
  smtp_settings[:ssl] = ActiveModel::Type::Boolean.new.cast(ENV.fetch('SMTP_SSL', true)) if ENV['SMTP_SSL']
  smtp_settings[:tls] = ActiveModel::Type::Boolean.new.cast(ENV.fetch('SMTP_TLS', true)) if ENV['SMTP_TLS']
  smtp_settings[:open_timeout] = ENV['SMTP_OPEN_TIMEOUT'].to_i if ENV['SMTP_OPEN_TIMEOUT'].present?
  smtp_settings[:read_timeout] = ENV['SMTP_READ_TIMEOUT'].to_i if ENV['SMTP_READ_TIMEOUT'].present?

  # 1) MAILER_DELIVERY_METHOD=brevo  → Brevo HTTPS API  (port 443, recommended;
  #    300 emails/day free, unlimited domains, no credit card).
  # 2) MAILER_DELIVERY_METHOD=resend → Resend HTTPS API (port 443, fallback;
  #    3k/month free but only 1 domain on free tier).
  # 3) SMTP_ADDRESS present + no resend/brevo override → standard SMTP
  #    (only works on Railway Pro/Enterprise — Hobby blocks outbound 25/465/587).
  # 4) SMTP_ADDRESS blank → sendmail (local postfix).
  # 5) Dev with LETTER_OPENER → letter_opener (local file output).
  #
  # NB: the `config.action_mailer.*=` setters only mutate the OrderedOptions
  # hash. The ActionMailer railtie's `action_mailer.set_configs` initializer
  # runs before user initializers and iterates that hash via
  # `options.each { |k, v| send("#{k}=", v) }` to push values into
  # ActionMailer::Base. Setting `config.action_mailer.delivery_method = :resend`
  # from this initializer would normally be picked up on lazy load — but
  # `add_delivery_method` mutates ActionMailer::Base directly, which races
  # with the railtie's `on_load(:action_mailer)` block. To be safe, set
  # BOTH the OrderedOptions entry AND the ActionMailer::Base class attribute.

  if ENV['MAILER_DELIVERY_METHOD'] == 'brevo' && ENV['BREVO_API_KEY'].present?
    require Rails.root.join('lib', 'mail', 'brevo_delivery').to_s unless defined?(::Mail::BrevoDelivery)

    ActionMailer::Base.add_delivery_method(
      :brevo,
      ::Mail::BrevoDelivery,
      api_key: ENV.fetch('BREVO_API_KEY'),
      api_base: ENV.fetch('BREVO_API_BASE', 'https://api.brevo.com'),
      open_timeout: ENV.fetch('BREVO_OPEN_TIMEOUT', '5').to_i,
      read_timeout: ENV.fetch('BREVO_READ_TIMEOUT', '10').to_i,
      max_retries: ENV.fetch('BREVO_MAX_RETRIES', '1').to_i,
      from_override: ENV['MAILER_SENDER_EMAIL'].presence
    )

    config.action_mailer.delivery_method = :brevo
    ActionMailer::Base.delivery_method = :brevo
  elsif ENV['MAILER_DELIVERY_METHOD'] == 'resend' && ENV['RESEND_API_KEY'].present?
    require Rails.root.join('lib', 'mail', 'resend_delivery').to_s unless defined?(::Mail::ResendDelivery)

    ActionMailer::Base.add_delivery_method(
      :resend,
      ::Mail::ResendDelivery,
      api_key: ENV.fetch('RESEND_API_KEY'),
      api_base: ENV.fetch('RESEND_API_BASE', 'https://api.resend.com'),
      open_timeout: ENV.fetch('RESEND_OPEN_TIMEOUT', '5').to_i,
      read_timeout: ENV.fetch('RESEND_READ_TIMEOUT', '10').to_i,
      max_retries: ENV.fetch('RESEND_MAX_RETRIES', '1').to_i,
      from_override: ENV['MAILER_SENDER_EMAIL'].presence
    )

    config.action_mailer.delivery_method = :resend
    ActionMailer::Base.delivery_method = :resend
  elsif Rails.env.test?
    config.action_mailer.delivery_method = :test
    ActionMailer::Base.delivery_method = :test
  elsif ENV['SMTP_ADDRESS'].present?
    config.action_mailer.delivery_method = :smtp
    config.action_mailer.smtp_settings = smtp_settings
    ActionMailer::Base.delivery_method = :smtp
    ActionMailer::Base.smtp_settings = smtp_settings
  elsif Rails.env.development? && ENV['LETTER_OPENER']
    config.action_mailer.delivery_method = :letter_opener
    ActionMailer::Base.delivery_method = :letter_opener
  else
    config.action_mailer.delivery_method = :sendmail
    ActionMailer::Base.delivery_method = :sendmail
  end

  #########################################
  # Configuration Related to Action MailBox
  #########################################

  # Set this to appropriate ingress service for which the options are :
  # :relay for Exim, Postfix, Qmail
  # :mailgun for Mailgun
  # :mandrill for Mandrill
  # :postmark for Postmark
  # :sendgrid for Sendgrid
  # :ses for Amazon SES
  config.action_mailbox.ingress = ENV.fetch('RAILS_INBOUND_EMAIL_SERVICE', 'relay').to_sym

  # Amazon SES ActionMailbox configuration
  config.action_mailbox.ses.subscribed_topic = ENV['ACTION_MAILBOX_SES_SNS_TOPIC'] if ENV['ACTION_MAILBOX_SES_SNS_TOPIC'].present?
end
