import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ftcrangers.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODELS: Record<string, { name: string; provider: string; url: string; model: string; key: string; system: string }> = {
  moiz: {
    name: "MOIZ", provider: "Groq", url: "https://api.groq.com/openai/v1/chat/completions",
    model: "openai/gpt-oss-120b", key: "GROQ_API_KEY",
    system: "You are MOIZ, the Itkan Rangers general assistant. Help with everyday questions, school-safe learning, robotics, teamwork, and planning. Be clear, practical, friendly, and honest about uncertainty. Never invent FTC rules, statistics, or hardware specifications. Explain assumptions and ask a focused question when needed."
  },
  zumai: {
    name: "ZUMAI", provider: "NVIDIA NIM", url: "https://integrate.api.nvidia.com/v1/chat/completions",
    model: "nvidia/nemotron-3.5-super-vl-120b-a12b", key: "NVIDIA_API_KEY",
    system: "You are ZUMAI, the Rangers programming specialist named from Humza and Zoraiz. Focus on FTC Java, Android Studio, the FTC SDK, OpModes, debugging, control systems, and clean software architecture. Explain why code works, provide complete code when requested, state SDK/version assumptions, and never pretend code has been tested when it has not."
  },
  nuyah: {
    name: "NUYAH", provider: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions",
    model: "openrouter/free", key: "OPENROUTER_API_KEY",
    system: "You are NUYAH, the Rangers robot-ideas specialist named from Nuh and Yahya. Generate original, buildable FTC robot concepts, mechanisms, intake and scoring ideas, CAD approaches, and testable prototypes. Compare options by complexity, reliability, weight, space, cost, and likely failure points. Do not present speculation as proven."
  },
  farsha: {
    name: "FARSHA", provider: "Cloudflare Workers AI", url: "",
    model: "@cf/zai-org/glm-4.7-flash", key: "CLOUDFLARE_API_TOKEN",
    system: "You are FARSHA, the Rangers strategy and planning specialist named from Farhan and Shaheer. Help create match plans, autonomous priorities, driver practice plans, scouting workflows, decision trees, and contingency plans. Base recommendations on the rules and facts the user supplies; flag missing game-specific details and avoid inventing scoring values."
  },
  ranger: {
    name: "RANGER", provider: "SambaNova", url: "https://api.sambanova.ai/v1/chat/completions",
    model: "DeepSeek-V3.1", key: "SAMBANOVA_API_KEY",
    system: "You are RANGER, the Rangers robotics research and review specialist. Help check assumptions, compare technical approaches, summarize supplied rule text, and identify what should be verified with official sources. Separate known facts from estimates and list useful validation steps."
  }
};

const rateBuckets = new Map<string, number[]>();
function allowRequest(userId: string) {
  const now = Date.now();
  const recent = (rateBuckets.get(userId) || []).filter(t => now - t < 60_000);
  if (recent.length >= 12) return false;
  recent.push(now); rateBuckets.set(userId, recent); return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = req.headers.get("Origin");
  if (origin && origin !== "https://ftcrangers.github.io") return json({ error: "This AI service is only available from the Rangers website." }, 403);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in to your Rangers account to use Rangers AI." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return json({ error: "Supabase authentication is not configured." }, 503);
  const authClient = createClient(url, anon, { global: { headers: { Authorization: "Bearer " + token } } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Your Rangers session is invalid. Sign in again." }, 401);
  if (!allowRequest(authData.user.id)) return json({ error: "Rangers AI is being used quickly. Wait one minute and try again." }, 429);

  let body: { model?: string; messages?: Array<{ role: string; content: string }> };
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const config = body.model ? MODELS[body.model] : null;
  if (!config) return json({ error: "Choose one of the Rangers models." }, 400);
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12) return json({ error: "A conversation can include up to 12 recent messages per request." }, 400);
  const messages = body.messages.map(m => {
    if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") return null;
    if (!m.content.trim() || m.content.length > 6000) return null;
    return { role: m.role, content: m.content };
  });
  if (messages.some(m => !m)) return json({ error: "A message was empty or too long." }, 400);

  const apiKey = Deno.env.get(config.key);
  if (!apiKey) return json({ error: config.key + " is not configured in Supabase Function Secrets yet." }, 503);

  let endpoint = config.url;
  if (body.model === "farsha") {
    const account = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    if (!account) return json({ error: "CLOUDFLARE_ACCOUNT_ID is missing from Supabase Function Secrets." }, 503);
    endpoint = "https://api.cloudflare.com/client/v4/accounts/" + account + "/ai/v1/chat/completions";
  }

  const headers: Record<string, string> = { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" };
  if (body.model === "nuyah") {
    headers["HTTP-Referer"] = "https://ftcrangers.github.io/";
    headers["X-Title"] = "Itkan Rangers AI";
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "system", content: config.system }, ...messages],
        max_tokens: 1600,
        temperature: body.model === "nuyah" ? 0.85 : 0.55,
        stream: false
      }),
      signal: AbortSignal.timeout(45_000)
    });
    const raw = await response.text();
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); } catch { data = { error: raw.slice(0, 500) }; }
    if (!response.ok) {
      console.error(config.provider + " returned", response.status, data);
      const detail = typeof data.error === "string" ? data.error : (typeof (data.error as Record<string, unknown>)?.message === "string" ? (data.error as Record<string, unknown>).message : "The provider rejected the request.");
      return json({ error: config.provider + " error (" + response.status + "): " + detail.slice(0, 350) }, 502);
    }
    const reply = (data.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) return json({ error: config.provider + " returned an empty or unsupported response." }, 502);
    return json({ reply, provider: config.provider, model: config.name });
  } catch (error) {
    console.error("Rangers AI provider request failed:", error);
    return json({ error: config.provider + " could not be reached. Try again shortly." }, 502);
  }
});
