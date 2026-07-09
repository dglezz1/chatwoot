# Makefile — Common ops for the OpenWA + Chatwoot integration.
#
# Run `make help` to list targets.
#
# Conventions:
#   - All targets are idempotent unless noted.
#   - Targets that touch containers print their status first.
#   - `make health` is safe to run anytime; used by the cron.

ROOT      := $(shell pwd)
COMPOSE   := docker compose -f docker-compose.production.yaml
RAILS     := chatwoot-rails-1
SIDEKIQ   := chatwoot-sidekiq-1
OPENWA    := chatwoot-openwa
SCRIPTS   := bin/setup-openwa.sh bin/sync-openwa-files.sh bin/fix-openwa-session.sh \
            bin/health-check-openwa.sh

# Load .env so $OPENWA_API_KEY, $OPENWA_PUBLIC_BASE_URL etc. are available
# in recipes. Uses grep to filter comments + blank lines.
ifneq (,$(wildcard .env))
  include $(wildcard .env)
endif

# Defaults (used if .env missing the var)
OPENWA_HOST ?= http://localhost:2785
OPENWA_PUBLIC_BASE_URL ?= http://chatwoot.local:3000
OPENWA_API_KEY ?= dev-admin-key
SESSION_NAME  ?= chatwoot-main

# Colors for output
GREEN  := \033[0;32m
YELLOW := \033[0;33m
BLUE   := \033[0;34m
RESET  := \033[0m

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help.
	@printf "$(BLUE)OpenWA + Chatwoot$(RESET) — common operations:\n\n"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ---------- Setup ----------

.PHONY: setup
setup: ## Full 1-shot onboarding (creates session, QR, webhook, channel).
	@./bin/setup-openwa.sh

.PHONY: status
status: ## Show container + session status.
	@echo "$(BLUE)== Containers ==$(RESET)"
	@docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'chatwoot-' || echo "no containers"
	@echo ""
	@echo "$(BLUE)== OpenWA session ==$(RESET)"
	@curl -fsS $(OPENWA_HOST)/api/sessions \
	  -H "X-Api-Key: $(OPENWA_API_KEY)" 2>/dev/null | \
	  python3 -c "import sys,json; d=json.load(sys.stdin); [print(f\"  {s['name']:20} {s['status']:12} {s.get('phone','')}\") for s in d]" \
	  || echo "  (OpenWA not reachable)"

# ---------- Code sync ----------

.PHONY: sync
sync: ## Sync custom OpenWA files to both rails + sidekiq containers.
	@./bin/sync-openwa-files.sh

.PHONY: restart
restart: ## Restart rails + sidekiq (after sync if you changed provider/model code).
	@echo "$(YELLOW)Restarting rails + sidekiq...$(RESET)"
	@docker restart $(RAILS) $(SIDEKIQ)
	@sleep 8
	@echo "$(GREEN)done$(RESET)"

.PHONY: sync-restart
sync-restart: sync restart ## Sync files and restart both containers.

# ---------- Health ----------

.PHONY: health
health: ## Run the health check (8 checks, exit non-zero on failure).
	@./bin/health-check-openwa.sh

.PHONY: health-verbose
health-verbose: ## Health check with full output for each step.
	@./bin/health-check-openwa.sh --verbose

.PHONY: health-auto
health-auto: ## Health check + auto-recover on failure.
	@./bin/health-check-openwa.sh --auto-recover

# ---------- Repairs ----------

.PHONY: fix-session
fix-session: ## Repair OpenWA session (after container restart, etc).
	@./bin/fix-openwa-session.sh

.PHONY: fix-session-qr
fix-session-qr: ## Force re-scan QR (wipes session data).
	@./bin/fix-openwa-session.sh "" --qr

.PHONY: backfill
backfill: ## Backfill openwa_chat_id for existing contacts.
	@docker cp bin/backfill-openwa-lids.rb $(RAILS):/app/bin/backfill-openwa-lids.rb
	@docker exec $(RAILS) bundle exec rails runner /app/bin/backfill-openwa-lids.rb

# ---------- Logs ----------

.PHONY: logs
logs: ## Tail rails logs (last 100 lines).
	@docker logs $(RAILS) --tail 100 -f

.PHONY: logs-sidekiq
logs-sidekiq: ## Tail sidekiq logs (last 100 lines).
	@docker logs $(SIDEKIQ) --tail 100 -f

.PHONY: logs-openwa
logs-openwa: ## Tail openwa logs (last 100 lines).
	@docker logs $(OPENWA) --tail 100 -f

.PHONY: logs-openwa-recent
logs-openwa-recent: ## Show only the most recent errors from openwa.
	@docker logs $(OPENWA) --tail 1000 2>&1 | grep -E 'ERROR|WARN' | tail -20

.PHONY: grep-logs
grep-logs: ## Grep rails logs for a pattern (usage: make grep-logs Q="OPENWA").
	@docker logs $(RAILS) --tail 500 2>&1 | grep -E "$(Q)" | tail -30

# ---------- Send / test ----------

.PHONY: smoke
smoke: ## Send a test text + image + audio to the openwa contact.
	@./bin/smoke-test.sh

# ---------- Maintenance ----------

.PHONY: rebuild-vite
rebuild-vite: ## Rebuild vite assets after frontend changes (needs ≥4GB heap).
	@docker exec $(RAILS) sh -c "cd /app && NODE_OPTIONS='--max-old-space-size=4096' RAILS_ENV=production bundle exec rake assets:precompile"
	@echo "$(YELLOW)Restart rails to pick up new bundle:$(RESET)"
	@docker restart $(RAILS)

.PHONY: install
install: ## Make all scripts in bin/ executable.
	@chmod +x bin/setup-openwa.sh bin/sync-openwa-files.sh bin/fix-openwa-session.sh bin/health-check-openwa.sh bin/setup-captain-agent.sh 2>/dev/null || true
	@echo "$(GREEN)scripts are executable$(RESET)"

# ---------- Captain AI agents ----------

.PHONY: agent
agent: ## Create a Captain AI agent with training + guardrails (pass -- args after --).
	@./bin/setup-captain-agent.sh --account-id $(or $(ACCOUNT_ID),1) $(A_ARGS)

.PHONY: agent-schema
agent-schema: ## Print the API schema for creating a Captain agent (POST /api/v1/accounts/:id/captain/agents).
	@curl -sS $(FRONTEND_URL)/api/v1/accounts/1/captain/agents/schema \
	  -H "api_access_token: $(CHATWOOT_API_TOKEN)" | python3 -m json.tool

.PHONY: agent-list
agent-list: ## List existing Captain assistants in account 1.
	@curl -sS $(FRONTEND_URL)/api/v1/accounts/1/captain/assistants \
	  -H "api_access_token: $(CHATWOOT_API_TOKEN)" | python3 -m json.tool | head -50

.PHONY: agent-yaml
agent-yaml: ## Example YAML config for setup-captain-agent.sh --config-yaml.
	@cat <<-YAML
		agent:
		  name: 'Customer Support'
		  description: 'Answers questions about MyApp'
		  product_name: 'MyApp'
		  temperature: 0.5
		  instructions: |
		    You are a helpful support agent for MyApp.
		    Be concise. Defer billing to a human agent.
		  guardrails:
		    - 'Never share user passwords or API keys'
		    - 'Never claim features that do not exist'
		  response_guidelines:
		    - 'Reply in the customer language'
		    - 'Use simple language, avoid jargon'
		  scenarios:
		    - title: 'Password reset'
		      description: 'Customer wants to reset password'
		      instruction: 'Ask for email and send reset link'
		  urls:
		    - 'https://docs.myapp.com'
		    - 'https://myapp.com/pricing'
		  texts:
		    - 'FAQ: We ship within 24 hours. Refund window: 30 days.'
	YAML

.PHONY: agent-bulk
agent-bulk: ## Bulk-create N agents via the REST API (usage: make agent-bulk YAML=./bulk.yml).
ifndef YAML
	$(error YAML is required, e.g. make agent-bulk YAML=./agents/bulk.yml)
endif
	@curl -sS -X POST $(FRONTEND_URL)/api/v1/accounts/$(or $(ACCOUNT_ID),1)/captain/agents/bulk_create \
	  -H "api_access_token: $(CHATWOOT_API_TOKEN)" \
	  -H "Content-Type: application/json" \
	  --data-binary @$(YAML) | python3 -m json.tool

.PHONY: agent-recrawl
agent-recrawl: ## Force a re-sync of all URL docs older than 24h. Usage: make agent-recrawl HOURS=24.
	@curl -sS -X POST $(FRONTEND_URL)/api/v1/accounts/$(or $(ACCOUNT_ID),1)/captain/documents/recrawl_all \
	  -H "api_access_token: $(CHATWOOT_API_TOKEN)" \
	  -H "Content-Type: application/json" \
	  -d '{"interval_hours": $(or $(HOURS),24)}' | python3 -m json.tool
## ---- Captain auto-reply safety (added 2026-07-03 after random-number spam incident) ----

.PHONY: captain-audit
captain-audit: ## Show which Captain assistants are linked + recent bot replies + quota.
	@echo "== CaptainInbox links =="
	@docker exec $(SIDEKIQ) bundle exec rails runner 'CaptainInbox.includes(:inbox, :captain_assistant).each { |ci| puts "  inbox=#{ci.inbox_id} (#{ci.inbox&.name}) → cap_assistant=#{ci.captain_assistant_id} (#{ci.captain_assistant&.name}) mode=#{ci.config["auto_reply_mode"]}" }; puts "  count=#{CaptainInbox.count}"' 2>&1 | grep -v 'RubyLLM\|patched\|ai_agents'
	@echo ""
	@echo "== Inbox captain state (should all be nil/false for admin clients) =="
	@docker exec $(SIDEKIQ) bundle exec rails runner 'Inbox.all.each { |i| puts "  inbox=#{i.id} (#{i.name}) captain_active=#{i.respond_to?(:captain_active?) && i.captain_active?}"; }' 2>&1 | grep -v 'RubyLLM\|patched\|ai_agents'
	@echo ""
	@echo "== Recent Captain-bot outgoing messages (last 24h) =="
	@docker exec $(SIDEKIQ) bundle exec rails runner 'Message.where(message_type: 1, sender_type: "Captain::Assistant", created_at: 24.hours.ago..Time.now).order(created_at: :desc).limit(20).each { |m| ph = (m.conversation.contact.phone_number rescue "?"); puts "  ##{m.id} conv=#{m.conversation_id} ph=#{ph} at=#{m.created_at.strftime("%H:%M")} content=#{m.content.to_s[0..120].inspect}" }' 2>&1 | grep -v 'RubyLLM\|patched\|ai_agents'
	@echo ""
	@echo "== Captain responses quota remaining =="
	@docker exec $(SIDEKIQ) bundle exec rails runner 'puts "  current_available=#{Account.find(1).usage_limits[:captain][:responses][:current_available]}"' 2>&1 | grep -v 'RubyLLM\|patched\|ai_agents'

.PHONY: captain-disable
captain-disable: ## Master kill switch — disconnect all inboxes from V1 captain_assistant.
	@docker exec $(SIDEKIQ) bundle exec rails runner '
	  CaptainInbox.destroy_all
	  # Also detach captain_assistant from any inbox via the through association
	  # (the join row is CaptainInbox; destroying it is sufficient).
	  puts "Disconnected #{CaptainInbox.count} captain inbox links"
	  puts "Remaining Captain::Assistant: #{Captain::Assistant.count}"
	' 2>&1 | grep -v 'RubyLLM\|patched\|ai_agents'

.PHONY: captain-test
captain-test: ## Simulate an inbound WhatsApp message and verify no auto-reply is sent.
	@echo "Counts BEFORE:"
	@docker exec $(SIDEKIQ) bundle exec rails runner 'puts "  outgoing_total=#{Message.where(message_type: 1).count}"' 2>&1 | grep -v 'RubyLLM\|patched\|ai_agents'
	@docker cp /dev/null $(SIDEKIQ):/tmp/captain_test.rb 2>/dev/null
	@echo '{"id":"captain-smoke","from":"5215556667777@c.us","to":"5215511111111","body":"smoke test post-fix","type":"chat","timestamp":1799999999,"chatId":"5215556667777@c.us"}' > /tmp/captain_smoke_json
	@docker exec $(SIDEKIQ) bundle exec rails runner 'require "json"; ENV.delete("OPENWA_WEBHOOK_SECRET") if ENV["OPENWA_WEBHOOK_SECRET"]; j = File.read("/tmp/captain_smoke_json"); adapted = Whatsapp::Openwa::PayloadAdapter.adapt(event: "message.received", data: JSON.parse(j), session_id: "91a5cff9-0903-4770-a1da-4258cd8bbd6e"); Whatsapp::IncomingMessageService.new(inbox: Inbox.find(1), params: adapted.deep_symbolize_keys, outgoing_echo: false).perform' 2>&1 | tail -3
	@sleep 12
	@echo ""
	@echo "Counts AFTER (should be unchanged):"
	@docker exec $(SIDEKIQ) bundle exec rails runner 'puts "  outgoing_total=#{Message.where(message_type: 1).count}"; puts Message.where(message_type: 1, created_at: 5.seconds.ago..Time.now).order(id: :desc).limit(3).map { |m| "  ##{m.id} content=#{m.content.to_s[0..80].inspect}" }' 2>&1 | grep -v 'RubyLLM\|patched\|ai_agents'

