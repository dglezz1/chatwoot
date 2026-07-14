# We are hooking config loader to run automatically everytime migration is executed
Rake::Task['db:migrate'].enhance do
  if ActiveRecord::Base.connection.table_exists? 'installation_configs'
    puts 'Loading Installation config'
    ConfigLoader.new.process
  end
end

# we are creating a custom database prepare task
# the default rake db:prepare task isn't ideal for environments like heroku
# In heroku the database is already created before the first run of db:prepare
# In this case rake db:prepare tries to run db:migrate from all the way back from the beginning
# Since the assumption is migrations are only run after schema load from a point x, this could lead to things breaking.
# ref: https://github.com/rails/rails/blob/main/activerecord/lib/active_record/railties/databases.rake#L356
db_namespace = namespace :db do
  desc 'Runs setup if database does not exist, or runs migrations if it does'
  task chatwoot_prepare: :load_config do
    # SKIP when running in Railway preDeploy contexts where the postgres
    # service is unreachable (DNS resolves only between runtime services,
    # not from the transient preDeploy job). Chambeabot runs migrations
    # via the runtime /api/v1/accounts/:id/migrate/run endpoint instead.
    if ENV['SKIP_DB_CHATWOOT_PREPARE'] == 'true'
      puts '[chatwoot_prepare] SKIP_DB_CHATWOOT_PREPARE=true — skipping'
      next
    end

    ActiveRecord::Base.configurations.configs_for(env_name: Rails.env).each do |db_config|
      ActiveRecord::Base.establish_connection(db_config.configuration_hash)
      unless ActiveRecord::Base.connection.table_exists? 'ar_internal_metadata'
        db_namespace['load_config'].invoke if ActiveRecord.schema_format == :ruby
        ActiveRecord::Tasks::DatabaseTasks.load_schema_current(:ruby, ENV.fetch('SCHEMA', nil))
        db_namespace['seed'].invoke
      end

      db_namespace['migrate'].invoke
    rescue ActiveRecord::NoDatabaseError
      db_namespace['setup'].invoke
    rescue StandardError => e
      # Don't crash the whole preDeploy command if the DB is unreachable.
      # We rely on the runtime /migrate/run endpoint for actual migrations.
      puts "[chatwoot_prepare] DB unreachable in this context (#{e.class.name}: #{e.message}); skipping"
    end
  end
end
