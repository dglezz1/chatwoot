# Disable email confirmation requirement on signup (Devise :confirmable).
# Without SMTP configured (Railway deploys), users would otherwise be locked out.
Rails.application.config.to_prepare do
  Devise.allow_unconfirmed_access_for = nil
end
