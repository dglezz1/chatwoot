# Captain AI Agents — Training + Guardrails

Captain is Chatwoot's AI layer. An "agent" (called **Assistant** in the
codebase) is a Chatwoot-scoped chatbot that:

- Replies to incoming conversations based on a **system prompt** (`instructions`)
- Has access to **training data** (web pages, PDFs, raw text) it can search at runtime
- Respects **guardrails** (hard rules it cannot break) and **response guidelines** (soft style/tone)
- Recognizes **scenarios** (named flows with handoff-to-human instructions)

This document covers the **programmatic creation** path via the
`/api/v1/accounts/:account_id/captain/agents` REST endpoint and the
`bin/setup-captain-agent.sh` CLI. The same data can also be entered
through the Chatwoot UI (Settings → Captain → Assistants → New), but the
APIs below are designed for scripting (CI, content pipelines, bulk agent
creation across many accounts).

## Quick start (CLI)

```bash
cd ~/Developer/chatwoot

./bin/setup-captain-agent.sh \
  --account-id 1 \
  --name "Customer Support" \
  --description "Answers product questions about MyApp" \
  --instructions "You are a helpful agent for MyApp. Be concise." \
  --product-name "MyApp" \
  --temperature 0.5 \
  \
  --url "https://docs.myapp.com/getting-started" \
  --url "https://myapp.com/pricing" \
  \
  --pdf /path/to/internal-manual.pdf \
  \
  --text "FAQ: MyApp ships within 24 hours. Refund window: 30 days. \
Support: support@myapp.com, Mon-Fri 9-5 PT." \
  --text "Runbook: if user mentions 'billing', handoff to billing@myapp.com" \
  \
  --guardrail "Never share user passwords or API keys" \
  --guardrail "Never claim features that don't exist" \
  --guardrail "Always defer billing questions to a human agent" \
  \
  --guideline "Reply in the customer's language" \
  --guideline "Use simple language, avoid jargon" \
  --guideline "End with a question to keep the conversation going" \
  \
  --scenario 'title=Password reset|description=Customer wants password reset|instruction=Ask for their email then provide the reset link from /help/reset and handoff to a human agent' \
  --scenario 'title=Billing|description=Billing question|instruction=Always handoff to billing@myapp.com' \
  --scenario 'title=Bug report|description=Customer reports a bug|instruction=Collect repro steps and screenshot, then handoff to a human agent'
```

Output:

```
==> Creating agent 'Customer Support' on account 1
==>   2 URLs, 1 PDFs, 2 text docs
==>   3 guardrails, 3 guidelines, 3 scenarios
✓ Agent created (HTTP 201)

  Agent ID:   7
  Name:       Customer Support
  Description: Answers product questions about MyApp
  Guardrails: 3
  Guidelines: 3
  Scenarios:  3
  Documents:  5
    • [url] docs.myapp.com — in_progress (crawl in progress)
    • [url] myapp.com — in_progress (crawl in progress)
    • [pdf] internal-manual.pdf — available (PDF processing in background)
    • [text] FAQ: MyApp ships within 24 hours — available
    • [text] Runbook: if user mentions billing — available
```

After a few minutes the URLs transition `in_progress → available` (the
`Captain::Documents::CrawlJob` background worker fetches + indexes them).

## YAML config (for version-controlled agent definitions)

```bash
./bin/setup-captain-agent.sh --config-yaml ./agents/support.yml --account-id 1
```

`agents/support.yml`:

```yaml
agent:
  name: 'Customer Support'
  description: 'Answers product questions about MyApp'
  product_name: 'MyApp'
  temperature: 0.5
  instructions: |
    You are a helpful support agent for MyApp.
    Be concise (under 200 words). Defer billing to a human agent.
  guardrails:
    - 'Never share user passwords or API keys'
    - 'Never claim features that do not exist'
    - 'Always defer billing questions to a human agent'
  response_guidelines:
    - 'Reply in the customer language'
    - 'Use simple language, avoid jargon'
  scenarios:
    - title: 'Password reset'
      description: 'Customer wants to reset password'
      instruction: 'Ask for email and send reset link'
    - title: 'Bug report'
      description: 'Customer reports a bug'
      instruction: 'Collect repro steps and screenshot, handoff to human'
  urls:
    - 'https://docs.myapp.com'
  pdfs:
    - '/srv/docs/internal-runbook.pdf'
  texts:
    - 'FAQ: MyApp ships within 24 hours. Refund window: 30 days.'
```

