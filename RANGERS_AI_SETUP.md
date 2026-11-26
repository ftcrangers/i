# Rangers AI setup

This feature adds a separate Rangers AI chat page and a Supabase Edge Function that keeps all provider credentials server-side.

## Providers and model roles

| Rangers model | Role | Provider | Model |
|---|---|---|---|
| MOIZ | General assistant | Groq | openai/gpt-oss-120b |
| ZUMAI | FTC programming | NVIDIA NIM | nvidia/nemotron-3.5-super-vl-120b-a12b |
| NUYAH | Robot ideas | OpenRouter | openrouter/free |
| FARSHA | Strategy and planning | Cloudflare Workers AI | @cf/zai-org/glm-4.7-flash |
| RANGER | Robotics research and review | SambaNova | DeepSeek-V3.1 |

RANGER is the fifth model added to complete the requested five-provider setup. Its research/review role is a suggested default and can be renamed or reassigned.

## Create provider credentials

Have an adult team advisor or authorized team account owner create and manage provider accounts, review each provider's age and acceptable-use terms, and control usage. Free tiers have limits and can change. Do not paste keys into GitHub, browser JavaScript, or chat messages.

- Groq API keys: https://console.groq.com/keys
- NVIDIA NIM API keys: https://build.nvidia.com/settings/api-keys
- OpenRouter API keys: https://openrouter.ai/keys
- Cloudflare Workers AI: https://dash.cloudflare.com/ (create a Workers AI API token and copy the account ID)
- SambaNova Cloud: https://cloud.sambanova.ai/

## Add Supabase Function Secrets

In the Supabase Dashboard for project `hnhbavlgqbkxbvqdrlgh`, open **Edge Functions → Secrets** and add:

- `GROQ_API_KEY`
- `NVIDIA_API_KEY`
- `OPENROUTER_API_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SAMBANOVA_API_KEY`

Only the key for the selected model is used for a request. If a provider secret is missing, that model returns a setup message; the other models can still work.

## Deploy

After merging the PR, deploy the function from the repository root:

```powershell
supabase functions deploy rangers-ai
```

The function has JWT verification enabled and requires a signed-in Rangers account. It allows 12 requests per minute per account per running function instance as a basic burst guard. Provider quotas are separate and still apply.

## Important notes

- API keys are only read by the Edge Function from Supabase secrets.
- Do not commit API keys or add them to `index.html`, `ai.html`, or `rangers-ai.js`.
- Free access and available model IDs can change. Check each provider dashboard before enabling a model for the team.
- Google Gemini is not included: its API terms require users to be 18+ and prohibit use in API clients directed to or likely to be accessed by under-18s.
- The chat is currently kept in page memory and is not saved as a database conversation history.
- The rate guard is in-memory and best-effort; it is not a substitute for a persistent quota table or provider-side limits.
- The providers and function have not yet been live-tested with real keys.
