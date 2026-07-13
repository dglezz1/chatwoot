class Api::V1::Accounts::MigrateController < Api::V1::Accounts::BaseController
  # One-off migration trigger. POST /api/v1/accounts/:id/migrate/run
  # Runs db:migrate in the running process. Useful when preDeployCommand
  # hasn't run for whatever reason.
  before_action :ensure_administrator

  def run
    if Rails.env.production? && !ENV['ALLOW_RUNTIME_MIGRATION'].present?
      return render json: { error: 'Runtime migration disabled. Set ALLOW_RUNTIME_MIGRATION=1 to enable.' },
                    status: :forbidden
    end

    before_version = ActiveRecord::Migrator.current_version rescue 0
    ActiveRecord::Migration.verbose = true
    ActiveRecord::Tasks::DatabaseTasks.migrate
    after_version = ActiveRecord::Migrator.current_version rescue 0

    render json: { before: before_version, after: after_version, status: 'ok' }
  rescue StandardError => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

  def ensure_administrator
    return if @current_user&.administrator?
    render json: { error: 'Administrator privileges required' }, status: :forbidden
  end
end
