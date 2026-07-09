release: POSTGRES_STATEMENT_TIMEOUT=600s bundle exec rails db:chatwoot_prepare && echo $SOURCE_VERSION > .git_sha
web: PORT=3000 RAILS_ENV=production bundle exec rails server -p 3000 -e production -b 0.0.0.0
worker: PORT=3000 RAILS_ENV=production bundle exec rails ip_lookup:setup && bundle exec sidekiq -C config/sidekiq.yml
