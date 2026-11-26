import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = "https://ftcrangers.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const personas: Record<string, { name: string; provider: string; system: string }> = {
  moiz: { name: "MOIZ", provider: "Google AI Studio", system: "You are MOIZ, the general-purpose AI assistant for Itkan Rangers FTC robotics team. Help with broad questions, learning, writing, planning, and robotics. Be accurate, friendly, structured, and honest about uncertainty. For FTC rules, hardware limits, and season-specific facts, distinguish confirmed facts from assumptions and encourage checking official game manuals when needed." },
  zum: { name: "APEX", provider: "Groq", system: "You are APEX, the FTC programming specialist for Itkan Rangers. Focus on Java, the FTC SDK, Android Studio, OpModes, Road Runner concepts, debugging, architecture, and testing. Explain code line by line when useful. Provide complete, compile-conscious examples, state SDK/version assumptions, avoid inventing APIs, and point out hardware safety checks before suggesting robot motion." },
  nayah: { name: "SPARK", provider: "Cloudflare Workers AI", system: "You are SPARK, the creative robotics and mechanism ideation partner for Itkan Rangers. Generate multiple distinct mechanism concepts, compare tradeoffs, discuss packaging, reliability, weight, serviceability, and manufacturability. Be creative but realistic; label speculative ideas and ask for missing robot constraints when they materially affect a design." },
  fasheer: { name: "TACTIC", provider: "Cohere", system: "You are TACTIC, the strategy and planning specialist for Itkan Rangers. Help with FTC match strategy, scouting, alliance selection preparation, testing priorities, schedules, checklists, and decision frameworks. Do not invent competition data or rules. Clearly state assumptions and make plans actionable." },
  ranger: { name: "FORGE", provider: "OpenRouter", system: "You are FORGE, the CAD and mechanical design specialist for Itkan Rangers. Help with Onshape, CAD workflows, assemblies, mates, tolerances, gear ratios, mechanism packaging, design reviews, and manufacturability. Explain steps clearly, flag assumptions, and avoid pretending to inspect CAD files that were not supplied." }
};

