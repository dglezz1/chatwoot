# Puma can serve each request in a thread from an internal thread pool.
# The `threads` method setting takes two numbers: a minimum and maximum.
# Any libraries that use thread pools should be configured to match
# the maximum value specified for Puma. Default is set to 5 threads for minimum
# and maximum; this matches the default thread size of Active Record.
#
max_threads_count = ENV.fetch('RAILS_MAX_THREADS', 5)
min_threads_count = ENV.fetch('RAILS_MIN_THREADS') { max_threads_count }
threads min_threads_count, max_threads_count

# Specifies the `port` that Puma will listen on to receive requests.
#
# Hardcoded to 3000 to match the Procfile's `bundle exec rails server -p 3000`
# and the internal service-to-service URLs in OPENWA_WEBHOOK_HOST /
# OPENWA_API_BASE_URL. The previous `port ENV.fetch('PORT', 3000)` honored
# Railway's hidden PORT=8080 env var, which silently moved Puma off 3000 and
# broke the OpenWA → Chatwoot webhook (OpenWA was POSTing to :3000 and got
# connection refused). See git log for "fix(puma): hardcode port 3000" for
# the incident.
port 3000

# Specifies the `environment` that Puma will run in.
#
environment ENV.fetch('RAILS_ENV') { 'development' }

# Specifies the `pidfile` that Puma will use.
pidfile ENV.fetch('PIDFILE') { 'tmp/pids/server.pid' }

# Specifies the number of `workers` to boot in clustered mode.
# Workers are forked web server processes. If using threads and workers together
# the concurrency of the application would be max `threads` * `workers`.
# Workers do not work on JRuby or Windows (both of which do not support
# processes).
#
workers ENV.fetch('WEB_CONCURRENCY', 0)

# Use the `preload_app!` method when specifying a `workers` number.
# This directive tells Puma to first boot the application and load code
# before forking the application. This takes advantage of Copy On Write
# process behavior so workers use less memory.
#
preload_app!

# Allow puma to be restarted by `rails restart` command.
plugin :tmp_restart
