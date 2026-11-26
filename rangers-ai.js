const MODELS=[
{id:"moiz",name:"MOIZ",tag:"General assistant",initials:"M",provider:"Groq"},
{id:"zumai",name:"ZUMAI",tag:"Programming specialist",initials:"Z",provider:"NVIDIA NIM"},
{id:"nuyah",name:"NUYAH",tag:"Robot ideas & innovation",initials:"N",provider:"OpenRouter"},
{id:"farsha",name:"FARSHA",tag:"Strategy & planning",initials:"F",provider:"Cloudflare Workers AI"},
{id:"ranger",name:"RANGER",tag:"Robotics research & review",initials:"R",provider:"SambaNova"}
];
const $=s=>document.querySelector(s);
let selected="moiz",history=[],busy=false,client=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function format(text){let safe=esc(text);safe=safe.replace(/```([\w+-]*)\n?([\s\S]*?)```/g,(_,lang,code)=>'<pre><code>'+code+'</code></pre>');safe=safe.replace(/`([^`]+)`/g,"<code>$1</code>");return safe;}
function activeModel(){return MODELS.find(m=>m.id===selected);}
function renderModels(){const model=activeModel();$("#modelList").innerHTML=MODELS.map(m=>'<button class="model '+(m.id===selected?"active":"")+'" data-model="'+m.id+'"><span class="model-icon">'+m.initials+'</span><span><b>'+m.name+'</b><small>'+m.tag+'</small></span></button>').join("");$("#mobileModels").innerHTML=MODELS.map(m=>'<button class="'+(m.id===selected?"active":"")+'" data-model="'+m.id+'">'+m.name+'</button>').join("");document.querySelectorAll("[data-model]").forEach(b=>b.addEventListener("click",()=>switchModel(b.dataset.model)));$("#currentTitle").innerHTML=model.name+' <span>'+model.tag+'</span>';$("#prompt").placeholder="Message "+model.name+"…";}
function switchModel(id){if(busy)return;selected=id;history=[];renderModels();renderMessages();setStatus("Switched to "+activeModel().name+".");}
function setStatus(t,bad=false){$("#status").textContent=t;$("#status").style.color=bad?"#b94a42":"";}
function renderMessages(){const host=$("#messages");if(!history.length){host.innerHTML=$("#welcome").outerHTML;host.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{$("#prompt").value=b.dataset.prompt;$("#prompt").focus();}));return;}host.innerHTML=history.map(m=>'<article class="message '+m.role+'"><div class="avatar">'+(m.role==="user"?"YOU":activeModel().initials)+'</div><div class="message-content"><div class="message-name">'+(m.role==="user"?"You":activeModel().name)+'</div><div class="message-text">'+format(m.content)+'</div></div></article>').join("");host.scrollTop=host.scrollHeight;}
function addMessage(role,content){history.push({role,content});renderMessages();}
async function getClient(){if(window.rangersSupabase)return window.rangersSupabase;for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,100));if(window.rangersSupabase)return window.rangersSupabase;}throw new Error("Rangers account service did not load. Refresh the page.");}
async function send(text){if(busy||!text.trim())return;try{client=await getClient();const {data:{session}}=await client.auth.getSession();if(!session){setStatus("Log in to your Rangers account before using Rangers AI.",true);document.getElementById("rangersCloudLaunch")?.click();return;}}catch(e){setStatus(e.message,true);return;}
busy=true;$("#sendButton").disabled=true;$("#prompt").disabled=true;addMessage("user",text.trim());setStatus(activeModel().name+" is thinking…");const typing=document.createElement("article");typing.className="message";typing.id="typing";typing.innerHTML='<div class="avatar">'+activeModel().initials+'</div><div class="message-content"><div class="message-name">'+activeModel().name+'</div><div class="typing"><i></i><i></i><i></i></div></div>';$("#messages").append(typing);$("#messages").scrollTop=$("#messages").scrollHeight;
try{const payload=history.slice(-12).map(m=>({role:m.role,content:m.content}));const {data,error}=await client.functions.invoke("rangers-ai",{body:{model:selected,messages:payload}});if(error)throw new Error(error.message||"The Rangers AI service could not be reached.");if(data?.error)throw new Error(data.error);if(!data?.reply)throw new Error("The AI provider returned an empty response.");$("#typing")?.remove();addMessage("assistant",data.reply);setStatus(activeModel().name+" · "+(data.provider||activeModel().provider));}
catch(e){$("#typing")?.remove();addMessage("assistant","I couldn't complete that request. "+e.message+"\n\nIf this keeps happening, ask the team site owner to check the Supabase Function Secrets and provider quota.");setStatus(e.message,true);}
finally{busy=false;$("#sendButton").disabled=false;$("#prompt").disabled=false;$("#prompt").focus();}}
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();const input=$("#prompt"),text=input.value;input.value="";input.style.height="";send(text);});
$("#prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("#chatForm").requestSubmit();}});
$("#prompt").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,180)+"px";});
$("#newChat").addEventListener("click",()=>{if(busy)return;history=[];renderMessages();setStatus("New conversation started.");});
$("#clearChat").addEventListener("click",()=>{if(busy)return;history=[];renderMessages();setStatus("Conversation cleared.");});
renderModels();renderMessages();
