(() => {
  const client=window.rangersSupabase;
  if(!client){console.warn("Rangers Chat: Supabase is not ready.");return;}
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const page=document.getElementById("page-chat");if(!page)return;
  const root=page.querySelector("#rangersChatRoot");if(!root)return;
  const nav=[...document.querySelectorAll('[data-page-link="chat"]')];
  const style=document.createElement("style");
  style.textContent=`
    .rangers-chat-wrap{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(270px,.8fr);gap:18px;align-items:start}
    .rangers-chat-card{background:var(--white);border:1px solid var(--line);border-radius:18px;padding:18px;min-width:0}
    .rangers-chat-card h3{font:800 1.05rem Manrope;color:var(--green-dark);margin-bottom:9px}
    .rangers-chat-meta{font-size:.8rem;color:var(--muted);margin-bottom:12px}
    .rangers-chat-feed{height:420px;overflow:auto;display:flex;flex-direction:column;gap:9px;padding:12px;background:var(--paper);border:1px solid var(--line);border-radius:13px}
    .rangers-chat-message{max-width:88%;align-self:flex-start;padding:9px 12px;background:var(--white);border:1px solid var(--line);border-radius:12px}
    .rangers-chat-message.mine{align-self:flex-end;background:var(--mint);border-color:var(--mint2)}
    .rangers-chat-message b{font-size:.75rem;color:var(--green-dark)}.rangers-chat-message p{font-size:.88rem;white-space:pre-wrap;overflow-wrap:anywhere}.rangers-chat-message time{display:block;font-size:.65rem;color:var(--muted);margin-top:4px}
    .rangers-chat-compose{display:flex;gap:8px;margin-top:10px}.rangers-chat-compose textarea{flex:1;min-width:0;min-height:48px;max-height:120px;resize:vertical;border:1px solid var(--line);border-radius:10px;padding:11px;background:var(--white);color:var(--ink)}
    .rangers-chat-compose button,.rangers-chat-action{border:0;border-radius:10px;background:var(--green);color:#fff;padding:10px 14px;font-weight:800}
    .rangers-chat-search{display:flex;gap:8px;margin:10px 0}.rangers-chat-search input{flex:1;min-width:0;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--white);color:var(--ink)}
    .rangers-chat-person{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--line)}
    .rangers-chat-person small{display:block;color:var(--muted);font-size:.72rem}
    .rangers-chat-person button{border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--mint);color:var(--green-dark);font-weight:800;font-size:.75rem}
    .rangers-chat-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.rangers-chat-tabs button{border:1px solid var(--line);border-radius:999px;background:var(--white);padding:8px 12px;color:var(--muted);font-weight:800}.rangers-chat-tabs button.active{background:var(--green);color:white}
    .rangers-chat-section{margin-top:18px;padding-top:15px;border-top:1px solid var(--line)}
    .rangers-chat-owner{display:flex;justify-content:space-between;align-items:center;gap:9px;padding:11px;border:1px solid #cce2d1;background:linear-gradient(120deg,#eff8f1,#fff);border-radius:12px;margin:8px 0}
    .rangers-chat-owner b{display:block;color:#103d2b}.rangers-chat-owner small{display:block;color:#647269;font-size:.72rem}
    .rangers-chat-owner button{border:0;background:#176b43;color:white;border-radius:9px;padding:8px 11px;font-weight:800}
    .rangers-chat-group-list{display:grid;gap:7px;margin:10px 0}.rangers-chat-group-list button{width:100%;text-align:left;border:1px solid var(--line);background:var(--white);border-radius:10px;padding:10px;color:var(--ink);font-weight:800}
    .rangers-chat-group-list button.active{background:var(--mint);border-color:#8dbb99}
    .rangers-chat-create{display:grid;gap:8px;margin-top:10px}.rangers-chat-create input{width:100%;border:1px solid var(--line);border-radius:9px;padding:10px;background:var(--white);color:var(--ink)}
    .rangers-chat-status{font-size:.8rem;color:var(--muted);min-height:22px;margin-top:8px}
    body[data-theme="dark"] .rangers-chat-card{background:var(--card);border-color:var(--line)}body[data-theme="dark"] .rangers-chat-card h3{color:var(--ink)}body[data-theme="dark"] .rangers-chat-feed{background:var(--paper)}body[data-theme="dark"] .rangers-chat-message{background:var(--card)}body[data-theme="dark"] .rangers-chat-message.mine{background:var(--mint)}
    body[data-theme="dark"] .rangers-chat-owner{background:#142b1c;border-color:#315b3d}body[data-theme="dark"] .rangers-chat-owner b{color:#d9f2df}body[data-theme="dark"] .rangers-chat-owner small{color:#a8c3ae}
    @media(max-width:820px){.rangers-chat-wrap{grid-template-columns:1fr}.rangers-chat-feed{height:360px}}
  `;
  document.head.append(style);
  let user=null,profile=null,selected=null,channel=null,people=[],groups=[];
  const setStatus=(message,bad=false)=>{const el=root.querySelector("#rangersChatStatus");if(el){el.textContent=message;el.style.color=bad?"#b94a42":"";}};
  const isLeader=p=>p.role==="owner"||p.role==="co_owner";
  async function loadProfile(){
    const {data:{session}}=await client.auth.getSession();user=session?.user||null;
    nav.forEach(a=>a.hidden=!user);
    if(!user){profile=null;selected=null;root.innerHTML='<div class="auth-card"><h2>Rangers Chat</h2><p>Sign in to join group chats, contact the owners and co-owners, and message other Rangers members.</p><button class="btn btn-primary" id="rangersChatLogin">Open login</button></div>';root.querySelector("#rangersChatLogin").onclick=()=>document.getElementById("rangersCloudLaunch")?.click();return;}
    const mine=await client.rpc("rangers_my_chat_profile");
    if(mine.error||!mine.data?.length){root.innerHTML='<div class="notice">Your chat profile is not ready. Run the Rangers chat database migrations in Supabase.</div>';return;}
    profile=mine.data[0];await Promise.all([loadPeople(),loadGroups()]);render();await loadMessages();subscribe();
  }
  async function loadPeople(){const r=await client.rpc("rangers_chat_people");people=r.data||[];if(r.error)console.warn(r.error.message);}
  async function loadGroups(){const r=await client.rpc("rangers_my_chat_groups");groups=r.data||[];if(r.error)console.warn(r.error.message);}
  function render(){
    root.innerHTML='<div class="section-head"><span class="eyebrow">Rangers community</span><h2>Team <span class="accent">Chat.</span></h2><p>Signed in as <b>@'+esc(profile.username)+'</b>. Message leadership, start a group, or talk with the whole community.</p></div><div class="rangers-chat-wrap"><section class="rangers-chat-card"><h3 id="rangersChatTitle">Global chat</h3><p class="rangers-chat-meta" id="rangersChatMeta">Messages for all signed-in Rangers members.</p><div class="rangers-chat-feed" id="rangersChatFeed" aria-live="polite"></div><form class="rangers-chat-compose" id="rangersChatForm"><textarea id="rangersChatInput" maxlength="1200" placeholder="Write a message…" required></textarea><button type="submit">Send</button></form><div class="rangers-chat-status" id="rangersChatStatus" aria-live="polite"></div></section><aside class="rangers-chat-card"><h3>Quick contacts</h3><p class="rangers-chat-meta">Owners and co-owners are built-in contacts. No friend request needed.</p><div id="rangersChatLeaders"></div><div class="rangers-chat-section"><h3>Group chats</h3><div class="rangers-chat-group-list" id="rangersChatGroups"></div><form class="rangers-chat-create" id="rangersChatCreate"><input id="rangersChatGroupName" maxlength="60" placeholder="New group name" required><input id="rangersChatGroupMembers" placeholder="Invite usernames, separated by commas (optional)"><button class="rangers-chat-action">Create group</button></form></div><div class="rangers-chat-section"><h3>Find a Rangers member</h3><form class="rangers-chat-search" id="rangersChatFind"><input id="rangersChatUsername" maxlength="40" placeholder="username (without @)" required><button class="rangers-chat-action">Find</button></form><div id="rangersChatSearchResult"></div><div class="rangers-chat-tabs"><button type="button" class="active" data-chat-list="all">Contacts</button><button type="button" data-chat-list="incoming">Requests</button></div><div id="rangersChatPeople"></div><button type="button" class="rangers-chat-action" id="rangersChatGlobal" style="margin-top:12px">Back to global chat</button></div></aside></div><p class="source-note">Be respectful. Do not post passwords, personal contact details, or private information. Group messages are visible to group members; private messages are visible to their participants.</p>';
    renderLeaders();renderGroups();renderPeople();
    root.querySelector("#rangersChatFind").addEventListener("submit",findPerson);
    root.querySelector("#rangersChatCreate").addEventListener("submit",createGroup);
    root.querySelectorAll("[data-chat-list]").forEach(b=>b.addEventListener("click",()=>{root.querySelectorAll("[data-chat-list]").forEach(x=>x.classList.toggle("active",x===b));renderPeople(b.dataset.chatList);}));
    root.querySelector("#rangersChatGlobal").onclick=()=>{selected=null;loadMessages();};
    root.querySelector("#rangersChatForm").addEventListener("submit",sendMessage);
  }
  function renderLeaders(){
    const host=root.querySelector("#rangersChatLeaders");const leaders=people.filter(isLeader);
    host.innerHTML=leaders.length?leaders.map(p=>'<div class="rangers-chat-owner"><div><b>'+esc(p.display_name||p.username)+(p.role==="owner"?" · Owner":" · Co-owner")+'</b><small>@'+esc(p.username)+'</small></div><button data-leader-chat="'+p.id+'">Message</button></div>').join(""):'<p class="rangers-chat-meta">Leadership contacts will appear here once their accounts are set to Owner or Co-owner.</p>';
    host.querySelectorAll("[data-leader-chat]").forEach(b=>b.onclick=()=>{selected=people.find(p=>p.id===b.dataset.leaderChat);loadMessages();});
  }
  function renderGroups(){
    const host=root.querySelector("#rangersChatGroups");if(!host)return;
    host.innerHTML=groups.length?groups.map(g=>'<button type="button" class="'+(selected?.type==="group"&&selected.id===g.id?"active":"")+'" data-group-chat="'+g.id+'"># '+esc(g.name)+' <small> · '+g.member_count+' members</small></button>').join(""):'<p class="rangers-chat-meta">No group chats yet. Create one above.</p>';
    host.querySelectorAll("[data-group-chat]").forEach(b=>b.onclick=()=>{selected={type:"group",id:b.dataset.groupChat,name:groups.find(g=>g.id===b.dataset.groupChat)?.name};loadMessages();renderGroups();});
  }
  function renderPeople(mode="all"){
    const host=root.querySelector("#rangersChatPeople");if(!host)return;
    const filtered=people.filter(p=>mode==="incoming"?p.relationship_status==="pending"&&p.request_direction==="incoming":mode==="all"&&(p.relationship_status==="accepted"||isLeader(p)));
    host.innerHTML=filtered.length?filtered.map(p=>'<div class="rangers-chat-person"><div><b>'+esc(p.display_name||p.username)+'</b><small>@'+esc(p.username)+' · '+(p.role==="owner"?"Owner":p.role==="co_owner"?"Co-owner":p.relationship_status==="pending"?"Request pending":"Friend")+'</small></div>'+(p.relationship_status==="pending"&&p.request_direction==="incoming"?'<button data-accept="'+p.id+'">Accept</button>':'<button data-chat-person="'+p.id+'">Message</button>')+'</div>').join(""):'<p class="rangers-chat-meta">'+(mode==="incoming"?"No pending requests.":"No contacts yet. Find someone by username above.")+'</p>';
    host.querySelectorAll("[data-accept]").forEach(b=>b.onclick=()=>acceptRequest(b.dataset.accept));
    host.querySelectorAll("[data-chat-person]").forEach(b=>b.onclick=()=>{selected=people.find(p=>p.id===b.dataset.chatPerson);loadMessages();});
  }
  async function findPerson(e){
    e.preventDefault();const name=root.querySelector("#rangersChatUsername").value.trim().replace(/^@/,""),host=root.querySelector("#rangersChatSearchResult");
    const {data,error}=await client.rpc("rangers_find_chat_users",{p_username:name});if(error){host.textContent="Could not search users. Check the chat migration.";return;}
    const p=data?.[0];if(!p){host.textContent="No user found with that username.";return;}
    const existing=people.find(x=>x.id===p.id);
    host.innerHTML='<div class="rangers-chat-person"><div><b>'+esc(p.display_name||p.username)+'</b><small>@'+esc(p.username)+' · '+(isLeader(p)?"Leadership":"Rangers member")+'</small></div><button id="rangersChatAdd">'+(existing?.relationship_status==="accepted"||isLeader(p)?"Message":existing?.request_direction==="incoming"?"Accept request":existing?.relationship_status==="pending"?"Request sent":"Add")+'</button></div>';
    host.querySelector("#rangersChatAdd").onclick=async()=>{
      if(existing?.relationship_status==="accepted"||isLeader(p)){selected=p;await loadMessages();return;}
      if(existing?.request_direction==="incoming"){await acceptRequest(p.id);return;}
      const result=await client.from("rangers_friendships").insert({requester_id:user.id,addressee_id:p.id,status:"pending"});
      if(result.error){setStatus(result.error.message,true);return;}setStatus("Friend request sent.");await loadPeople();renderPeople();
    };
  }
  async function acceptRequest(id){
    const r=await client.from("rangers_friendships").update({status:"accepted",updated_at:new Date().toISOString()}).eq("requester_id",id).eq("addressee_id",user.id).eq("status","pending");
    if(r.error){setStatus(r.error.message,true);return;}await loadPeople();renderPeople("incoming");renderPeople();renderLeaders();
  }
  async function createGroup(e){
    e.preventDefault();const name=root.querySelector("#rangersChatGroupName").value.trim(),raw=root.querySelector("#rangersChatGroupMembers").value.trim();
    const usernames=raw.split(",").map(x=>x.trim().replace(/^@/,"")).filter(Boolean),ids=[];
    for(const username of usernames){const found=await client.rpc("rangers_find_chat_users",{p_username:username});if(found.error||!found.data?.length){setStatus("Could not find @"+username+". Check the spelling.",true);return;}ids.push(found.data[0].id);}
    const created=await client.rpc("rangers_create_chat_group",{p_name:name,p_member_ids:ids});
    if(created.error){setStatus(created.error.message,true);return;}
    await loadGroups();selected={type:"group",id:created.data,name};renderGroups();root.querySelector("#rangersChatGroupName").value="";root.querySelector("#rangersChatGroupMembers").value="";setStatus("Group created.");await loadMessages();
  }
  async function loadMessages(){
    const feed=root.querySelector("#rangersChatFeed");if(!feed)return;
    const title=root.querySelector("#rangersChatTitle"),meta=root.querySelector("#rangersChatMeta");
    let query=client.from("rangers_chat_messages").select("id,sender_id,recipient_id,group_id,sender_username,sender_display_name,body,created_at").order("created_at",{ascending:true}).limit(150);
    if(selected?.type==="group"){title.textContent="# "+selected.name;meta.textContent="Group conversation · visible to group members only.";query=query.eq("group_id",selected.id);}
    else if(selected){title.textContent="Private chat with "+(selected.display_name||selected.username);meta.textContent="Private conversation · @"+selected.username;query=query.is("group_id",null).or("and(sender_id.eq."+user.id+",recipient_id.eq."+selected.id+"),and(sender_id.eq."+selected.id+",recipient_id.eq."+user.id+")");}
    else{title.textContent="Global chat";meta.textContent="Ask questions and share helpful robotics knowledge with signed-in Rangers members.";query=query.is("group_id",null).is("recipient_id",null);}
    const result=await query;if(result.error){feed.innerHTML='<p class="rangers-chat-meta">Could not load messages: '+esc(result.error.message)+'</p>';return;}paintMessages(result.data||[]);
  }
  function paintMessages(messages){
    const feed=root.querySelector("#rangersChatFeed");if(!feed)return;
    feed.innerHTML=messages.map(m=>'<article class="rangers-chat-message '+(m.sender_id===user.id?"mine":"")+'"><b>'+esc(m.sender_id===user.id?"You":m.sender_display_name||m.sender_username||"Rangers member")+' · @'+esc(m.sender_username)+'</b><p>'+esc(m.body)+'</p><time>'+new Date(m.created_at).toLocaleString()+'</time></article>').join("")||'<p class="rangers-chat-meta">No messages yet. Start the conversation!</p>';
    feed.scrollTop=feed.scrollHeight;
  }
  async function sendMessage(e){
    e.preventDefault();const input=root.querySelector("#rangersChatInput"),body=input.value.trim();if(!body)return;
    const payload={sender_id:user.id,body};
    if(selected?.type==="group")payload.group_id=selected.id;
    else if(selected)payload.recipient_id=selected.id;
    const r=await client.from("rangers_chat_messages").insert(payload);if(r.error){setStatus(r.error.message,true);return;}
    input.value="";await loadMessages();
  }
  function subscribe(){
    if(channel)client.removeChannel(channel);
    channel=client.channel("rangers-chat-live-v2").on("postgres_changes",{event:"INSERT",schema:"public",table:"rangers_chat_messages"},payload=>{
      const m=payload.new;
      if(selected?.type==="group"&&m.group_id===selected.id)loadMessages();
      else if(selected&&selected.type!=="group"&&m.group_id===null&&((m.sender_id===user.id&&m.recipient_id===selected.id)||(m.sender_id===selected.id&&m.recipient_id===user.id)))loadMessages();
      else if(!selected&&m.group_id===null&&m.recipient_id===null)loadMessages();
    }).on("postgres_changes",{event:"*",schema:"public",table:"rangers_chat_group_members"},async()=>{await loadGroups();renderGroups();}).on("postgres_changes",{event:"*",schema:"public",table:"rangers_friendships"},async()=>{await loadPeople();renderPeople();renderLeaders();}).subscribe();
  }
  document.addEventListener("click",e=>{
    const save=e.target.closest("[data-save-code]");if(!save)return;
    const editor=document.querySelector(save.dataset.saveCode);if(!editor){alert("Could not find the code editor.");return;}
    client.auth.getUser().then(async({data})=>{
      if(!data.user){alert("Sign in to save code to your Rangers Code Library.");return;}
      const title=prompt("Name this code project:",save.dataset.codeTitle||"My FTC Java code");if(!title?.trim())return;
      const r=await client.from("saved_code").insert({user_id:data.user.id,title:title.trim().slice(0,100),language:"java",code:editor.value});
      if(r.error)alert("Could not save code: "+r.error.message);else{save.textContent="✓ Saved to Code Library";save.disabled=true;}
    });
  });
  document.addEventListener("click",e=>{if(e.target.closest('[data-page-link="chat"]'))setTimeout(loadProfile,0);});
  window.addEventListener("hashchange",()=>{if(location.hash==="#chat")loadProfile();});
  window.addEventListener("rangers-auth-state",()=>{if(location.hash==="#chat"||page.classList.contains("active"))loadProfile();else client.auth.getSession().then(({data})=>nav.forEach(a=>a.hidden=!data.session));});
  if(location.hash==="#chat")loadProfile();else client.auth.getSession().then(({data})=>nav.forEach(a=>a.hidden=!data.session));
})();