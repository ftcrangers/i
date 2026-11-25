import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const SUPABASE_URL = "https://hnhbavlgqbkxbvqdrlgh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Lb2iv7AJ1bABxADToJ9g4Q_S6CczSYN";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.rangersSupabase = supabase;
function applySiteContent(data={}){
  const title=document.getElementById("siteHeroTitle"),subtitle=document.getElementById("siteHeroSubtitle"),description=document.getElementById("siteHeroDescription");
  if(title&&data.hero_title)title.textContent=data.hero_title;
  if(subtitle&&data.hero_subtitle)subtitle.textContent=data.hero_subtitle;
  if(description&&data.hero_description)description.textContent=data.hero_description;
  let banner=document.getElementById("rangersSiteAnnouncement");
  if(data.announcement_enabled&&data.announcement_body){
    if(!banner){banner=document.createElement("aside");banner.id="rangersSiteAnnouncement";banner.className="rangers-site-announcement";const hero=document.querySelector("#page-home .hero");if(hero)hero.insertAdjacentElement("afterend",banner);}
    banner.replaceChildren();const heading=document.createElement("strong"),body=document.createElement("span");heading.textContent=data.announcement_title||"Rangers update";body.textContent=data.announcement_body;banner.append(heading,body);
  }else if(banner)banner.remove();
}
window.rangersApplySiteContent=applySiteContent;
supabase.from("site_content").select("content").eq("id","global").maybeSingle().then(({data,error})=>{if(!error&&data?.content){window.rangersSiteContent=data.content;applySiteContent(data.content);}});

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
  const completed=progress.filter(p=>p.completed).length,lead=["owner","co_owner"].includes(profile.role),isOwner=profile.role==="owner";
  content.innerHTML='<section class="rg-dashboard-hero"><div><div class="rg-kicker">RANGERS STUDENT PORTAL · '+esc(profile.role.toUpperCase())+'</div><h1 class="rg-title">Welcome back, '+esc(profile.display_name)+'.</h1><p class="rg-sub">Your learning progress, saved code, and team workspace — all in one place.</p></div><div class="rg-avatar" aria-hidden="true">'+esc((profile.display_name||"R").trim().charAt(0).toUpperCase())+'</div></section><div class="rg-grid rg-stat-grid"><article class="rg-card rg-stat-card"><span class="rg-card-label">EXPERIENCE POINTS</span><div class="rg-stat">'+Number(xp.xp).toLocaleString()+'</div><p>Level '+xp.level+'</p></article><article class="rg-card rg-stat-card"><span class="rg-card-label">LESSONS COMPLETED</span><div class="rg-stat">'+completed+'</div><p>Across both academies</p></article><article class="rg-card rg-stat-card"><span class="rg-card-label">SAVED PROJECTS</span><div class="rg-stat">'+projects.length+'</div><p>Java code workspace</p></article><article class="rg-card rg-stat-card"><span class="rg-card-label">ACHIEVEMENTS</span><div class="rg-stat">'+badges.length+'</div><p>Milestones earned</p></article></div><div class="rg-section-heading"><div><span class="rg-kicker">YOUR WORKSPACE</span><h2>Account dashboard</h2></div><span class="rg-account-email">'+esc(user.email||"")+'</span></div><div class="rg-tabs"><button class="rg-tab active" data-panel="home">Overview</button><button class="rg-tab" data-panel="code">Code projects</button><button class="rg-tab" data-panel="profile">Profile & privacy</button><button class="rg-tab" data-panel="settings">Site settings</button><button class="rg-tab" data-panel="apply">Admin application</button>'+(lead?'<button class="rg-tab" data-panel="admin">Admin Center</button><button class="rg-tab" data-panel="site">Site editor</button><button class="rg-tab" data-panel="team">Team members</button><button class="rg-tab" data-panel="announcements">Announcements</button><button class="rg-tab" data-panel="review">Application review</button>':'')+'<button class="rg-tab" data-panel="leaderboard">Leaderboard</button></div><section id="rgPanel" class="rg-panel-surface"></section><div class="rg-footer-actions"><span class="rg-muted">Signed in securely with your Rangers account</span><button class="rg-btn secondary" id="rgLogout">Log out</button></div><div id="rgStatus" class="rg-status" hidden></div>'
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

    if(name==="admin"){
      const [members,apps,news,code]=await Promise.all([
        supabase.from("profiles").select("id",{count:"exact",head:true}),
        supabase.from("admin_applications").select("id",{count:"exact",head:true}).eq("status","pending"),
        supabase.from("announcements").select("id",{count:"exact",head:true}),
        supabase.from("saved_code").select("id",{count:"exact",head:true})
      ]);
      panel.innerHTML='<span class="rg-kicker">OWNER & TEAM LEAD WORKSPACE</span><h2 class="rg-title" style="font-size:1.6rem">Rangers Admin Center</h2><p class="rg-sub">Manage the website and team from one place.</p><div class="rg-grid rg-stat-grid"><article class="rg-card rg-stat-card"><span class="rg-card-label">ACCOUNTS</span><div class="rg-stat">'+(members.count??"—")+'</div></article><article class="rg-card rg-stat-card"><span class="rg-card-label">PENDING APPLICATIONS</span><div class="rg-stat">'+(apps.count??"—")+'</div></article><article class="rg-card rg-stat-card"><span class="rg-card-label">ANNOUNCEMENTS</span><div class="rg-stat">'+(news.count??"—")+'</div></article><article class="rg-card rg-stat-card"><span class="rg-card-label">SAVED CODE PROJECTS</span><div class="rg-stat">'+(code.count??"—")+'</div></article></div><div class="rg-admin-actions"><button class="rg-admin-action" data-admin-go="site"><b>✎ Site editor</b><span>Edit the homepage headline, introduction, and banner.</span></button><button class="rg-admin-action" data-admin-go="team"><b>♙ Team members</b><span>View accounts and manage member roles.</span></button><button class="rg-admin-action" data-admin-go="announcements"><b>▤ Announcements</b><span>Publish and remove team updates.</span></button><button class="rg-admin-action" data-admin-go="review"><b>✓ Application review</b><span>Review admin and co-owner applications.</span></button></div>';
      panel.querySelectorAll("[data-admin-go]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.adminGo)));
      if([members,apps,news,code].some(x=>x.error))status("Some statistics could not load. Check the database setup.",true);
    }
    if(name==="site"){
      const current=window.rangersSiteContent||{hero_title:"Built to think.",hero_subtitle:"Driven to build.",hero_description:"We are the Itkan Rangers, FTC Team 28922. We design, build, and program robots while learning to solve problems, work as a team, and share what we discover.",announcement_enabled:false,announcement_title:"Rangers update",announcement_body:""};
      panel.innerHTML='<span class="rg-kicker">LIVE WEBSITE CONTENT</span><h2 class="rg-title" style="font-size:1.55rem">Homepage editor</h2><p class="rg-sub">Change the homepage without editing HTML or opening GitHub.</p><form id="rgSiteEditor" class="rg-form rg-wide-form">'+field("Main headline","rgHeroTitle","text","Built to think.")+field("Second headline line","rgHeroSubtitle","text","Driven to build.")+'<div class="rg-field"><label for="rgHeroDescription">Homepage introduction</label><textarea id="rgHeroDescription" maxlength="500" required></textarea></div><div class="rg-editor-divider"></div><label class="rg-checkline"><input id="rgAnnouncementEnabled" type="checkbox"> Show announcement banner</label>'+field("Announcement title","rgAnnouncementTitle","text","Rangers update")+'<div class="rg-field"><label for="rgAnnouncementBody">Announcement message</label><textarea id="rgAnnouncementBody" maxlength="500"></textarea></div><div class="rg-actions"><button class="rg-btn" type="submit">Save and publish</button><button class="rg-btn secondary" id="rgSitePreview" type="button">Preview</button></div></form><p class="rg-muted">Only owner/co-owner accounts can publish homepage changes.</p>';
      panel.querySelector("#rgHeroTitle").value=current.hero_title||"";
      panel.querySelector("#rgHeroSubtitle").value=current.hero_subtitle||"";
      panel.querySelector("#rgHeroDescription").value=current.hero_description||"";
      panel.querySelector("#rgAnnouncementEnabled").checked=!!current.announcement_enabled;
      panel.querySelector("#rgAnnouncementTitle").value=current.announcement_title||"";
      panel.querySelector("#rgAnnouncementBody").value=current.announcement_body||"";
      const read=()=>({hero_title:panel.querySelector("#rgHeroTitle").value.trim(),hero_subtitle:panel.querySelector("#rgHeroSubtitle").value.trim(),hero_description:panel.querySelector("#rgHeroDescription").value.trim(),announcement_enabled:panel.querySelector("#rgAnnouncementEnabled").checked,announcement_title:panel.querySelector("#rgAnnouncementTitle").value.trim(),announcement_body:panel.querySelector("#rgAnnouncementBody").value.trim()});
      panel.querySelector("#rgSitePreview").addEventListener("click",()=>{window.rangersApplySiteContent(read());status("Preview applied. Save to publish for everyone.");});
      panel.querySelector("#rgSiteEditor").addEventListener("submit",async e=>{e.preventDefault();const data=read();if(!data.hero_title||!data.hero_subtitle||!data.hero_description)return status("Complete the headline and introduction.",true);if(data.announcement_enabled&&!data.announcement_body)return status("Add announcement text or turn the banner off.",true);const btn=e.currentTarget.querySelector('[type="submit"]');btn.disabled=true;const result=await supabase.from("site_content").upsert({id:"global",content:data,updated_at:new Date().toISOString()},{onConflict:"id"});btn.disabled=false;if(result.error)return status(result.error.message,true);window.rangersSiteContent=data;window.rangersApplySiteContent(data);status("Homepage changes saved and published.");});
    }
    if(name==="team"){
      const r=await supabase.from("profiles").select("id,email,display_name,role,created_at").order("created_at",{ascending:false}).limit(100);
      if(r.error){panel.innerHTML='<h2 class="rg-title">Team members</h2><p class="rg-status rg-error">'+esc(r.error.message)+'</p>';return;}
      panel.innerHTML='<span class="rg-kicker">ACCOUNT MANAGEMENT</span><h2 class="rg-title" style="font-size:1.55rem">Team members</h2><p class="rg-sub">Change member roles. Owner access is protected.</p>'+(r.data||[]).map(m=>'<article class="rg-record rg-member-record"><div><strong>'+esc(m.display_name||"Rangers member")+'</strong><small>'+esc(m.email)+' · Joined '+new Date(m.created_at).toLocaleDateString()+'</small></div><div class="rg-member-controls"><span class="rg-role-pill">'+esc(m.role.replace("_"," "))+'</span>'+(m.role==="owner"?'':'<select aria-label="Role for '+esc(m.email)+'" data-member-role="'+m.id+'"><option value="student" '+(m.role==="student"?"selected":"")+'>Student</option><option value="admin" '+(m.role==="admin"?"selected":"")+'>Admin</option><option value="co_owner" '+(m.role==="co_owner"?"selected":"")+(isOwner?"":" disabled")+'>Co-owner</option></select><button class="rg-btn secondary" data-save-role="'+m.id+'">Save role</button>')+'</div></article>').join("")||'<p class="rg-muted">No accounts found.</p>';
      panel.querySelectorAll("[data-save-role]").forEach(b=>b.addEventListener("click",async()=>{const id=b.dataset.saveRole,role=panel.querySelector('[data-member-role="'+id+'"]').value;const result=await supabase.rpc("set_member_role",{p_user_id:id,p_role:role});if(result.error)status(result.error.message,true);else{status("Member role updated.");show("team");}}));
    }
    if(name==="announcements"){
      const r=await supabase.from("announcements").select("*").order("created_at",{ascending:false}).limit(50);
      if(r.error){panel.innerHTML='<h2 class="rg-title">Announcements</h2><p class="rg-status rg-error">'+esc(r.error.message)+'</p>';return;}
      panel.innerHTML='<span class="rg-kicker">TEAM COMMUNICATIONS</span><h2 class="rg-title" style="font-size:1.55rem">Announcements</h2><p class="rg-sub">Published announcements are visible to signed-in team members.</p><form id="rgAnnouncementForm" class="rg-form">'+field("Announcement title","rgNewsTitle","text","Competition update")+'<div class="rg-field"><label for="rgNewsBody">Message</label><textarea id="rgNewsBody" maxlength="2000" required></textarea></div><label class="rg-checkline"><input id="rgNewsPublished" type="checkbox" checked> Publish immediately</label><button class="rg-btn">Create announcement</button></form><div class="rg-editor-divider"></div>'+(r.data||[]).map(a=>'<article class="rg-record"><strong>'+esc(a.title)+'</strong><small>'+new Date(a.created_at).toLocaleString()+' · '+(a.published?"Published":"Draft")+'</small><p class="rg-announcement-copy">'+esc(a.body)+'</p><div class="rg-actions"><button class="rg-btn secondary" data-toggle-news="'+a.id+'" data-published="'+a.published+'">'+(a.published?"Unpublish":"Publish")+'</button><button class="rg-btn danger" data-delete-news="'+a.id+'">Delete</button></div></article>').join("")||'<p class="rg-muted">No announcements yet.</p>';
      panel.querySelector("#rgAnnouncementForm").addEventListener("submit",async e=>{e.preventDefault();const title=panel.querySelector("#rgNewsTitle").value.trim(),body=panel.querySelector("#rgNewsBody").value.trim();if(!title||!body)return status("Add a title and message.",true);const result=await supabase.from("announcements").insert({created_by:user.id,title,body,published:panel.querySelector("#rgNewsPublished").checked});if(result.error)status(result.error.message,true);else{status("Announcement created.");show("announcements");}});
      panel.querySelectorAll("[data-toggle-news]").forEach(b=>b.addEventListener("click",async()=>{const result=await supabase.from("announcements").update({published:b.dataset.published!=="true"}).eq("id",b.dataset.toggleNews);if(result.error)status(result.error.message,true);else show("announcements");}));
      panel.querySelectorAll("[data-delete-news]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this announcement?"))return;const result=await supabase.from("announcements").delete().eq("id",b.dataset.deleteNews);if(result.error)status(result.error.message,true);else show("announcements");}));
    }
    if(name==="leaderboard"){
      const r=await supabase.from("public_leaderboard").select("display_name,xp,level").order("xp",{ascending:false}).limit(25);
      panel.innerHTML='<h2 class="rg-title" style="font-size:1.5rem">Rangers XP leaderboard</h2><p class="rg-sub">Only students who opt in and make their profile public appear here.</p>'+(r.error?'<p class="rg-status rg-error">Leaderboard unavailable until the SQL setup is applied.</p>':(r.data||[]).map((x,i)=>'<article class="rg-record"><strong>#'+(i+1)+' · '+esc(x.display_name)+'</strong><small>Level '+x.level+' · '+Number(x.xp).toLocaleString()+' XP</small></article>').join("")||'<p class="rg-muted">No students have opted in yet.</p>');
    }
  };
  content.querySelectorAll("[data-panel]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.panel)));
  content.querySelector("#rgLogout").addEventListener("click",async()=>{await supabase.auth.signOut();authView();});
  await show(location.hash==="#admin-applications"&&lead?"review":location.hash==="#admin"&&lead?"admin":"home");
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
