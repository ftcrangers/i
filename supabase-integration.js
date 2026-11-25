import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const SUPABASE_URL = "https://hnhbavlgqbkxbvqdrlgh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Lb2iv7AJ1bABxADToJ9g4Q_S6CczSYN";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.rangersSupabase = supabase;

const dock = document.createElement("div");
dock.id = "rangersCloudDock";
dock.innerHTML = '<button id="rangersCloudLaunch" type="button" aria-label="Open Rangers account">◈ Log in</button>';
const siteNav = document.querySelector(".nav");
(siteNav || document.body).append(dock);
const modal = document.createElement("div");
modal.id = "rangersCloudModal";
modal.innerHTML = '<section id="rangersCloudPanel"><header class="rg-head"><div class="rg-brand">ITKAN RANGERS<small>ROBOTICS PLATFORM · STUDENT PORTAL</small></div><button class="rg-close" id="rgClose" type="button">×</button></header><main class="rg-content" id="rgContent"></main></section>';
document.body.append(modal);
const content = modal.querySelector("#rgContent");
const launch = dock.querySelector("button");
const close = () => modal.classList.remove("open");
launch.addEventListener("click", () => {modal.classList.add("open");render();});
function syncAccountButton(session){
  const user=session?.user;
  if(user){
    const name=user.user_metadata?.display_name || user.email?.split("@")[0] || "Account";
    launch.textContent="◈ "+name;
    launch.title=user.email || "Open your Rangers account";
    launch.setAttribute("aria-label","Open Rangers account for "+name);
    launch.dataset.signedIn="true";
  }else{
    launch.textContent="◈ Log in";
    launch.title="Log in or create a Rangers account";
    launch.setAttribute("aria-label","Log in to your Rangers account");
    launch.dataset.signedIn="false";
  }
}
window.rangersCloudSettingsEnabled=true;
async function hydrateAccountSettings(session){
  if(!session?.user)return;
  const {data,error}=await supabase.from("profiles").select("preferences").eq("id",session.user.id).maybeSingle();
  if(error||!data)return;
  await syncProfileSettings(session.user,data);
}
supabase.auth.getSession().then(({data})=>{
  syncAccountButton(data.session);
  hydrateAccountSettings(data.session);
});
modal.querySelector("#rgClose").addEventListener("click", close);
modal.addEventListener("click", e => {if(e.target===modal)close();});
document.addEventListener("keydown", e => {if(e.key==="Escape")close();});
const esc = v => String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const field = (label,id,type,placeholder) => '<div class="rg-field"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+type+'" placeholder="'+placeholder+'" required></div>';
const status = (message,error=false) => {const el=content.querySelector("#rgStatus");if(el){el.hidden=false;el.textContent=message;el.className="rg-status"+(error?" rg-error":"");}};
const getUser = async()=>{const r=await supabase.auth.getUser();return r.data.user;};

let syncingCloudSettings=false;
async function syncProfileSettings(user,profile){
  const local=window.rangersGetSettings50?.() || {};
  const remote=profile.preferences && typeof profile.preferences==="object" ? profile.preferences : {};
  if(Object.keys(remote).length){
    syncingCloudSettings=true;
    try{window.rangersApplySettings50?.(remote);}finally{syncingCloudSettings=false;}
  }else if(Object.keys(local).length){
    const {error}=await supabase.from("profiles").update({preferences:local}).eq("id",user.id);
    if(error)console.warn("Could not save initial Rangers preferences:",error.message);
  }
}
window.rangersSettingsChanged=async preferences=>{
  if(syncingCloudSettings)return;
  const user=await getUser();
  if(!user)return;
  const {error}=await supabase.from("profiles").update({preferences}).eq("id",user.id);
  if(error)console.warn("Rangers preferences remain saved on this device; cloud sync failed:",error.message);
};

