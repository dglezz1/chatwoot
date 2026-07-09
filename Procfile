release: POSTGRES_STATEMENT_TIMEOUT=600s bundle exec rails db:chatwoot_prepare && echo $SOURCE_VERSION > .git_sha
web: bash -lc 'bundle exec rails server -p ${PORT:-3000} -e ${RAILS_ENV:-production} -b 0.0.0.0'
worker: bash -lc 'bundle exec rails ip_lookup:setup && bundle exec sidekiq -C config/sidekiq.yml'
