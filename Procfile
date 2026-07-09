release: POSTGRES_STATEMENT_TIMEOUT=600s bundle exec rails db:chatwoot_prepare && echo $SOURCE_VERSION > .git_sha
web: bin/start-web.sh
worker: bash -lc 'bundle exec rails ip_lookup:setup && bundle exec sidekiq -C config/sidekiq.yml'