function contentFromOpenAI(data: any): string {
  return data?.choices?.[0]?.message?.content || "";
}
async function callOpenAICompatible(url: string, key: string, model: string, messages: any[], extraHeaders: Record<string,string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({ model, messages, temperature: 0.65, max_tokens: 1400 }),
    signal: AbortSignal.timeout(45000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("AI provider error", response.status, data);
    throw new Error(response.status === 429 ? "This model has reached its free usage limit. Try another Rangers model or wait for the quota to reset." : "The selected AI provider returned an error (" + response.status + "). Check its API key and free-tier availability.");
  }
  const reply = contentFromOpenAI(data);
  if (!reply) throw new Error("The AI provider returned an empty answer. Please retry.");
  return reply;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const origin = req.headers.get("Origin");
  if (origin && origin !== allowedOrigin) return json({ error: "Rangers AI is only available from the Rangers website." }, 403);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in to your Rangers account to use Rangers AI." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) return json({ error: "Rangers AI authentication is not configured. Ask the site owner to check Supabase secrets." }, 503);

  const authClient = createClient(url, anon, { global: { headers: { Authorization: "Bearer " + token } } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Your session is invalid. Sign in again and retry." }, 401);

  let body: { model?: string; messages?: Array<{ role: string; content: string }> };
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const modelId = typeof body.model === "string" ? body.model : "";
  const persona = personas[modelId];
  if (!persona) return json({ error: "Choose one of the available Rangers AI models." }, 400);
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 16) return json({ error: "Send between 1 and 16 recent messages." }, 400);
  const validMessages = body.messages.every(m =>
    !!m &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    m.content.length <= 6000
  );
  if (!validMessages) return json({ error: "A message is invalid or too long." }, 400);
  const messages = body.messages as Array<{ role: "user" | "assistant"; content: string }>;
  if (messages[messages.length - 1]?.role !== "user") return json({ error: "The latest message must be from you." }, 400);

  const service = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await service.from("rangers_ai_usage").select("id", { count: "exact", head: true }).eq("user_id", authData.user.id).gte("created_at", since);
  if (countError) {
    console.error("AI usage check failed:", countError);
    return json({ error: "Rangers AI usage tracking is not ready. The site owner must run the AI usage SQL migration." }, 503);
  }
  if ((count || 0) >= 30) return json({ error: "You have reached the Rangers AI limit of 30 messages per 24 hours. Try again later." }, 429);
  const { error: usageError } = await service.from("rangers_ai_usage").insert({ user_id: authData.user.id, model_id: modelId });
  if (usageError) {
    console.error("AI usage record failed:", usageError);
    return json({ error: "Could not record AI usage. Please retry shortly." }, 503);
  }

  const providerMessages = [{ role: "system", content: persona.system }, ...messages];
  try {
    let reply = "";
    if (modelId === "moiz") {
      const key = Deno.env.get("GOOGLE_AI_API_KEY");
      if (!key) return json({ error: "MOIZ is not configured yet. Add GOOGLE_AI_API_KEY to Supabase Function Secrets." }, 503);
      const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: persona.system }] },
          contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { temperature: 0.65, maxOutputTokens: 1400 }
        }),
        signal: AbortSignal.timeout(45000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Gemini provider error", response.status, data);
        throw new Error(response.status === 429 ? "MOIZ has reached its free usage limit. Try another model or wait for the quota to reset." : "Google AI Studio returned an error (" + response.status + "). Check the API key and model setting.");
      }
      reply = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
    } else if (modelId === "zum") {
      const key = Deno.env.get("GROQ_API_KEY");
      if (!key) return json({ error: "APEX is not configured yet. Add GROQ_API_KEY to Supabase Function Secrets." }, 503);
      reply = await callOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", key, Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b", providerMessages);
    } else if (modelId === "nayah") {
      const account = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
      const key = Deno.env.get("CLOUDFLARE_AI_TOKEN");
      if (!account || !key) return json({ error: "SPARK is not configured yet. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN to Supabase Function Secrets." }, 503);
      const model = Deno.env.get("CLOUDFLARE_AI_MODEL") || "@cf/zai-org/glm-4.7-flash";
      const response = await fetch("https://api.cloudflare.com/client/v4/accounts/" + account + "/ai/run/" + model, {
        method: "POST",
        headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: providerMessages, max_tokens: 1400 }),
        signal: AbortSignal.timeout(45000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        console.error("Cloudflare AI provider error", response.status, data);
        throw new Error(response.status === 429 ? "SPARK has reached its free usage limit. Try another model or wait for the quota to reset." : "Cloudflare Workers AI returned an error (" + response.status + "). Check the account ID, token, and model.");
      }
      reply = data?.result?.response || data?.result?.choices?.[0]?.message?.content || "";
    } else if (modelId === "fasheer") {
      const key = Deno.env.get("COHERE_API_KEY");
      if (!key) return json({ error: "TACTIC is not configured yet. Add COHERE_API_KEY to Supabase Function Secrets." }, 503);
      const response = await fetch("https://api.cohere.com/v2/chat", {
        method: "POST",
        headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ model: Deno.env.get("COHERE_MODEL") || "command-a-plus-05-2026", messages: providerMessages, max_tokens: 1400, temperature: 0.65 }),
        signal: AbortSignal.timeout(45000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Cohere provider error", response.status, data);
        throw new Error(response.status === 429 ? "TACTIC has reached its free usage limit. Try another model or wait for the quota to reset." : "Cohere returned an error (" + response.status + "). Check the API key and model.");
      }
      reply = (data?.message?.content || []).map((part: any) => part.text || "").join("");
    } else {
      const key = Deno.env.get("OPENROUTER_API_KEY");
      if (!key) return json({ error: "FORGE is not configured yet. Add OPENROUTER_API_KEY to Supabase Function Secrets." }, 503);
      reply = await callOpenAICompatible("https://openrouter.ai/api/v1/chat/completions", key, Deno.env.get("OPENROUTER_MODEL") || "openrouter/free", providerMessages, { "HTTP-Referer": allowedOrigin, "X-Title": "Itkan Rangers AI" });
    }
    if (!reply.trim()) return json({ error: "The selected model returned an empty response. Try again." }, 502);
    return json({ reply, model: persona.name, provider: persona.provider });
  } catch (error) {
    console.error("Rangers AI request failed:", error);
    return json({ error: error instanceof Error ? error.message : "The selected AI model could not complete the request." }, 502);
  }
});
