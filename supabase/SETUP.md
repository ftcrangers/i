# FTC Rangers Supabase setup

This folder contains the first Supabase integration foundation for the Rangers GitHub Pages site.

## 1. Run the database schema

1. Open the Supabase project dashboard.
2. Go to **SQL Editor**.
3. Choose **New query**.
4. Open `supabase/schema.sql` from this repository and copy its full contents.
5. Paste the SQL into the editor and run it.

The schema creates student profiles, progress, XP, achievements, saved code, admin applications, and team workspace tables. Row Level Security is enabled. The initial owner profile is assigned only when the verified auth user email is `humzanagaria@gmail.com`.

## 2. Configure Supabase Auth

In **Authentication → Sign In / Providers**:
- Enable Email.
- Keep email/password sign-in enabled.
- Enable email confirmation.

In **Authentication → URL Configuration**:
- Site URL: `https://ftcrangers.github.io/i/`
- Add redirect URL: `https://ftcrangers.github.io/i/**`

## 3. Configure the admin application email

The Edge Function sends application notifications to `humzanagaria@gmail.com`. It requires a Resend account and a verified sender identity.

Set these Supabase Edge Function secrets (never put them in the website source):
- `RESEND_API_KEY`: your private Resend API key.
- `RESEND_FROM`: a verified sender, for example `FTC Rangers <notifications@your-verified-domain>`.

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in its Edge Function environment. Do not expose the service-role key in client code.

Deploy from a local clone with the Supabase CLI:
```bash
supabase login
supabase link --project-ref hnhbavlgqbkxbvqdrlgh
supabase secrets set RESEND_API_KEY=your_private_key RESEND_FROM="FTC Rangers <notifications@your-verified-domain>"
supabase functions deploy notify-admin-application
```

Do not commit the Resend key or any service-role/database secret.

## 4. Initial owner account

Create an account using `humzanagaria@gmail.com` and verify that email. The database trigger assigns the Owner role and activates the owner's team membership. Do not create a different account and attempt to promote it from the browser.

## 5. What is included in this foundation

- Email signup, login, logout, and password reset UI.
- Black/green Rangers account portal.
- Personal profile privacy settings.
- Cloud Java project storage.
- Admin application submission and private review UI.
- Owner/co-owner review permissions and role assignment RPC.
- Public opt-in leaderboard view.
- Team data tables with row-level security.
- An authenticated Edge Function for admin application email notifications.

## 6. Follow-up integration work

The existing Academy and engineering tools currently use local browser storage. The helper `window.rangersCloudSyncProgress(academy, lessonId, completed)` is available for lesson-completion handlers, but those existing handlers still need to call it. Existing scouting, notebook, maintenance, and parts-list forms also need to be migrated to their Supabase tables before they become cross-device team workspace features.

The first migration intentionally does not automatically upload localStorage contents, because the data format and ownership need to be verified before moving existing student/team records.
