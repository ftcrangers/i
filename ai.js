const MODELS = [
  {id:"moiz",name:"MOIZ",initial:"M",tag:"General",provider:"OpenRouter",description:"Your all-purpose Rangers assistant for questions, explanations, research, and everyday team work.",placeholder:"Ask MOIZ anything about robotics or beyond...",suggestions:["Help me plan a reliable FTC autonomous routine","Explain a Java concept with a complete example","Help me organize our next team meeting","Break down a difficult robotics concept"]},
  {id:"zum",name:"APEX",initial:"A",tag:"Programming",provider:"Groq",description:"Your programming specialist for FTC Java, debugging, architecture, and clean robot code.",placeholder:"Ask APEX about FTC Java, debugging, or code structure...",suggestions:["Review this FTC Java method and find bugs","Explain Road Runner localization step by step","Help design a clean subsystem architecture","Why is my OpMode behaving inconsistently?"]},
  {id:"nayah",name:"SPARK",initial:"S",tag:"Robot ideas",provider:"Cloudflare Workers AI",description:"Your idea partner for mechanisms, intakes, lifts, transfer systems, and creative robot concepts.",placeholder:"Ask SPARK for mechanism ideas or design feedback...",suggestions:["Give me three compact intake concepts","How could we improve our transfer reliability?","Compare two ways to build a lift","Suggest a lightweight end-effector concept"]},
  {id:"fasheer",name:"TACTIC",initial:"T",tag:"Strategy",provider:"Cohere",description:"Your strategist for match plans, scouting, prioritization, testing, and season planning.",placeholder:"Ask TACTIC about strategy, scouting, or planning...",suggestions:["Create a match plan for a high-scoring alliance","Build a scouting sheet for our next event","Help prioritize our next two weeks of testing","Make a pit checklist for competition day"]},
  {id:"ranger",name:"FORGE",initial:"F",tag:"CAD & design",provider:"OpenRouter",description:"Your CAD and mechanical design specialist for Onshape workflows, packaging, and design reviews.",placeholder:"Ask FORGE about CAD, Onshape, or mechanical design...",suggestions:["Review a mechanism concept for packaging risks","Help plan an Onshape assembly structure","Explain gear ratios for a mechanism","Make a design review checklist for our robot"]}
];
const STORAGE_KEY="rangersAiHistory";
const loadHistory=()=>{try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");return Array.isArray(value)?value:[]}catch{return[]}};
const state={model:"moiz",messages:[],busy:false,history:loadHistory(),activeChatId:null};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function active(){return MODELS.find(m=>m.id===state.model)||MODELS[0]}
function showStatus(message){$("status").textContent=message;$("status").hidden=!message}
function renderModelSelect(){
  $("modelSelect").innerHTML=MODELS.map(m=>'<option value="'+m.id+'" '+(m.id===state.model?'selected':'')+'>'+m.name+' · '+m.tag+'</option>').join("");
}
function switchModel(id){state.model=MODELS.some(m=>m.id===id)?id:"moiz";const m=active();$("prompt").placeholder=m.placeholder;renderModelSelect();renderWelcome();renderMessages();if(state.activeChatId)persistCurrent()}
function renderWelcome(){
  const m=active();
  $("welcome").innerHTML='<div class="welcome-mark">R</div><h1>What are we working on?</h1><p>'+esc(m.description)+'</p><div class="suggestions" id="suggestions">'+m.suggestions.map(s=>'<button class="suggestion" type="button">'+esc(s)+'</button>').join("")+'</div>';
  $("welcome").hidden=state.messages.length>0;
  $("welcome").querySelectorAll(".suggestion").forEach(b=>b.addEventListener("click",()=>{$("prompt").value=b.textContent;$("prompt").focus()}));
}
function formatText(text){
  let safe=esc(text);
  safe=safe.replace(/```([\s\S]*?)```/g,(_,code)=>'<pre>'+code.trim()+'</pre>');
  safe=safe.replace(/`([^`]+)`/g,'<code>$1</code>');
  return safe;
}
function renderMessages(){
  const box=$("messages");
  box.innerHTML=state.messages.map(m=>'<article class="message '+m.role+'"><div class="bubble-avatar">'+(m.role==="user"?"Y":active().initial)+'</div><div class="bubble">'+formatText(m.content)+'</div></article>').join("");
  $("welcome").hidden=state.messages.length>0;
  $("chatScroll").scrollTop=$("chatScroll").scrollHeight;
}
function makeTitle(messages){return (messages.find(m=>m.role==="user")?.content||"New chat").replace(/\s+/g," ").slice(0,58)}
function persistCurrent(){
  if(!state.messages.length)return;
  const item={id:state.activeChatId||("chat-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)),title:makeTitle(state.messages),model:state.model,messages:state.messages.slice(),updatedAt:Date.now()};
  state.activeChatId=item.id;
  const index=state.history.findIndex(h=>h.id===item.id);
  if(index>=0)state.history[index]=item;else state.history.unshift(item);
  state.history.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  state.history=state.history.slice(0,40);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.history))}catch{showStatus("This browser could not save more chat history. You can still continue this conversation.")}
  renderHistory();
}
function renderHistory(){
  const list=$("historyList");
  if(!state.history.length){list.innerHTML='<div class="empty-history">Your conversations will appear here.</div>';return}
  list.innerHTML=state.history.map(h=>'<button type="button" data-chat="'+esc(h.id)+'" class="'+(h.id===state.activeChatId?'active':'')+'" title="'+esc(h.title)+'">'+esc(h.title||"New chat")+'</button>').join("");
  list.querySelectorAll("[data-chat]").forEach(b=>b.addEventListener("click",()=>openChat(b.dataset.chat)));
}
function openChat(id){
  const h=state.history.find(item=>item.id===id);if(!h)return;
  state.activeChatId=h.id;state.model=h.model||"moiz";state.messages=Array.isArray(h.messages)?h.messages.slice():[];
  $("prompt").placeholder=active().placeholder;renderModelSelect();renderWelcome();renderMessages();renderHistory();showStatus("");$("sidebar").classList.remove("open");
}
function newChat(){
  if(state.messages.length)persistCurrent();
  state.messages=[];state.activeChatId=null;showStatus("");renderWelcome();renderMessages();renderHistory();$("prompt").value="";$("prompt").placeholder=active().placeholder;$("prompt").focus();$("sidebar").classList.remove("open");
}
async function sendMessage(text){
  const clean=text.trim();if(!clean||state.busy)return;
  state.messages.push({role:"user",content:clean});$("prompt").value="";persistCurrent();renderMessages();state.busy=true;$("send").disabled=true;showStatus("");
  const typing=document.createElement("div");typing.className="typing";typing.textContent=active().name+" is thinking…";$("messages").append(typing);$("chatScroll").scrollTop=$("chatScroll").scrollHeight;
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
    typing.remove();persistCurrent();renderMessages();
  }catch(error){typing.remove();showStatus(error.message||"Could not contact Rangers AI.");persistCurrent();renderMessages()}
  finally{state.busy=false;$("send").disabled=false;$("prompt").focus()}
}
$("composer").addEventListener("submit",e=>{e.preventDefault();sendMessage($("prompt").value)});
$("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("composer").requestSubmit()}});
$("prompt").addEventListener("input",()=>{$("prompt").style.height="auto";$("prompt").style.height=Math.min($("prompt").scrollHeight,170)+"px"});
$("modelSelect").addEventListener("change",e=>switchModel(e.target.value));
$("newChat").addEventListener("click",newChat);
$("openSidebar").addEventListener("click",()=>$("sidebar").classList.add("open"));
$("closeSidebar").addEventListener("click",()=>$("sidebar").classList.remove("open"));
renderModelSelect();renderWelcome();renderMessages();renderHistory();$("prompt").placeholder=active().placeholder;