## REST API

### Schema

```
GET /api/v1/accounts/:account_id/captain/agents/schema
```

Returns the expected request body shape — useful for API clients. Try
`make agent-schema`.

### Create

```
POST /api/v1/accounts/:account_id/captain/agents
Authorization: Bearer <api_access_token>
Content-Type: application/json

{
  "agent": {
    "name": "Customer Support",
    "description": "Answers product questions",
    "instructions": "You are a helpful agent...",
    "product_name": "MyApp",
    "temperature": 0.5,
    "feature_faq": true,
    "feature_memory": false,
    "feature_contact_attributes": false,
    "welcome_message": "Hi! How can I help?",
    "handoff_message": "Connecting you to a human agent...",
    "resolution_message": "Glad I could help!",

    "guardrails": [
      "Never share user passwords or API keys"
    ],
    "response_guidelines": [
      "Reply in the customer's language"
    ],

    "scenarios": [
      {
        "title": "Refund request",
        "description": "Customer wants refund",
        "instruction": "Ask for order id, then handoff",
        "enabled": true
      }
    ],

    "documents": [
      { "type": "url",  "source": "https://docs.myapp.com" },
      { "type": "url",  "source": "https://myapp.com/pricing" },
      { "type": "pdf",  "source": "/local/path.pdf" },
      { "type": "text", "source": "Raw inline text content...",
        "name": "Internal Runbook" }
    ]
  }
}
```

**Response (201 Created):**

```json
{
  "id": 7,
  "name": "Customer Support",
  "description": "...",
  "config": { ... },
  "guardrails": [...],
  "response_guidelines": [...],
  "scenarios": [
    { "id": 1, "title": "Refund request", "instruction": "...", "enabled": true }
  ],
  "documents": [
    { "id": 5, "name": "docs.myapp.com", "type": "url",  "status": "in_progress", ... },
    { "id": 6, "name": "internal-runbook.pdf", "type": "pdf", "status": "in_progress", ... },
    { "id": 7, "name": "Internal Runbook", "type": "text", "status": "available", "content_length": 124 }
  ]
}
```

## Document training sources

| Type | Source field | Behavior |
|------|-------------|----------|
| `url`  | `https://...` | Scraped by `SimplePageCrawlService` (free) — or Firecrawl if `CAPTAIN_FIRECRAWL_API_KEY` is set. Follows sitemap links if found. |
| `pdf`  | local file path | Uploaded via ActiveStorage, processed via OpenAI Files API (requires `CAPTAIN_OPEN_AI_API_KEY` with OpenAI). |
| `text` | inline string | Stored directly in the document's `content` field, capped at 200k chars. No background processing needed — immediately `status=available`. |

`make agent-yaml` prints an example YAML config for copy-pasting.

The frontend `CreateDocumentDialog` exposes the three types in a dropdown — pick
"Text note" to paste raw content (FAQs, runbooks, policies) and it'll be indexed
immediately without waiting for a crawl.

## Bulk agent creation

```
POST /api/v1/accounts/:account_id/captain/agents/bulk_create
Authorization: Bearer <api_access_token>
Content-Type: application/json

{
  "agents": [
    { "agent": { "name": "...", "instructions": "...", ... } },
    { "agent": { "name": "...", "instructions": "...", ... } }
  ]
}
```

Returns `200` (or `207 Multi-Status` if some failed):

```json
{
  "created": [
    { "index": 0, "name": "Agent A", "id": 7, "document_count": 2, "scenario_count": 1 },
    { "index": 1, "name": "Agent B", "id": 8, "document_count": 1, "scenario_count": 0 }
  ],
  "failed": []
}
```

One failed agent doesn't block the others — you get the full report in the response.

## Auto-recrawl cron

Two layers work together:

1. **`Captain::Documents::ScheduleSyncsJob`** — Chatwoot's built-in scheduler,
   runs on the plan cadence (daily/weekly/monthly). Picks up URL docs whose
   `last_synced_at` is past the plan window and re-enqueues a `PerformSyncJob`.

2. **`Captain::Documents::RecrawlAllJob`** — manual trigger, force a re-sync of
   every syncable doc older than `interval_hours` regardless of plan.

