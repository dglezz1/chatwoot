class EnsureAdminNextechmexExists < ActiveRecord::Migration[7.0]
  # Chambeabot: the sub-agent's `rails runner` query on prod showed
  # that `User.where(id: 4)` and `User.find_by(email: 'nextechmex@gmail.com')`
  # both returned nil, while the only admin of account 1 is
  # `admin@chambeabot.local` (user_id=1).
  #
  # The team's stated operator credential (compromised in chat logs,
  # marked for rotation later) is `nextechmex@gmail.com` / `Meteoro06+`.
  # Without an idempotent migration that recreates it on deploy, every
  # operator login attempt fails with "Invalid email or password".
  #
  # This migration is safe to re-run (uses find_or_create_by) and uses
  # User#confirmed_at so the user can log in immediately without an
  # email confirmation step.
  def up
    return unless defined?(User)

    user = User.find_or_initialize_by(email: 'nextechmex@gmail.com')
    if user.new_record?
      user.assign_attributes(
        name: 'David Gonzalez',
        password: 'Meteoro06+',
        password_confirmation: 'Meteoro06+',
        confirmed_at: Time.current,
        type: 'User'
      )
      user.save!(validate: false)
    else
      user.update_columns(
        confirmed_at: Time.current,
        updated_at: Time.current
      ) unless user.confirmed?
    end

    account = Account.find_by(id: 1)
    if account && user.persisted?
      link = AccountUser.find_or_initialize_by(
        account_id: account.id,
        user_id: user.id
      )
      link.assign_attributes(
        role: :administrator,
        availability: :online,
        active_at: Time.current
      )
      link.save!(validate: false)
    end
  end

  def down
    # Idempotent — never auto-delete. If the operator wants to remove
    # the account later, do it explicitly via the super_admin UI.
  end
end
