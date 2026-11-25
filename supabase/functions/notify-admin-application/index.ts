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
    subject: `Rangers team access request · ${application.display_name}`,
    text: [
      "A new FTC Rangers team access request has been submitted.",
      "",
      "Applicant: " + application.display_name,
      "Email: " + application.applicant_email,
      "Submitted: " + new Date(application.created_at).toLocaleString(),
      "",
      "Application response:",
      application.reason,
      "",
      "Review securely: " + reviewUrl,
      "Sign in with an owner or co-owner account to review. This email does not grant permissions."
    ].join("\n"),
    html: `
      <div style="margin:0;padding:32px 14px;background:#eef4ef;font-family:Arial,Helvetica,sans-serif;color:#17251c">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dce8de;border-radius:18px;overflow:hidden">
          <div style="padding:25px 30px;background:linear-gradient(120deg,#0b2c20,#176b43);color:#ffffff">
            <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#bfe7ca">ITKAN RANGERS · FTC TEAM 28922</div>
            <h1 style="font-size:25px;line-height:1.2;margin:12px 0 5px;color:#ffffff">New team access request</h1>
            <p style="margin:0;color:#d8eee0;font-size:14px">An application is ready for your review.</p>
          </div>
          <div style="padding:28px 30px">
            <p style="margin:0 0 18px;color:#536459;font-size:14px;line-height:1.6">A member has submitted a request for additional Rangers platform permissions. Review the details below before making a decision.</p>
            <div style="padding:17px 18px;background:#f5f9f5;border:1px solid #e1ebe2;border-radius:12px">
              <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#688071">APPLICANT</div>
              <div style="font-size:18px;font-weight:700;color:#103d2b;margin:5px 0 13px">${safe(application.display_name)}</div>
              <div style="font-size:13px;color:#536459;line-height:1.8"><b style="color:#25392c">Email:</b> ${safe(application.applicant_email)}<br/><b style="color:#25392c">Submitted:</b> ${safe(new Date(application.created_at).toLocaleString())}</div>
            </div>
            <h2 style="font-size:15px;color:#103d2b;margin:24px 0 9px">Application response</h2>
            <div style="padding:16px;background:#fbfdfb;border-left:3px solid #d6aa48;border-radius:5px;color:#405148;font-size:14px;line-height:1.7;white-space:pre-wrap">${safe(application.reason)}</div>
            <div style="text-align:center;margin:27px 0 12px">
              <a href="${reviewUrl}" style="display:inline-block;padding:13px 22px;background:#176b43;color:#ffffff;border-radius:9px;text-decoration:none;font-size:14px;font-weight:700">Review application</a>
            </div>
            <p style="margin:18px 0 0;color:#748278;font-size:11px;line-height:1.6;text-align:center">For security, sign in with an owner or co-owner account to review this request. This notification does not grant access or change anyone's permissions.</p>
          </div>
          <div style="padding:16px 30px;background:#f5f8f5;border-top:1px solid #e4ece5;color:#819087;font-size:11px">ITKAN RANGERS · FTC Team 28922<br/>Automated account notification</div>
        </div>
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
