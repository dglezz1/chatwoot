# OpenAI-Compatible LLM Models

Chatwoot's AI features (Captain, audio transcription, label suggestions, etc.)
are powered by the [openai Ruby SDK](https://github.com/openai/openai-ruby)
through [RubyLLM](https://github.com/crmne/ruby_llm). This means **any
OpenAI-compatible API endpoint** can be used — not just OpenAI.

This is configured via three `InstallationConfig` keys, set in
**Super Admin → Settings → Installation Configs → Captain**:

| Key | Purpose | Default |
|-----|---------|---------|
| `CAPTAIN_OPEN_AI_API_KEY` | Bearer token for the API | — (required) |
| `CAPTAIN_OPEN_AI_ENDPOINT` | API base URL (no trailing path) | `https://api.openai.com` |
| `CAPTAIN_OPEN_AI_MODEL` | Default model id (used when an account hasn't picked one) | `gpt-4.1-mini` |

## Compatible providers (tested)

Set `CAPTAIN_OPEN_AI_ENDPOINT` to any of these and `CAPTAIN_OPEN_AI_API_KEY`
to your account key. Then add any model id you want — registry is optional.

| Provider | `CAPTAIN_OPEN_AI_ENDPOINT` | Example model id |
|----------|----------------------------|------------------|
| **OpenAI** | `https://api.openai.com` (default) | `gpt-4.1`, `gpt-4.1-mini`, `gpt-4o-mini-transcribe` |
| **OpenRouter** | `https://openrouter.ai/api` | `anthropic/claude-3.5-sonnet`, `meta-llama/llama-3.1-70b-instruct` |
| **Together** | `https://api.together.xyz` | `meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo` |
| **Groq** | `https://api.groq.com/openai` | `llama-3.1-70b-versatile`, `mixtral-8x7b-32768` |
| **Mistral** | `https://api.mistral.ai` | `mistral-large-latest`, `open-mistral-7b` |
| **DeepSeek** | `https://api.deepseek.com` | `deepseek-chat`, `deepseek-coder` |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta` | `gemini-1.5-pro-latest`, `gemini-1.5-flash` |
| **vLLM (self-hosted)** | `http://your-server:8000` | `meta-llama/Llama-3.1-70B-Instruct` |
| **llama.cpp / Ollama** | `http://localhost:8080` | `llama3.1:70b`, `qwen2.5:32b` |
| **LM Studio** | `http://localhost:1234` | any model loaded in the UI |

## Setting it up

### Option 1 — Super Admin (recommended for self-hosted)

1. Login as super admin (`admin@chatwoot.local` / `Admin12345!`)
2. Go to **Settings → Installation Configs**
3. Select the **Captain** section
4. Set:
   - `CAPTAIN_OPEN_AI_API_KEY` = your provider's API key
   - `CAPTAIN_OPEN_AI_ENDPOINT` = your provider's base URL (without `/v1`)
   - `CAPTAIN_OPEN_AI_MODEL` = your preferred default model

### Option 2 — Environment variables (deployment-time)

```yaml
# docker-compose.production.yaml — service rails: env:
- CAPTAIN_OPEN_AI_API_KEY=sk-...
- CAPTAIN_OPEN_AI_ENDPOINT=https://openrouter.ai/api
- CAPTAIN_OPEN_AI_MODEL=anthropic/claude-3.5-sonnet
```

Restart rails: `docker restart chatwoot-rails-1`

## Per-account model selection

Admins can override the default model **per account, per feature** in
**Settings → Account → Captain → Models**. The model picker includes:

- All models from `config/llm.yml` (the curated registry)
- A **"Custom…"** entry that lets the admin type any model id

Custom models are validated by regex `[A-Za-z0-9._\-\/:]{1,128}` and
routed through the openai SDK to whatever endpoint is configured.
There is **no server-side filter** on the model id — if your endpoint
knows the model, it works.

To use a custom model per account:

```bash
curl -X PATCH http://localhost:3000/api/v1/accounts/1/captain/preferences \
  -H "api_access_token: $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "captain_models": {
      "label_suggestion": "anthropic/claude-3.5-sonnet",
      "editor":           "llama-3.1-70b-versatile",
      "assistant":        "gpt-4.1"
    }
  }'
```

## How model dispatch works

```
Incoming message / Captain action
       ↓
Llm::FeatureRouter.resolve(feature: 'label_suggestion', account: acct)
       ↓
   1. account.captain_models[feature] (per-account override)
   2. CAPTAIN_OPEN_AI_MODEL (super admin default)
   3. Llm::Models.default_model_for(feature) (registry default)
       ↓
   { model: 'anthropic/claude-3.5-sonnet', provider: 'openai_compatible', source: :account_override }
       ↓
RubyLLM.chat(model: 'anthropic/claude-3.5-sonnet')
   ↳ uses openai SDK with base_url = CAPTAIN_OPEN_AI_ENDPOINT
       ↓
POST {endpoint}/v1/chat/completions
       ↓
Your provider (OpenAI / OpenRouter / Together / vLLM / ...)
```

## Audio transcription

Audio transcription uses `gpt-4o-mini-transcribe` (or `whisper-1`) which
are OpenAI-specific endpoints. Other providers may not support these.
Set `CAPTAIN_OPEN_AI_ENDPOINT` to OpenAI for audio transcription, even if
you use a different provider for chat — or skip transcription by leaving
`account.audio_transcriptions` empty per account.

## Help-center search (embeddings)

Embeddings use `text-embedding-3-small` (OpenAI-specific). To use another
provider's embedding endpoint, override `CAPTAIN_OPEN_AI_ENDPOINT` with one
that supports `/v1/embeddings` (OpenAI, OpenRouter, vLLM with `--task embed`).

## Models registry (`config/llm.yml`)

The registry provides **metadata only** (display name, provider icon,
credit multiplier for billing). It's optional — adding custom models
via the UI does NOT require editing this file.

To add a model to the registry (so it appears in the dropdown without
typing):

```yaml
models:
  claude-haiku-4.5:
    provider: anthropic         # for icon
    display_name: 'Claude Haiku 4.5'
    credit_multiplier: 2       # for Chatwoot Cloud billing
  llama-3.1-70b:
    provider: openai_compatible
    display_name: 'Llama 3.1 70B'
    credit_multiplier: 1
```

Then add to the relevant feature's `models:` list:

```yaml
features:
  editor:
    models: [gpt-4.1-mini, llama-3.1-70b, claude-haiku-4.5]
    default: gpt-4.1-mini
```

## Verifying the config

```bash
docker exec chatwoot-rails-1 bundle exec rails runner '
  puts "openai_configured? #{Llm::Config.openai_configured?}"
  puts "default_endpoint: #{InstallationConfig.find_by(name: \"CAPTAIN_OPEN_AI_ENDPOINT\")&.value}"
  r = Llm::FeatureRouter.resolve(feature: "label_suggestion", account: Account.first)
  puts "label_suggestion routes to: #{r}"
'
```

## Health check

```bash
docker exec chatwoot-rails-1 bundle exec rails runner '
  OpenAI::Client.new(
    access_token: InstallationConfig.find_by(name: "CAPTAIN_OPEN_AI_API_KEY").value,
    uri_base: InstallationConfig.find_by(name: "CAPTAIN_OPEN_AI_ENDPOINT")&.value
  ).models.list
'
```

Returns the list of models the endpoint knows about — useful for
discovering model ids to put in the UI.