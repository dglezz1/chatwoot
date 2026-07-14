# Chambeabot Operator Agent

> **Status (2026-07-13)**: Phase 1 in progress. Foundation + 5 read-only tools + API + basic UI. See bottom for the phased rollout.

An in-dashboard AI agent that lets a Chambeabot operator (admin/agent) configure
and operate the entire CRM by chatting in natural Spanish/English. Built on top
of the same LLM stack (MiniMax M3, OpenAI-compatible) that powers Captain for
customer conversations — but the two are completely independent subsystems.

## Why a separate agent (not a Captain scenario)

Captain is **per-conversation**: every tool is bound to a `conversation_id` and
runs in the context of a customer chat. The Operator Agent is **per-account**:
every tool runs in the context of "configure this Chatwoot account". Different
state, different scopes, different audit model, different confirmation flow.

| Concern | Captain | Operator Agent |
|---|---|---|
| Bound to | A conversation | The account |
| Tools act on | Messages, contacts, conversations | Inboxes, agents, teams, bots, flows |
| Destructive actions | Tool calls handoff, resolve, etc. | Requires explicit `confirm: true` |
| Audit | Captain message reports | `operator_agent_action_logs` table |
| UI surface | Inside the conversation sidebar | Dedicated `/app/accounts/:id/agent` page |
| Thread model | `captain_copilot_threads` | `operator_agent_threads` |

## Architecture

```
   ┌─────────────────────────────────────────────────────────┐
   │  Vue UI: /app/accounts/:id/agent                        │
   │  ┌──────────────────┐  ┌──────────────────────────────┐ │
   │  │   Chat panel     │  │   Action preview pane        │ │
   │  │  (50% width)     │  │   (50% width)                │ │
   │  │                  │  │   - tool name + args         │ │
   │  │  User messages   │  │   - result                   │ │
   │  │  Agent messages  │  │   - Confirm / Cancel btns    │ │
   │  │  Tool-call chips │  │   (only for pending actions) │ │
   │  └──────────────────┘  └──────────────────────────────┘ │
   └─────────────────────────────────────────────────────────┘
                              │  HTTP (Rails)
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  Rails API: /api/v1/accounts/:id/operator_agent/...     │
   │  - threads  - messages  - actions (confirm/cancel)      │
   │  - capabilities  (list tools for "What can I do?")      │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  OperatorAgent::Executor  (Sidekiq job)                 │
   │  - Loads thread + message history                       │
   │  - Builds RubyLLM::Chat with registered tools           │
   │  - Streams tokens to ActionCable                        │
   │  - Audits every tool call                               │
   │  - Persists pending actions for confirmation            │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  RubyLLM.chat(model: 'MiniMax-M3', tools: [...])        │
   │  - Tool registry resolves OperatorAgent::Tools::*Tool   │
   │  - Each tool.perform(tool_context, **args) returns a    │
   │    String the LLM reads as the next user message,       │
   │    OR a Hash { pending_action: {...} } for destructive  │
   └─────────────────────────────────────────────────────────┘
```

## Data model

### `operator_agent_threads`

| Column | Type | Notes |
|---|---|---|
| id | bigint | PK |
| account_id | bigint | FK → accounts, indexed |
| user_id | bigint | FK → users, the operator |
| title | string | Auto-generated from first message |
| created_at, updated_at | timestamps | |
| archived_at | timestamp | nullable, for archive UI |

### `operator_agent_messages`

| Column | Type | Notes |
|---|---|---|
| id | bigint | PK |
| thread_id | bigint | FK → operator_agent_threads, indexed |
| role | string | `user` \| `assistant` \| `tool` |
| content | text | The text of the message (for tool: the tool name + result) |
| tool_calls | jsonb | Array of `{name, args, id, result}` |
| tool_call_id | string | For role=`tool`, links back to assistant tool_calls[i].id |
| status | string | `pending` \| `streaming` \| `complete` \| `failed` |
| error | text | nullable, populated on failure |
| created_at, updated_at | timestamps | |

### `operator_agent_pending_actions`

| Column | Type | Notes |
|---|---|---|
| id | bigint | PK |
| message_id | bigint | FK → operator_agent_messages, the assistant message that produced this |
| tool_name | string | e.g. `delete_inbox` |
| tool_args | jsonb | Args the LLM passed to the tool |
| status | string | `awaiting_confirmation` \| `confirmed` \| `cancelled` \| `executed` \| `failed` |
| expires_at | timestamp | Auto-cancel after 24h |
| result | jsonb | Tool result after execution |
| error | text | nullable, populated on failure |
| created_at, updated_at | timestamps | |

### `operator_agent_action_logs`

