const MODELS = [
  {id:"moiz",name:"MOIZ",initial:"M",tag:"General assistant",provider:"Google AI Studio",description:"Your all-purpose Rangers assistant for questions, explanations, research, and everyday team work.",placeholder:"Ask MOIZ anything about robotics or beyond...",suggestions:["Help me plan a reliable FTC autonomous routine","Explain a Java concept with a complete example","Help me organize our next team meeting","Break down a difficult robotics concept"]},
  {id:"zum",name:"ZUM",initial:"Z",tag:"Programming",provider:"Groq",description:"Your programming specialist for FTC Java, debugging, architecture, and clean robot code.",placeholder:"Ask ZUM about FTC Java, debugging, or code structure...",suggestions:["Review this FTC Java method and find bugs","Explain Road Runner localization step by step","Help design a clean subsystem architecture","Why is my OpMode behaving inconsistently?"]},
  {id:"nayah",name:"NAYAH",initial:"N",tag:"Robot ideas",provider:"Cloudflare Workers AI",description:"Your idea partner for mechanisms, intakes, lifts, transfer systems, and creative robot concepts.",placeholder:"Ask NAYAH for mechanism ideas or design feedback...",suggestions:["Give me three compact intake concepts","How could we improve our transfer reliability?","Compare two ways to build a lift","Suggest a lightweight end-effector concept"]},
  {id:"fasheer",name:"FASHEER",initial:"F",tag:"Strategy & planning",provider:"Mistral Studio",description:"Your strategist for match plans, scouting, prioritization, testing, and season planning.",placeholder:"Ask FASHEER about strategy, scouting, or planning...",suggestions:["Create a match plan for a high-scoring alliance","Build a scouting sheet for our next event","Help prioritize our next two weeks of testing","Make a pit checklist for competition day"]},
  {id:"ranger",name:"RANGER",initial:"R",tag:"CAD & design",provider:"OpenRouter · free models",description:"Your CAD and mechanical design specialist for Onshape workflows, packaging, and design reviews.",placeholder:"Ask RANGER about CAD, Onshape, or mechanical design...",suggestions:["Review a mechanism concept for packaging risks","Help plan an Onshape assembly structure","Explain gear ratios for a mechanism","Make a design review checklist for our robot"]}
];
const state={model:"moiz",messages:[],busy:false,history:JSON.parse(localStorage.getItem("rangersAiHistory")||"[]")};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function active(){return MODELS.find(m=>m.id===state.model)||MODELS[0]}
function showStatus(message){$("status").textContent=message;$("status").hidden=!message}
function renderModels(){
  $("modelList").innerHTML=MODELS.map(m=>'<button class="model-choice '+(m.id===state.model?'active':'')+'" data-model="'+m.id+'"><span class="model-icon">'+m.initial+'</span><span><strong>'+m.name+'</strong><small>'+m.tag+'</small></span></button>').join("");
  $("modelList").querySelectorAll("[data-model]").forEach(b=>b.addEventListener("click",()=>switchModel(b.dataset.model)));
}
function switchModel(id){state.model=id;const m=active();$("activeName").textContent=m.name;$("activeAvatar").textContent=m.initial;$("activeDescription").textContent=m.description;$("providerPill").textContent=m.provider;$("prompt").placeholder=m.placeholder;renderModels();renderMessages();if(!state.messages.length)renderWelcome()}
function renderWelcome(){
  $("messages").innerHTML='<div class="welcome" id="welcome"><div class="welcome-mark">R</div><h2>What are we building today?</h2><p>'+esc(active().description)+'</p><div class="suggestions">'+active().suggestions.map(s=>'<button class="suggestion">'+esc(s)+'</button>').join("")+'</div></div>';
  $("messages").querySelectorAll(".suggestion").forEach(b=>b.addEventListener("click",()=>{$("prompt").value=b.textContent;$("prompt").focus();}));
}
function formatText(text){
  let safe=esc(text);
  safe=safe.replace(/```([\s\S]*?)```/g,(_,code)=>'<pre>'+code.trim()+'</pre>');
  safe=safe.replace(/`([^`]+)`/g,'<code>$1</code>');
  return safe;
}
function renderMessages(){
  const box=$("messages");
  if(!state.messages.length){renderWelcome();return}
  box.innerHTML=state.messages.map(m=>'<article class="message '+m.role+'"><div class="bubble-avatar">'+(m.role==="user"?"Y":active().initial)+'</div><div class="bubble">'+formatText(m.content)+'</div></article>').join("");
  box.scrollTop=box.scrollHeight;
}
function renderHistory(){
  $("historyList").innerHTML=state.history.slice(0,8).map((h,i)=>'<button data-history="'+i+'" title="'+esc(h.title)+'">'+esc(h.title)+'</button>').join("");
  $("historyList").querySelectorAll("[data-history]").forEach(b=>b.addEventListener("click",()=>{const h=state.history[Number(b.dataset.history)];state.model=h.model;state.messages=h.messages.slice();switchModel(state.model);renderMessages()}));
}
function saveHistory(){
  if(!state.messages.length)return;
  const first=state.messages.find(m=>m.role==="user")?.content||"New chat";
  state.history.unshift({title:first.slice(0,54),model:state.model,messages:state.messages.slice(),updatedAt:Date.now()});
  state.history=state.history.slice(0,15);
  localStorage.setItem("rangersAiHistory",JSON.stringify(state.history));
  renderHistory();
}
function newChat(){state.messages=[];switchModel(state.model);showStatus("");$("prompt").focus()}
async function sendMessage(text){
  const clean=text.trim();if(!clean||state.busy)return;
  state.messages.push({role:"user",content:clean});$("prompt").value="";renderMessages();state.busy=true;$("send").disabled=true;$("send").textContent="…";showStatus("");
  const typing=document.createElement("div");typing.className="typing";typing.textContent=active().name+" is thinking…";$("messages").append(typing);$("messages").scrollTop=$("messages").scrollHeight;
  try{
    const client=window.rangersSupabase;
    if(!client)throw new Error("Rangers sign-in is still loading. Refresh and try again.");
    const {data,error}=await client.auth.getSession();
    if(error||!data.session)throw new Error("Sign in to your Rangers account before using Rangers AI. Select Log in in the top bar.");
    const response=await fetch("https://hnhbavlgqbkxbvqdrlgh.supabase.co/functions/v1/rangers-ai",{
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":"sb_publishable_Lb2iv7AJ1bABxADToJ9g4Q_S6CczSYN","Authorization":"Bearer "+data.session.access_token},
      body:JSON.stringify({model:state.model,messages:state.messages.slice(-16)})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||"Rangers AI request failed ("+response.status+").");
    state.messages.push({role:"assistant",content:result.reply||"The model returned an empty response."});
    typing.remove();renderMessages();saveHistory();
  }catch(error){typing.remove();showStatus(error.message||"Could not contact Rangers AI.");renderMessages()}
  finally{state.busy=false;$("send").disabled=false;$("send").textContent="Send ↑";$("prompt").focus()}
}
$("composer").addEventListener("submit",e=>{e.preventDefault();sendMessage($("prompt").value)});
$("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("composer").requestSubmit()}});
$("prompt").addEventListener("input",()=>{$("prompt").style.height="auto";$("prompt").style.height=Math.min($("prompt").scrollHeight,170)+"px"});
$("newChat").addEventListener("click",newChat);
renderModels();renderWelcome();renderHistory();switchModel("moiz");