```
POST /api/v1/accounts/:account_id/captain/documents/recrawl_all
Authorization: Bearer <api_access_token>
Content-Type: application/json

{ "interval_hours": 24 }   # default 24
```

Returns `202 Accepted`:

```json
{
  "job_id": "f57a3e5f-62d4-4190-b254-9c1fe08cd1ab",
  "interval_hours": 24,
  "note": "Background job enqueued. Recrawl runs on the scheduled_jobs queue."
}
```

To run daily via cron, schedule a Sidekiq cron at 03:00 UTC:

```yaml
# config/sidekiq_cron.yml
recrawl_daily:
  cron: "0 3 * * *"
  class: "Captain::Documents::RecrawlAllJob"
  queue: scheduled_jobs
  args: [interval_hours: 24]
```

Text docs are excluded from auto-recrawl — they're inline content, no remote URL
to fetch. PDF docs are also excluded (no crawler for them).

## Guardrails vs Response guidelines

- **Guardrails** are **hard rules** the AI cannot break. Use for compliance,
  privacy, security: "Never share user passwords", "Never claim discounts
  that aren't real", "Always escalate billing to a human".
- **Response guidelines** are **soft style/tone preferences**: "Reply in
  the customer's language", "Use simple language", "Be concise".

In the AI's system prompt both are injected — guardrails as binding
constraints, guidelines as style suggestions.

## Scenarios

Each scenario has three fields:

- **title** — short identifier, used for tool dispatch (e.g. `handoff_to_scenario_5_password_reset_agent`)
- **description** — *when* this scenario fires (the AI decides)
- **instruction** — *how* to handle it (the actual prompt)

When a customer message matches a scenario's description, the AI uses the
scenario's instruction as a focused sub-prompt. Use scenarios to:
- Detect specific intents (refund, bug report, password reset)
- Branch conversation flow (handoff to a specific tool or human)
- Apply domain-specific handling (e.g. compliance check before promising a refund)

## Operational notes

- URL crawling runs in `Captain::Documents::CrawlJob` (queue: `low`).
  Background process; the API returns `in_progress` immediately.
- PDF processing requires `CAPTAIN_OPEN_AI_API_KEY` (uses OpenAI Files API).
  Without it, PDFs stay `in_progress` indefinitely.
- After all documents are `available`, the assistant uses them as context
  for FAQ search and replies (when `feature_faq: true`).
- `make agent-list` shows existing assistants in account 1.
- The frontend `Captain` integration must be enabled in
  Super Admin → Settings → Installation Configs → `CAPTAIN_OPEN_AI_API_KEY`
  set, otherwise the agent won't actually answer messages.

## Files

```
lib/captain/agent_builder.rb                            # Ruby orchestrator
enterprise/app/controllers/api/v1/accounts/captain/agents_controller.rb  # REST endpoint
config/routes.rb                                       # + /captain/agents routes
bin/setup-captain-agent.sh                              # 1-shot CLI
bin/backfill-openwa-lids.rb (existing)                  # unchanged
Makefile                                                # + agent / agent-schema / agent-list / agent-yaml
```

## Tests

- `make agent-schema` — print API schema
- `make agent-yaml` — print example YAML
- `make agent-list` — list existing assistants
- `./bin/setup-captain-agent.sh --help` — CLI usage

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `HTTP 422 document.source is required for type=pdf` | Empty `--pdf` arg (no PDFs passed) | Drop the `--pdf` flag, or pass a valid path |
| Assistant created but PDFs stuck `in_progress` | `CAPTAIN_OPEN_AI_API_KEY` not set or invalid | Set the OpenAI key in Super Admin → Captain |
| URLs stuck `in_progress` | Crawl job failed silently | Check sidekiq logs: `make logs-sidekiq` |
| `Missing Authentication header` (your original error) | A previous LLM test left an invalid `CAPTAIN_OPEN_AI_ENDPOINT` (e.g. OpenRouter with fake key) | Delete the test endpoint: `bundle exec rails runner 'InstallationConfig.where(name: "CAPTAIN_OPEN_AI_ENDPOINT").destroy_all'` |
| AI doesn't use the documents | Documents are `in_progress`, OR `feature_faq: false` | Wait for crawl to finish, or set `feature_faq: true` |
| Guardrails ignored | The model doesn't follow instructions well (small/old models) | Switch to a stronger model via `make agent-schema` and `captain_models` per-account setting |