Append-only audit log. Every tool call (read or write) gets a row.

| Column | Type | Notes |
|---|---|---|
| id | bigint | PK |
| account_id | bigint | FK, indexed |
| user_id | bigint | FK, the operator |
| thread_id | bigint | FK, nullable (for capability probes) |
| tool_name | string | |
| tool_args | jsonb | |
| tool_result | text | Truncated to 4 KB |
| status | string | `success` \| `error` \| `awaiting_confirmation` \| `cancelled` |
| duration_ms | integer | |
| created_at | timestamp | indexed (for time-based queries) |

## Tool catalog

All tools live in `app/services/operator_agent/tools/` and extend
`OperatorAgent::Tools::BaseTool < Agents::Tool`. Each declares a `description`
and `param`s. Two categories:

### Read tools (no confirmation)

| Tool | Args | Returns |
|---|---|---|
| `list_inboxes` | `channel_type` (optional) | Array of inbox summaries |
| `get_inbox` | `inbox_id` (required) | Single inbox detail |
| `list_contacts` | `query` (optional, search by name/email/phone) | Array of contact summaries |
| `get_contact` | `contact_id` (required) | Single contact detail |
| `list_conversations` | `status`, `inbox_id`, `limit` | Array of conversation summaries |
| `list_agents` | `availability` (optional) | Array of agent summaries |
| `list_teams` | none | Array of team summaries |
| `list_labels` | none | Array of label names + counts |
| `list_canned_responses` | `search` (optional) | Array of canned responses |
| `list_automation_rules` | `inbox_id` (optional) | Array of rules |
| `list_macros` | none | Array of macros |
| `list_campaigns` | `status` (optional) | Array of campaigns |
| `list_custom_attributes` | `attribute_model` (optional) | Array of definitions |
| `list_integrations` | none | Array of installed integrations |
| `list_captain_assistants` | none | Array of Captain assistants with config |
| `list_inbox_members` | `inbox_id` (required) | Agents + teams on an inbox |
| `list_assignment_policies` | `inbox_id` (optional) | Policies |
| `account_overview` | none | High-level summary: name, plan, usage limits, feature flags |
| `search_across` | `query` (required) | Cross-entity full-text search |

### Write tools (some require `confirm: true`)

Marked **(confirm)** means the tool returns `{pending_action: {...}}` and the
operator must explicitly confirm via the UI before the action executes. The
executor enqueues a pending action; the operator hits "Confirm" in the UI;
the controller validates and runs the tool again with `confirm: true`.

| Tool | Args | Destructive? |
|---|---|---|
| `create_inbox` | `name`, `channel_type`, `config` (channel-specific) | — |
| `update_inbox` | `inbox_id`, `name`, etc. | **(confirm)** |
| `delete_inbox` | `inbox_id` | **(confirm)** |
| `create_contact` | `name`, `email`, `phone_number`, `inbox_id` | — |
| `update_contact` | `contact_id`, `name`, `email`, `phone_number` | **(confirm)** |
| `delete_contact` | `contact_id` | **(confirm)** |
| `merge_contacts` | `primary_id`, `secondary_id` | **(confirm)** |
| `assign_conversation` | `conversation_id`, `agent_id` | — |
| `resolve_conversation` | `conversation_id` | — |
| `reopen_conversation` | `conversation_id` | — |
| `add_label_to_conversation` | `conversation_id`, `label_name` | — |
| `remove_label_from_conversation` | `conversation_id`, `label_name` | — |
| `create_label` | `name`, `color`, `description` | — |
| `update_label` | `label_id`, `name`, `color` | **(confirm)** |
| `delete_label` | `label_id` | **(confirm)** |
| `create_canned_response` | `short_code`, `content` | — |
| `update_canned_response` | `id`, `short_code`, `content` | **(confirm)** |
| `delete_canned_response` | `id` | **(confirm)** |
| `create_automation_rule` | `name`, `event`, `conditions`, `actions` | — |
| `update_automation_rule` | `id`, `name`, `event`, `conditions`, `actions` | **(confirm)** |
| `delete_automation_rule` | `id` | **(confirm)** |
| `create_macro` | `name`, `actions` | — |
| `update_macro` | `id`, `name`, `actions` | **(confirm)** |
| `delete_macro` | `id` | **(confirm)** |
| `invite_agent` | `email`, `name`, `role` | — |
| `update_agent` | `agent_id`, `name`, `role`, `availability` | **(confirm)** |
| `remove_agent` | `agent_id` | **(confirm)** |
| `create_team` | `name`, `description`, `allow_auto_assign` | — |
| `update_team` | `team_id`, `name`, `description` | **(confirm)** |
| `delete_team` | `team_id` | **(confirm)** |
| `create_custom_attribute` | `attribute_key`, `attribute_model`, `attribute_display_type`, `attribute_values` | — |
| `update_custom_attribute` | `id`, ... | **(confirm)** |
| `delete_custom_attribute` | `id` | **(confirm)** |
| `bind_captain_assistant` | `assistant_id`, `inbox_id`, `auto_reply_mode` | — |
| `unbind_captain_assistant` | `assistant_id`, `inbox_id` | **(confirm)** |
| `create_captain_assistant` | `name`, `description`, `config` | — |
| `update_captain_assistant` | `id`, ... | **(confirm)** |
| `setup_whatsapp_openwa` | `name`, `inbox_name` | — (full multi-step onboarding) |
| `configure_pipeline` | `inbox_id`, `stages` (array of strings) | — |
| `move_contact_to_stage` | `contact_id`, `stage` | — |
| `send_test_message` | `inbox_id`, `recipient`, `content` | — (sends a real message) |
| `trigger_bulk_action` | `action`, `entity`, `filters`, `params` | **(confirm)** |

