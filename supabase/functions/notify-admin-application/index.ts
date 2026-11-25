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

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in is required." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  if (!url || !anon || !serviceKey || !resendKey || !from) {
    return json({ error: "Email notification service is not configured yet." }, 503);
  }

  const authClient = createClient(url, anon, { global: { headers: { Authorization: "Bearer " + token } } });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Invalid session." }, 401);

  let body: { application_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  if (!body.application_id) return json({ error: "application_id is required." }, 400);

  const admin = createClient(url, serviceKey);
  const { data: application, error: applicationError } = await admin
    .from("admin_applications")
    .select("id, applicant_id, applicant_email, display_name, reason, created_at")
    .eq("id", body.application_id)
    .eq("applicant_id", authData.user.id)
    .single();

  if (applicationError || !application) return json({ error: "Application not found for this account." }, 404);

  const safe = (value: string) => value.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c] || c));
  const reviewUrl = "https://ftcrangers.github.io/i/#admin-applications";
  const emailPayload = {
    from,
    to: ["humzanagaria@gmail.com"],
    subject: "New FTC Rangers admin application",
    html: `
      <div style="font-family:Arial,sans-serif;background:#08110b;color:#effff2;padding:28px;border-radius:14px">
        <h1 style="color:#72e596">New Rangers admin application</h1>
        <p><b>Applicant:</b> ${safe(application.display_name)}</p>
        <p><b>Email:</b> ${safe(application.applicant_email)}</p>
        <p><b>Submitted:</b> ${new Date(application.created_at).toLocaleString()}</p>
        <h3>Application response</h3>
        <p style="white-space:pre-wrap">${safe(application.reason)}</p>
        <p><a href="${reviewUrl}" style="display:inline-block;background:#1e7b40;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Open application review</a></p>
        <p style="color:#9bb4a1;font-size:12px">Sign in with your owner or co-owner account to review. This email link does not grant admin permissions.</p>
      </div>`
  };
  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
    body: JSON.stringify(emailPayload)
  });
  if (!emailResponse.ok) {
    const detail = await emailResponse.text();
    console.error("Resend error:", detail);
    return json({ error: "Application saved, but notification email could not be sent." }, 502);
  }
  return json({ success: true });
});