async function render(){
  const user=await getUser();
  if(!user)return authView();

  // Repair profiles for accounts created before the profile trigger was installed.
  const setup=await supabase.rpc("ensure_my_profile");
  if(setup.error){
    console.error("Rangers profile bootstrap failed:",setup.error);
    return authView("You're signed in, but your profile needs a database update. Please contact the site owner. ("+setup.error.message+")");
  }

  const result=await supabase.from("profiles").select("*").eq("id",user.id).maybeSingle();
  if(result.error){
    console.error("Rangers profile lookup failed:",result.error);
    return authView("You're signed in, but your profile could not be loaded. ("+result.error.message+")");
  }
  if(!result.data)return authView("You're signed in, but your profile could not be created. Please contact the site owner.");
  await syncProfileSettings(user,result.data);
  dashboard(user,result.data);
}
function authView(message=""){
  content.innerHTML='<div class="rg-kicker">RANGERS IDENTITY</div><h1 class="rg-title">Your robotics journey, connected.</h1><p class="rg-sub">Save Academy progress, Java projects, achievements, and your Rangers profile across devices.</p><div class="rg-tabs"><button class="rg-tab active" data-auth="login">Log in</button><button class="rg-tab" data-auth="signup">Create account</button><button class="rg-tab" data-auth="reset">Reset password</button></div><div id="rgAuthForm"></div><div id="rgStatus" class="rg-status" '+(message?'':'hidden')+'>'+esc(message)+'</div>';
  const wrap=content.querySelector("#rgAuthForm");
  const draw=mode=>{
    content.querySelectorAll("[data-auth]").forEach(b=>b.classList.toggle("active",b.dataset.auth===mode));
    if(mode==="signup")wrap.innerHTML='<form id="rgAuthFormElement" class="rg-form">'+field("Display name","rgName","text","Your name")+field("Email address","rgEmail","email","you@example.com")+field("Password","rgPassword","password","At least 8 characters")+'<button class="rg-btn" type="submit">Create Rangers account</button><p class="rg-muted">Check your inbox to verify your email before logging in.</p></form>';
    else if(mode==="reset")wrap.innerHTML='<form id="rgAuthFormElement" class="rg-form">'+field("Email address","rgEmail","email","you@example.com")+'<button class="rg-btn" type="submit">Send password reset email</button></form>';
    else wrap.innerHTML='<form id="rgAuthFormElement" class="rg-form">'+field("Email address","rgEmail","email","you@example.com")+field("Password","rgPassword","password","Your password")+'<button class="rg-btn" type="submit">Log in</button></form>';
    wrap.querySelector("form").addEventListener("submit",async e=>{
      e.preventDefault();const email=wrap.querySelector("#rgEmail").value.trim().toLowerCase();const pass=wrap.querySelector("#rgPassword")?.value||"";const btn=e.currentTarget.querySelector("button");btn.disabled=true;
      try{
        if(mode==="signup"){
          const name=wrap.querySelector("#rgName").value.trim();if(pass.length<8)throw new Error("Password must be at least 8 characters.");
          const r=await supabase.auth.signUp({email,password:pass,options:{data:{display_name:name},emailRedirectTo:location.origin+location.pathname}});if(r.error)throw r.error;status("Account created. Check your email to confirm your address, then log in.");
        }else if(mode==="reset"){
          const r=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(r.error)throw r.error;status("Password reset email sent if the account exists.");
        }else{const r=await supabase.auth.signInWithPassword({email,password:pass});if(r.error)throw r.error;await render();}
      }catch(err){status(err.message||"Something went wrong.",true);}finally{btn.disabled=false;}
    });
  };
  content.querySelectorAll("[data-auth]").forEach(b=>b.addEventListener("click",()=>draw(b.dataset.auth)));
  draw("login");
}
async function dashboard(user,profile){
  const results=await Promise.all([
    supabase.from("user_xp").select("xp,level").eq("user_id",user.id).maybeSingle(),
    supabase.from("user_progress").select("academy,lesson_id,completed").eq("user_id",user.id),
    supabase.from("saved_code").select("id,title,language,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false}),
    supabase.from("user_achievements").select("achievement_id,achievements(title,icon)").eq("user_id",user.id)
  ]);
  const xp=results[0].data||{xp:0,level:1},progress=results[1].data||[],projects=results[2].data||[],badges=results[3].data||[];
  const completed=progress.filter(p=>p.completed).length,lead=["owner","co_owner"].includes(profile.role);
  content.innerHTML='<section class="rg-dashboard-hero"><div><div class="rg-kicker">RANGERS STUDENT PORTAL · '+esc(profile.role.toUpperCase())+'</div><h1 class="rg-title">Welcome back, '+esc(profile.display_name)+'.</h1><p class="rg-sub">Your learning progress, saved code, and team workspace — all in one place.</p></div><div class="rg-avatar" aria-hidden="true">'+esc((profile.display_name||"R").trim().charAt(0).toUpperCase())+'</div></section><div class="rg-grid rg-stat-grid"><article class="rg-card rg-stat-card"><span class="rg-card-label">EXPERIENCE POINTS</span><div class="rg-stat">'+Number(xp.xp).toLocaleString()+'</div><p>Level '+xp.level+'</p></article><article class="rg-card rg-stat-card"><span class="rg-card-label">LESSONS COMPLETED</span><div class="rg-stat">'+completed+'</div><p>Across both academies</p></article><article class="rg-card rg-stat-card"><span class="rg-card-label">SAVED PROJECTS</span><div class="rg-stat">'+projects.length+'</div><p>Java code workspace</p></article><article class="rg-card rg-stat-card"><span class="rg-card-label">ACHIEVEMENTS</span><div class="rg-stat">'+badges.length+'</div><p>Milestones earned</p></article></div><div class="rg-section-heading"><div><span class="rg-kicker">YOUR WORKSPACE</span><h2>Account dashboard</h2></div><span class="rg-account-email">'+esc(user.email||"")+'</span></div><div class="rg-tabs"><button class="rg-tab active" data-panel="home">Overview</button><button class="rg-tab" data-panel="code">Code projects</button><button class="rg-tab" data-panel="profile">Profile & privacy</button><button class="rg-tab" data-panel="settings">Site settings</button><button class="rg-tab" data-panel="apply">Admin application</button>'+(lead?'<button class="rg-tab" data-panel="review">Application review</button>':'')+'<button class="rg-tab" data-panel="leaderboard">Leaderboard</button></div><section id="rgPanel" class="rg-panel-surface"></section><div class="rg-footer-actions"><span class="rg-muted">Signed in securely with your Rangers account</span><button class="rg-btn secondary" id="rgLogout">Log out</button></div><div id="rgStatus" class="rg-status" hidden></div>'
  const panel=content.querySelector("#rgPanel");
  const show=async name=>{
    content.querySelectorAll("[data-panel]").forEach(b=>b.classList.toggle("active",b.dataset.panel===name));
    if(name==="home")panel.innerHTML='<div class="rg-grid"><article class="rg-card"><h3>CAD Academy</h3><p>'+progress.filter(p=>p.academy==="cad"&&p.completed).length+' completed lessons</p><div class="rg-meter"><span style="width:'+Math.min(100,progress.filter(p=>p.academy==="cad"&&p.completed).length*5)+'%"></span></div></article><article class="rg-card"><h3>Programming Academy</h3><p>'+progress.filter(p=>p.academy==="programming"&&p.completed).length+' completed lessons</p><div class="rg-meter"><span style="width:'+Math.min(100,progress.filter(p=>p.academy==="programming"&&p.completed).length*5)+'%"></span></div></article><article class="rg-card"><h3>Recent achievements</h3><p>'+ (badges.length?badges.map(b=>esc(b.achievements?.icon||"🏆")+" "+esc(b.achievements?.title||b.achievement_id)).join("<br>"):"Your earned badges will appear here as you complete learning milestones.")+'</p></article></div><p class="rg-muted rg-home-note">Your account data is private. Your site preferences sync to this account when you are signed in.</p>';
    if(name==="code"){
      const r=await supabase.from("saved_code").select("*").eq("user_id",user.id).order("updated_at",{ascending:false});const list=r.data||[];
      panel.innerHTML='<h2 class="rg-title" style="font-size:1.5rem">Cloud code workspace</h2><form id="rgCodeForm" class="rg-form">'+field("Project name","rgCodeTitle","text","Mecanum TeleOp")+'<div class="rg-field"><label for="rgCodeText">Java code</label><textarea id="rgCodeText" required placeholder="Write or paste Java code..."></textarea></div><button class="rg-btn">Save project to cloud</button></form><div id="rgProjects">'+list.map(p=>'<article class="rg-record"><strong>'+esc(p.title)+'</strong><small>'+esc(p.language)+' · '+new Date(p.updated_at).toLocaleString()+'</small><div class="rg-actions"><button class="rg-btn secondary" data-open="'+p.id+'">Open</button><button class="rg-btn danger" data-delete="'+p.id+'">Delete</button></div></article>').join("")+'</div>';
      panel.querySelector("#rgCodeForm").addEventListener("submit",async e=>{e.preventDefault();const r=await supabase.from("saved_code").insert({user_id:user.id,title:panel.querySelector("#rgCodeTitle").value.trim(),language:"java",code:panel.querySelector("#rgCodeText").value});if(r.error)status(r.error.message,true);else{status("Project saved.");show("code");}});
      panel.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",async()=>{const r=await supabase.from("saved_code").select("*").eq("id",b.dataset.open).eq("user_id",user.id).single();if(!r.error){panel.querySelector("#rgCodeTitle").value=r.data.title;panel.querySelector("#rgCodeText").value=r.data.code;}}));
      panel.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this project?"))return;const r=await supabase.from("saved_code").delete().eq("id",b.dataset.delete).eq("user_id",user.id);if(r.error)status(r.error.message,true);else show("code");}));
    }
    if(name==="profile"){
      panel.innerHTML='<h2 class="rg-title" style="font-size:1.5rem">Profile & privacy</h2><form id="rgProfileForm" class="rg-form">'+field("Display name","rgDisplayName","text","Your display name")+'<div class="rg-field"><label><input id="rgPublic" type="checkbox" style="width:auto"> Public student profile</label></div><div class="rg-field"><label><input id="rgOptIn" type="checkbox" style="width:auto"> Show me on XP leaderboard</label></div><button class="rg-btn">Save profile settings</button></form><p class="rg-muted">Email and private learning records are never shown publicly.</p>';
      panel.querySelector("#rgDisplayName").value=profile.display_name||"";panel.querySelector("#rgPublic").checked=!!profile.profile_public;panel.querySelector("#rgOptIn").checked=!!profile.leaderboard_opt_in;
      panel.querySelector("form").addEventListener("submit",async e=>{e.preventDefault();const r=await supabase.from("profiles").update({display_name:panel.querySelector("#rgDisplayName").value.trim(),profile_public:panel.querySelector("#rgPublic").checked,leaderboard_opt_in:panel.querySelector("#rgOptIn").checked}).eq("id",user.id);if(r.error)status(r.error.message,true);else{profile.display_name=panel.querySelector("#rgDisplayName").value.trim();profile.profile_public=panel.querySelector("#rgPublic").checked;profile.leaderboard_opt_in=panel.querySelector("#rgOptIn").checked;status("Profile saved.");}});
    }
    if(name==="settings"){
      panel.innerHTML='<div class="rg-settings-callout"><div><span class="rg-kicker">PERSONALIZE YOUR EXPERIENCE</span><h2 class="rg-title" style="font-size:1.45rem">Website settings</h2><p class="rg-sub">Your preferences are saved on this device and synced to your Rangers account while signed in.</p></div><button class="rg-btn" id="rgOpenSiteSettings" type="button">Open all 50 settings ↗</button></div>';
      panel.querySelector("#rgOpenSiteSettings").addEventListener("click",()=>{close();location.hash="#settings";});
    }
    if(name==="apply"){
      const ex=await supabase.from("admin_applications").select("status,assigned_role").eq("applicant_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
      panel.innerHTML='<h2 class="rg-title" style="font-size:1.5rem">Admin application</h2><p class="rg-sub">Submit a request for team permissions. Applying does not grant access.</p>'+(ex.data?'<div class="rg-status">Latest application: '+esc(ex.data.status.toUpperCase())+(ex.data.assigned_role?' · '+esc(ex.data.assigned_role):'')+'</div>':'')+'<form id="rgApplication" class="rg-form"><div class="rg-field"><label for="rgAppName">Display name</label><input id="rgAppName" value="'+esc(profile.display_name)+'" required></div><div class="rg-field"><label for="rgAppReason">Why should you be considered?</label><textarea id="rgAppReason" minlength="30" maxlength="2000" required></textarea></div><button class="rg-btn">Submit application</button></form>';
      panel.querySelector("form").addEventListener("submit",async e=>{e.preventDefault();const reason=panel.querySelector("#rgAppReason").value.trim();if(reason.length<30)return status("Please provide at least 30 characters.",true);const r=await supabase.from("admin_applications").insert({applicant_id:user.id,applicant_email:user.email,display_name:panel.querySelector("#rgAppName").value.trim(),reason}).select("id").single();if(r.error)return status(r.error.message,true);const mail=await supabase.functions.invoke("notify-admin-application",{body:{application_id:r.data.id}});if(mail.error)status("Application saved, but email notification failed. The owner can still review it in the dashboard. "+mail.error.message,true);else status("Application submitted. The owner has been notified.");});
    }
    if(name==="review"){
      const r=await supabase.from("admin_applications").select("*").order("created_at",{ascending:false}).limit(50);if(r.error){panel.textContent=r.error.message;return;}
      panel.innerHTML='<h2 class="rg-title" style="font-size:1.5rem">Application review</h2><p class="rg-sub">Only the owner and co-owner can review applications. Only the owner can appoint co-owners.</p>'+(r.data||[]).map(a=>'<article class="rg-record"><strong>'+esc(a.display_name)+' · '+esc(a.status.toUpperCase())+'</strong><small>'+esc(a.applicant_email)+' · '+new Date(a.created_at).toLocaleString()+'</small><p style="white-space:pre-wrap;color:#c0d4c5;margin-top:8px">'+esc(a.reason)+'</p>'+(a.status==="pending"?'<div class="rg-actions"><select id="role-'+a.id+'" style="background:#07100a;color:white;padding:9px;border:1px solid #31513c;border-radius:8px"><option value="admin">Admin</option><option value="co_owner" '+(profile.role==="co_owner"?"disabled":"") +'>Co-Owner</option></select><button class="rg-btn" data-approve="'+a.id+'">Approve</button><button class="rg-btn danger" data-reject="'+a.id+'">Reject</button></div>':'<p class="rg-muted">Reviewed · '+esc(a.assigned_role||"")+'</p>')+'</article>').join("")||'<p class="rg-muted">No applications yet.</p>';
      panel.querySelectorAll("[data-approve],[data-reject]").forEach(b=>b.addEventListener("click",async()=>{const approve=b.hasAttribute("data-approve"),id=approve?b.dataset.approve:b.dataset.reject,role=approve?panel.querySelector("#role-"+id).value:null;const rr=await supabase.rpc("review_admin_application",{p_application_id:id,p_decision:approve?"approve":"reject",p_role:role});if(rr.error)status(rr.error.message,true);else{status(approve?"Application approved.":"Application rejected.");show("review");}}));
    }
    if(name==="leaderboard"){
      const r=await supabase.from("public_leaderboard").select("display_name,xp,level").order("xp",{ascending:false}).limit(25);
      panel.innerHTML='<h2 class="rg-title" style="font-size:1.5rem">Rangers XP leaderboard</h2><p class="rg-sub">Only students who opt in and make their profile public appear here.</p>'+(r.error?'<p class="rg-status rg-error">Leaderboard unavailable until the SQL setup is applied.</p>':(r.data||[]).map((x,i)=>'<article class="rg-record"><strong>#'+(i+1)+' · '+esc(x.display_name)+'</strong><small>Level '+x.level+' · '+Number(x.xp).toLocaleString()+' XP</small></article>').join("")||'<p class="rg-muted">No students have opted in yet.</p>');
    }
  };
  content.querySelectorAll("[data-panel]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.panel)));
  content.querySelector("#rgLogout").addEventListener("click",async()=>{await supabase.auth.signOut();authView();});
  await show(location.hash==="#admin-applications"&&lead?"review":"home");
}
window.rangersCloudSyncProgress=async(academy,lessonId,completed=true)=>{
  const user=await getUser();if(!user)return {error:"Sign in to sync progress."};
  return supabase.from("user_progress").upsert({user_id:user.id,academy,lesson_id:String(lessonId),completed,completed_at:completed?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:"user_id,academy,lesson_id"});
};
supabase.auth.onAuthStateChange((_event,session)=>{
  syncAccountButton(session);
  if(session)hydrateAccountSettings(session);
  if(modal.classList.contains("open"))setTimeout(()=>session?render():authView(),0);
});
