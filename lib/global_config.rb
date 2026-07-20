class GlobalConfig
  VERSION = 'V1'.freeze
  KEY_PREFIX = 'GLOBAL_CONFIG'.freeze
  DEFAULT_EXPIRY = 1.day

  class << self
    def get(*args)
      config_keys = *args
      config = {}

      config_keys.each do |config_key|
        config[config_key] = load_from_cache(config_key)
      end

      typecast_config(config)
      config.with_indifferent_access
    end

    def get_value(arg)
      load_from_cache(arg)
    end

    def clear_cache
      cached_keys = $alfred.with { |conn| conn.keys("#{VERSION}:#{KEY_PREFIX}:*") }
      (cached_keys || []).each do |cached_key|
        $alfred.with { |conn| conn.expire(cached_key, 0) }
      end
    rescue Redis::BaseError, SocketError, Errno::ECONNREFUSED, Errno::EHOSTUNREACH => e
      # Redis may be temporarily unreachable at boot (e.g. transient Railway
      # internal DNS hiccup). The cache will be rebuilt on the next call.
      Rails.logger.warn "[GlobalConfig] clear_cache: Redis unreachable (#{e.class.name}: #{e.message}); skipping"
    end

    private

    def typecast_config(config)
      general_configs = ConfigLoader.new.general_configs
      config.each do |config_key, config_value|
        config_type = general_configs.find { |c| c['name'] == config_key }&.dig('type')
        config[config_key] = ActiveRecord::Type::Boolean.new.cast(config_value) if config_type == 'boolean'
      end
    end

    def load_from_cache(config_key)
      cache_key = "#{VERSION}:#{KEY_PREFIX}:#{config_key}"
      cached_value = $alfred.with { |conn| conn.get(cache_key) }

      if cached_value.blank?
        value_from_db = db_fallback(config_key)
        cached_value = { value: value_from_db }.to_json
        # Best-effort write-back; ignore Redis failures so a Redis hiccup
        # at boot doesn't crash the app.
        begin
          $alfred.with { |conn| conn.set(cache_key, cached_value, { ex: DEFAULT_EXPIRY }) }
        rescue Redis::BaseError, SocketError, Errno::ECONNREFUSED, Errno::EHOSTUNREACH => e
          Rails.logger.warn "[GlobalConfig] load_from_cache: Redis write failed for #{config_key} (#{e.class.name}); using DB value"
        end
      end

      JSON.parse(cached_value)['value']
    rescue Redis::BaseError, SocketError, Errno::ECONNREFUSED, Errno::EHOSTUNREACH => e
      # Redis unreachable (e.g. DNS resolution failure on Railway's
      # internal hostnames during container boot). Fall back to a direct
      # DB read so the app can still boot. The next call to
      # `load_from_cache` will retry the cache layer.
      Rails.logger.warn "[GlobalConfig] load_from_cache: Redis unreachable for #{config_key} (#{e.class.name}: #{e.message}); falling back to DB"
      db_fallback(config_key)
    end

    def db_fallback(config_key)
      InstallationConfig.find_by(name: config_key)&.value
    end
  end
end