## API surface

```
GET    /api/v1/accounts/:id/operator_agent/threads
POST   /api/v1/accounts/:id/operator_agent/threads                  {title?}
GET    /api/v1/accounts/:id/operator_agent/threads/:thread_id
DELETE /api/v1/accounts/:id/operator_agent/threads/:thread_id

POST   /api/v1/accounts/:id/operator_agent/threads/:thread_id/messages
       {content: "..."}
       → 200 {message, status, pending_actions?: [...]}

GET    /api/v1/accounts/:id/operator_agent/threads/:thread_id/messages?after_id=N
       → long-poll for new messages (the streaming alternative)

POST   /api/v1/accounts/:id/operator_agent/pending_actions/:id/confirm
       → executes the pending action, returns tool result
POST   /api/v1/accounts/:id/operator_agent/pending_actions/:id/cancel

GET    /api/v1/accounts/:id/operator_agent/capabilities
       → {tools: [{name, description, params, destructive, requires_confirm}], stats: {}}

GET    /api/v1/accounts/:id/operator_agent/action_logs
       → audit log (last 100, paginated)
```

All endpoints require `administrator` or `agent` role on the account. Destructive
confirm/cancel endpoints additionally require `administrator`.

## UI surface

- **Sidebar entry**: Captain → "Operator Agent" (icon: `bot`).
- **Route**: `/app/accounts/:id/agent` (alias `/operator_agent`).
- **Layout**: 50/50 split, chat left, action preview right.
- **Action preview cards** show:
  - Tool name + one-line description
  - Args (formatted, e.g. `inbox_id: 6`, `name: "WhatsApp Beta"`)
  - Result (or "Pending confirmation" with Confirm/Cancel buttons)
- **Streaming**: actioncable subscription on `operator_agent_thread_{id}`. New
  tokens append to the in-flight assistant message; new tool calls render as
  cards; tool results render as "X completed" chips.
- **"What can I do?" panel**: opens on first visit, lists the registered tools
  with their descriptions. Dismissible.

## Phased rollout

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: 3 tables, 3 models, executor, 5 read tools, basic UI, E2E test | **In progress** |
| 2 | 10+ write tools + `confirm: true` pattern + pending action endpoints + frontend confirmation | Pending |
| 3 | Setup flows: `setup_whatsapp_openwa`, `bind_captain_assistant`, `configure_pipeline` | Pending |
| 4 | Polish: rate limiting, audit log UI, per-account caps, "What can I do?" panel | Pending |

## Open questions

1. **Streaming transport**: ActionCable vs Server-Sent Events vs long-poll. Captain
   uses ActionCable; we'll do the same to reuse the connection.
2. **Per-account tool allowlist**: should an operator be able to disable certain
   tools in their account? (e.g. disable `delete_inbox` to prevent accidents.)
3. **Operator role enforcement**: destructive tools must be `administrator`. Read
   tools can be `administrator` or `agent`. Where exactly to gate? Currently
   planned at the controller layer + per-tool `permissions` array.
4. **Multi-tenant LLM cost**: every tool call burns tokens. The action_logs table
   will track usage; we may need a per-account daily cap.

## Why I'm building this

Because clicking through 12 settings pages to create a WhatsApp inbox + link
it to Captain + invite an agent + build a Kanban + set up automation rules
should not be a 30-minute task. It should be:

> "Crea un inbox de WhatsApp con OpenWA, llámalo 'Ventas MX', vincúlalo
> al Captain Assistant, mueve todos los contactos con tag 'nuevo' al
> stage 'calificado' y mándame un reporte"

Done in one shot. That's the goal.
