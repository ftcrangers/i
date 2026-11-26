import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ftcrangers.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const origin = req.headers.get("Origin");
  if (origin && origin !== "https://ftcrangers.github.io") return json({ error: "This compiler is only available from the Rangers website." }, 403);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in to your Rangers account to use the Java compiler." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const compilerKey = Deno.env.get("ONLINECOMPILER_API_KEY");
  if (!url || !anon) return json({ error: "Supabase compiler authentication is not configured." }, 503);
  if (!compilerKey) return json({ error: "The Java compiler still needs its server-side API key. The site owner must add ONLINECOMPILER_API_KEY to Supabase Function Secrets." }, 503);

  const authClient = createClient(url, anon, { global: { headers: { Authorization: "Bearer " + token } } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Your session is invalid. Sign in again and retry." }, 401);

  let body: { code?: string; stdin?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  if (typeof body.code !== "string" || !body.code.trim()) return json({ error: "Enter Java code before compiling." }, 400);
  if (body.code.length > 30000) return json({ error: "Java source is too large. Keep it under 30,000 characters." }, 413);
  const stdin = typeof body.stdin === "string" ? body.stdin : "";
  if (stdin.length > 8000) return json({ error: "Program input is too large. Keep it under 8,000 characters." }, 413);

  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://api.onlinecompiler.io/api/v2/piston/execute", {
      method: "POST",
      headers: { Authorization: compilerKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "java",
        version: "15.0.2",
        files: [{ name: "Main.java", content: body.code }],
        stdin,
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000
      }),
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    console.error("Java compiler provider request failed:", error);
    return json({ error: "The compiler provider could not be reached. Please try again shortly." }, 502);
  }

  const raw = await providerResponse.text();
  let result: Record<string, unknown>;
  try { result = JSON.parse(raw); } catch { result = { error: raw.slice(0, 1200) }; }
  if (!providerResponse.ok) {
    console.error("Java compiler provider returned", providerResponse.status, result);
    const detail = typeof result.message === "string" ? result.message : "The compiler provider rejected the request.";
    return json({ error: "Compiler provider error (" + providerResponse.status + "): " + detail }, 502);
  }

  // Keep Piston-shaped responses intact; normalize compatible providers to the same shape.
  if (result.compile || result.run) return json(result);
  const exitCode = Number.isInteger(result.exit_code) ? Number(result.exit_code) : (result.status === "success" ? 0 : (result.error ? 1 : 0));
  const output = [result.output, result.error].filter(value => typeof value === "string" && value.length).join("\n");
  return json({ compile: { code: 0, output: "" }, run: { code: exitCode, output } });
});
