release: sh -c 'if [ -f bin/rails ] && [ "$SERVICE_TYPE" != "openwa" ]; then bundle exec rails db:chatwoot_prepare; fi'
web: PORT=3000 RAILS_ENV=production bundle exec rails server -p 3000 -e production -b 0.0.0.0
worker: PORT=3000 RAILS_ENV=production bundle exec rails ip_lookup:setup && bundle exec sidekiq -C config/sidekiq.yml
