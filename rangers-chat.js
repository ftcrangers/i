(() => {
  const waitForClient = () => window.rangersSupabase;
  const client = waitForClient();
  if (!client) { console.warn("Rangers Chat: Supabase client is not ready."); return; }
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const style = document.createElement("style");
  style.textContent = `
    .rangers-chat-wrap{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,.8fr);gap:18px;align-items:start}
    .rangers-chat-card{background:var(--white);border:1px solid var(--line);border-radius:18px;padding:18px;min-width:0}
    .rangers-chat-card h3{font:800 1.05rem Manrope;color:var(--green-dark);margin-bottom:9px}
    .rangers-chat-meta{font-size:.8rem;color:var(--muted);margin-bottom:12px}
    .rangers-chat-feed{height:430px;overflow:auto;display:flex;flex-direction:column;gap:9px;padding:12px;background:var(--paper);border:1px solid var(--line);border-radius:13px}
    .rangers-chat-message{max-width:88%;align-self:flex-start;padding:9px 12px;background:var(--white);border:1px solid var(--line);border-radius:12px}
    .rangers-chat-message.mine{align-self:flex-end;background:var(--mint);border-color:var(--mint2)}
    .rangers-chat-message b{font-size:.75rem;color:var(--green-dark)}.rangers-chat-message p{font-size:.88rem;white-space:pre-wrap;overflow-wrap:anywhere}.rangers-chat-message time{display:block;font-size:.65rem;color:var(--muted);margin-top:4px}
    .rangers-chat-compose{display:flex;gap:8px;margin-top:10px}.rangers-chat-compose textarea{flex:1;min-width:0;min-height:48px;max-height:120px;resize:vertical;border:1px solid var(--line);border-radius:10px;padding:11px;background:var(--white);color:var(--ink)}
    .rangers-chat-compose button,.rangers-chat-action{border:0;border-radius:10px;background:var(--green);color:#fff;padding:10px 14px;font-weight:800}
    .rangers-chat-search{display:flex;gap:8px;margin:10px 0}.rangers-chat-search input{flex:1;min-width:0;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--white);color:var(--ink)}
    .rangers-chat-person{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--line)}
    .rangers-chat-person small{display:block;color:var(--muted);font-size:.72rem}.rangers-chat-person button{border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--mint);color:var(--green-dark);font-weight:800;font-size:.75rem}
    .rangers-chat-status{font-size:.8rem;color:var(--muted);min-height:22px;margin-top:8px}.rangers-chat-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.rangers-chat-tabs button{border:1px solid var(--line);border-radius:999px;background:var(--white);padding:8px 12px;color:var(--muted);font-weight:800}.rangers-chat-tabs button.active{background:var(--green);color:white}
    body[data-theme="dark"] .rangers-chat-card{background:var(--card);border-color:var(--line)}body[data-theme="dark"] .rangers-chat-card h3,body[data-theme="dark"] .rangers-chat-person button{color:var(--ink)}body[data-theme="dark"] .rangers-chat-feed{background:var(--paper)}body[data-theme="dark"] .rangers-chat-message{background:var(--card)}body[data-theme="dark"] .rangers-chat-message.mine{background:var(--mint)}
    @media(max-width:820px){.rangers-chat-wrap{grid-template-columns:1fr}.rangers-chat-feed{height:360px}}
  `;
  document.head.append(style);
  const page = document.getElementById("page-chat");
  if (!page) return;
  const navLinks = [...document.querySelectorAll('[data-page-link="chat"]')];
  const setStatus = (el, msg, bad=false) => { if(el){el.textContent=msg;el.style.color=bad?"#b94a42":"";} };
  let user=null, profile=null, selected=null, channel=null, people=[];
  const chatRoot = page.querySelector("#rangersChatRoot");
  async function loadProfile(){
    const {data:{session}}=await client.auth.getSession();
    user=session?.user||null;
    navLinks.forEach(a=>a.hidden=!user);
    if(!user){profile=null;selected=null;chatRoot.innerHTML='<div class="auth-card"><h2>Rangers Chat</h2><p>Sign in to join the global team chat, add Rangers by username, and send private messages.</p><button class="btn btn-primary" id="rangersChatLogin">Open login</button></div>';chatRoot.querySelector("#rangersChatLogin").onclick=()=>document.getElementById("rangersCloudLaunch")?.click();return;}
    const mine=await client.rpc("rangers_my_chat_profile");
    if(mine.error||!mine.data?.length){chatRoot.innerHTML='<div class="notice">Your chat profile is not ready. Make sure the Rangers community migration has been run in Supabase.</div>';return;}
    profile=mine.data[0];
    await loadPeople();
    render();
    await loadMessages();
    subscribe();
  }
  async function loadPeople(){
    const result=await client.rpc("rangers_chat_people");
    people=result.data||[];
    if(result.error)console.warn("Could not load Rangers contacts:",result.error.message);
  }
  function render(){
    chatRoot.innerHTML='<div class="section-head"><span class="eyebrow">Rangers community</span><h2>Team <span class="accent">Chat.</span></h2><p>Global questions, team connections, and private conversations. Your username is <b>@'+esc(profile.username)+'</b>.</p></div><div class="rangers-chat-wrap"><section class="rangers-chat-card"><h3 id="rangersChatTitle">Global chat</h3><p class="rangers-chat-meta" id="rangersChatMeta">Ask questions and share helpful robotics knowledge with signed-in Rangers members.</p><div class="rangers-chat-feed" id="rangersChatFeed" aria-live="polite"></div><form class="rangers-chat-compose" id="rangersChatForm"><textarea id="rangersChatInput" maxlength="1200" placeholder="Write a message…" required></textarea><button type="submit">Send</button></form><div class="rangers-chat-status" id="rangersChatStatus" aria-live="polite"></div></section><aside class="rangers-chat-card"><h3>People</h3><p class="rangers-chat-meta">Add someone with their exact username. Private chats are available with accepted friends and team owners/co-owners.</p><form class="rangers-chat-search" id="rangersChatFind"><input id="rangersChatUsername" maxlength="40" placeholder="username (without @)" required><button class="rangers-chat-action">Find</button></form><div id="rangersChatSearchResult"></div><div class="rangers-chat-tabs"><button type="button" class="active" data-chat-list="all">Contacts</button><button type="button" data-chat-list="incoming">Requests</button></div><div id="rangersChatPeople"></div><button type="button" class="rangers-chat-action" id="rangersChatGlobal" style="margin-top:12px">Back to global chat</button></aside></div><p class="source-note">Be respectful. Do not post passwords, personal contact details, or private information. Messages are visible to the chat participants shown.</p>';
    renderPeople();
    chatRoot.querySelector("#rangersChatFind").addEventListener("submit",findPerson);
    chatRoot.querySelectorAll("[data-chat-list]").forEach(b=>b.addEventListener("click",()=>{chatRoot.querySelectorAll("[data-chat-list]").forEach(x=>x.classList.toggle("active",x===b));renderPeople(b.dataset.chatList);}));
    chatRoot.querySelector("#rangersChatGlobal").onclick=()=>{selected=null;loadMessages();};
    chatRoot.querySelector("#rangersChatForm").addEventListener("submit",sendMessage);
  }
  function renderPeople(mode="all"){
    const host=chatRoot.querySelector("#rangersChatPeople");if(!host)return;
    const filtered=people.filter(p=>mode==="incoming"?p.relationship_status==="pending"&&p.request_direction==="incoming":mode==="all"&&(p.relationship_status==="accepted"||p.role==="owner"||p.role==="co_owner"));
    host.innerHTML=filtered.length?filtered.map(p=>'<div class="rangers-chat-person"><div><b>'+esc(p.display_name||p.username)+'</b><small>@'+esc(p.username)+' · '+(p.role==="owner"?"Owner":p.role==="co_owner"?"Co-owner":p.relationship_status==="pending"?"Request pending":"Friend")+'</small></div><div>'+(p.relationship_status==="pending"&&p.request_direction==="incoming"?'<button data-accept="'+p.id+'">Accept</button>':'<button data-chat-person="'+p.id+'">Message</button>')+'</div></div>').join(""):'<p class="rangers-chat-meta">'+(mode==="incoming"?"No pending requests.":"No contacts yet. Find someone by username above.")+'</p>';
    host.querySelectorAll("[data-accept]").forEach(b=>b.onclick=()=>acceptRequest(b.dataset.accept));
    host.querySelectorAll("[data-chat-person]").forEach(b=>b.onclick=()=>{selected=people.find(p=>p.id===b.dataset.chatPerson);loadMessages();});
  }
  async function findPerson(e){
    e.preventDefault();const input=chatRoot.querySelector("#rangersChatUsername"),host=chatRoot.querySelector("#rangersChatSearchResult"),name=input.value.trim().replace(/^@/,"");
    const {data,error}=await client.rpc("rangers_find_chat_users",{p_username:name});
    if(error){host.textContent="Could not search users. Check that the database migration has been run.";return;}
    const p=data?.[0];if(!p){host.textContent="No user found with that username.";return;}
    const existing=people.find(x=>x.id===p.id);
    host.innerHTML='<div class="rangers-chat-person"><div><b>'+esc(p.display_name)+'</b><small>@'+esc(p.username)+' · '+(p.role==="owner"?"Owner":p.role==="co_owner"?"Co-owner":"Rangers member")+'</small></div><button id="rangersChatAdd">'+(existing?.relationship_status==="accepted"?"Message":existing?.request_direction==="incoming"?"Accept request":existing?.relationship_status==="pending"?"Request sent":"Add")+'</button></div>';
    host.querySelector("#rangersChatAdd").onclick=async()=>{
      if(existing?.relationship_status==="accepted"||p.role==="owner"||p.role==="co_owner"){selected=p;await loadMessages();return;}
      if(existing?.request_direction==="incoming"){await acceptRequest(p.id);return;}
      const result=await client.from("rangers_friendships").insert({requester_id:user.id,addressee_id:p.id,status:"pending"});
      if(result.error){setStatus(chatRoot.querySelector("#rangersChatStatus"),result.error.message,true);return;}
      setStatus(chatRoot.querySelector("#rangersChatStatus"),"Friend request sent.");await loadPeople();renderPeople();
    };
  }
  async function acceptRequest(id){
    const result=await client.from("rangers_friendships").update({status:"accepted",updated_at:new Date().toISOString()}).eq("requester_id",id).eq("addressee_id",user.id).eq("status","pending");
    if(result.error){setStatus(chatRoot.querySelector("#rangersChatStatus"),result.error.message,true);return;}
    await loadPeople();renderPeople("incoming");renderPeople();
  }
  async function loadMessages(){
    if(!chatRoot.querySelector("#rangersChatFeed"))return;
    const title=chatRoot.querySelector("#rangersChatTitle"),meta=chatRoot.querySelector("#rangersChatMeta"),feed=chatRoot.querySelector("#rangersChatFeed");
    title.textContent=selected?"Private chat with "+(selected.display_name||selected.username):"Global chat";
    meta.textContent=selected?"Private conversation · @"+selected.username:"Ask questions and share helpful robotics knowledge with signed-in Rangers members.";
    let query=client.from("rangers_chat_messages").select("id,sender_id,recipient_id,sender_username,sender_display_name,body,created_at").order("created_at",{ascending:true}).limit(100);
    query=selected?query.or("and(sender_id.eq."+user.id+",recipient_id.eq."+selected.id+"),and(sender_id.eq."+selected.id+",recipient_id.eq."+user.id+")"):query.is("recipient_id",null);
    const result=await query;
    if(result.error){feed.innerHTML='<p class="rangers-chat-meta">Could not load messages. Check the community migration and table permissions.</p>';return;}
    paintMessages(result.data||[]);
  }
  function paintMessages(messages){
    const feed=chatRoot.querySelector("#rangersChatFeed");if(!feed)return;
    feed.innerHTML=messages.map(m=>'<article class="rangers-chat-message '+(m.sender_id===user.id?"mine":"")+'"><b>'+esc(m.sender_id===user.id?"You":m.sender_display_name||m.sender_username||"Rangers member")+' · @'+esc(m.sender_username)+'</b><p>'+esc(m.body)+'</p><time>'+new Date(m.created_at).toLocaleString()+'</time></article>').join("")||'<p class="rangers-chat-meta">No messages yet. Start the conversation!</p>';
    feed.scrollTop=feed.scrollHeight;
  }
  async function sendMessage(e){
    e.preventDefault();const input=chatRoot.querySelector("#rangersChatInput"),body=input.value.trim();if(!body)return;
    const status=chatRoot.querySelector("#rangersChatStatus");
    const result=await client.from("rangers_chat_messages").insert({sender_id:user.id,recipient_id:selected?.id||null,body});
    if(result.error){setStatus(status,result.error.message,true);return;}
    input.value="";await loadMessages();
  }
  function subscribe(){
    if(channel)client.removeChannel(channel);
    channel=client.channel("rangers-chat-live").on("postgres_changes",{event:"INSERT",schema:"public",table:"rangers_chat_messages"},payload=>{
      const m=payload.new;
      if(!selected&&m.recipient_id===null)loadMessages();
      else if(selected&&((m.sender_id===user.id&&m.recipient_id===selected.id)||(m.sender_id===selected.id&&m.recipient_id===user.id)))loadMessages();
    }).on("postgres_changes",{event:"*",schema:"public",table:"rangers_friendships"},async()=>{await loadPeople();renderPeople();}).subscribe();
  }
  document.addEventListener("click",e=>{
    const save=e.target.closest("[data-save-code]");
    if(!save)return;
    const selector=save.dataset.saveCode,editor=document.querySelector(selector);
    if(!editor){alert("Could not find the code editor.");return;}
    client.auth.getUser().then(async({data})=>{
      if(!data.user){alert("Sign in to save code to your Rangers Code Library.");return;}
      const title=prompt("Name this code project:",save.dataset.codeTitle||"My FTC Java code");
      if(!title?.trim())return;
      const result=await client.from("saved_code").insert({user_id:data.user.id,title:title.trim().slice(0,100),language:"java",code:editor.value});
      if(result.error)alert("Could not save code: "+result.error.message);else{save.textContent="✓ Saved to Code Library";save.disabled=true;}
    });
  });
  document.addEventListener("click",e=>{if(e.target.closest('[data-page-link="chat"]'))setTimeout(loadProfile,0);});
  window.addEventListener("hashchange",()=>{if(location.hash==="#chat")loadProfile();});
  window.addEventListener("rangers-auth-state",()=>{if(location.hash==="#chat"||page.classList.contains("active"))loadProfile();else{client.auth.getSession().then(({data})=>navLinks.forEach(a=>a.hidden=!data.session));}});
  if(location.hash==="#chat")loadProfile();else client.auth.getSession().then(({data})=>navLinks.forEach(a=>a.hidden=!data.session));
})();
