
(function(){
const extra=[...(window.rangersExtraCadLessons||[]),
["Design intent and master sketches","Plan wheel axes, frame rails, centerlines, and pivots in a master layout. Use datums, construction geometry, named dimensions, and fully constrained sketches so changes propagate predictably.","Build a top-view chassis skeleton with wheel axes and a pivot. Change the wheelbase and inspect dependent geometry."],
["Robust parametric part modeling","Build editable parts with fully constrained sketches, meaningful dimensions, stable references, and a readable feature tree. Prefer planes and named geometry over fragile transient edges.","Model a motor or bearing plate with editable hole spacing and thickness. Change a dimension without breaking features."],
["Hardware measurement and fit","Use the exact hardware revision and manufacturer drawings where possible. Record units and measurement sources. Account for fastener, shaft, bearing, printed-part, and tool clearances.","Measure one FTC component, model its mounting interface, and label datasheet dimensions separately from team measurements."],
["Multi-part design and references","Choose between multi-part Part Studios and separate reusable documents. In-context references can coordinate brackets and rails, but keep external references minimal, intentional, and stable.","Design a sensor bracket that remains aligned when its referenced chassis rail moves."],
["Assemblies, mates, and degrees of freedom","Mate connectors define coordinate frames. Fastened mates fix parts, revolute mates allow rotation, and slider mates allow linear travel. Ground a stable chassis reference and avoid over-constraint.","Assemble a chassis, wheel module, and pivoting arm. Demonstrate the intended degrees of freedom."],
["Mechanism motion and packaging","Check mechanisms through their full travel, not just the starting pose. Inspect collisions with chassis, adjacent mechanisms, game elements, wiring, field boundaries, and service access.","Model a lift or arm at low, middle, and high positions. Identify the tightest clearance and propose an improvement."],
["Configurations and design variants","Configurations represent controlled alternatives that share design intent, such as plate widths or arm lengths. Name variables and verify every variant rebuilds before release.","Create two chassis widths or arm lengths in one configurable model and choose the best fit."],
["Fasteners, bearings, and serviceability","Include critical fasteners, bearings, spacers, shaft collars, and tool access where they affect fit. Check assembly order and whether parts can be replaced without dismantling the whole robot.","Add a motor and bearing support. Demonstrate tool access and explain the service sequence."],
["3D-printable FTC part design","Design for the actual printer and material. Consider load direction, wall thickness, ribs, bosses, overhangs, support removal, and fit tolerance. Validate with a small prototype.","Design a printable sensor mount and document print orientation, fastener reinforcement, and prototype checks."],
["Drivetrain CAD and wheel geometry","Coordinate wheelbase, track width, wheel diameter, motor envelopes, bearing support, rail spacing, ground clearance, and service access. Mecanum roller orientation must match the intended layout.","Create a four-wheel drivetrain layout with wheel centers, motor positions, dimensions, and service-access checks."],
["Engineering drawings and release control","A drawing must communicate manufacturing intent with useful views, datum-based dimensions, hole callouts, units, material, part identity, and revision. Avoid duplicate or conflicting dimensions.","Release a motor plate drawing with front, top, side, hole locations, material, units, and revision."],
["Robot-level design review and iteration","Review the full robot envelope, mechanism motion, weight, wiring, maintenance, manufacturing, and rules. CAD is not proof of physical performance: record assumptions, risks, test evidence, and revision decisions.","Review a full robot concept. Record three risks, three dimensions to verify, one manufacturing concern, and a next prototype."]
];
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key="rangersAdvancedLessonPagesV1";
const load=()=>{try{return JSON.parse(localStorage.getItem(key)||"{}")}catch{return{}}};
const save=x=>localStorage.setItem(key,JSON.stringify(x));
function start(){
 const cadHost=document.getElementById("cadLessons"),progHost=document.getElementById("programLessons");
 if(!cadHost||!progHost)return;
 const parseCards=(host,track)=>[...host.querySelectorAll("article")].map((card,i)=>{
  const title=card.querySelector("h3")?.textContent.replace(/^\d+\s*[·.]\s*/,"")||("Lesson "+(i+1));
  const body=card.querySelector("p")?.textContent||"";
  const steps=[...card.querySelectorAll("details li")].map(x=>x.textContent);
  const task=card.querySelector(".lesson-task")?.textContent.replace(/^Practical task/i,"").trim()||card.querySelector("details")?.textContent||"Complete a practical build and document your result.";
  return{title,body,steps,task,track};
 });
 const cad=[...parseCards(cadHost,"CAD"),...extra.map(x=>({track:"CAD",title:x[0],body:x[1],task:x[2],steps:["Define the real hardware interface and design goal.","Create the feature or assembly using stable references and named dimensions.","Inspect fit, motion, tool access, and the model from multiple views.","Change a controlling dimension or component position and check what updates.","Record measurements, assumptions, and anything requiring physical validation."],checks:["The model meets the stated design goal.","Dimensions, references, fit, or motion have been checked.","Evidence and one improvement are documented."]}))];
 const prog=parseCards(progHost,"Programming");
 let current={track:"CAD",index:0,page:0};
 const style=document.createElement("style");
 style.textContent=".adv-academy-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin:16px 0}.adv-academy-card{border:1px solid var(--line,#dce8df);border-radius:16px;padding:17px;background:var(--card,#fff)}.adv-academy-card h3{margin:9px 0}.adv-academy-card p{color:var(--muted);line-height:1.55;font-size:.9rem}.adv-academy-card button{width:100%;margin-top:12px}.adv-academy-view{position:fixed;inset:0;z-index:10060;background:#07130de8;display:none;align-items:center;justify-content:center;padding:12px}.adv-academy-view.open{display:flex}.adv-academy-panel{width:min(900px,100%);max-height:96vh;overflow:auto;background:var(--card,#fff);color:var(--text,#183326);border-radius:20px}.adv-academy-head,.adv-academy-foot{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid var(--line,#dce8df);position:sticky;top:0;background:var(--card,#fff);z-index:2}.adv-academy-foot{top:auto;bottom:0;border-top:1px solid var(--line,#dce8df);border-bottom:0}.adv-academy-content{padding:22px;min-height:330px}.adv-academy-content p,.adv-academy-content li{line-height:1.7;color:var(--muted)}.adv-academy-block{padding:14px;border:1px solid var(--line,#dce8df);border-radius:12px;margin:12px 0;background:var(--soft,#f4f8f4)}.adv-academy-dots{display:flex;gap:6px;padding:0 20px}.adv-academy-dots span{height:6px;flex:1;border-radius:9px;background:#e4ece6}.adv-academy-dots .on{background:var(--green,#21834e)}.adv-academy-evidence{width:100%;min-height:125px;padding:12px;border:1px solid var(--line,#cbd9cf);border-radius:10px;font:inherit}.adv-academy-check{display:flex;gap:9px;padding:10px;border:1px solid var(--line,#dce8df);border-radius:10px;margin:8px 0}.adv-academy-result{padding:12px;border-radius:10px;background:var(--soft,#f1f7f2);margin-top:12px;font-weight:750}@media(max-width:600px){.adv-academy-content{padding:15px}.adv-academy-head,.adv-academy-foot{padding:12px}}";
 document.head.appendChild(style);
 const modal=document.createElement("div");modal.className="adv-academy-view";modal.id="advAcademyView";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");
 modal.innerHTML='<div class="adv-academy-panel"><div class="adv-academy-head"><div><div class="eyebrow" id="advTrack">ADVANCED ACADEMY</div><b id="advTitle">Lesson</b></div><button class="btn btn-soft btn-small" id="advClose">Close ✕</button></div><div class="adv-academy-dots" id="advDots"></div><div class="adv-academy-content" id="advContent"></div><div class="adv-academy-foot"><button class="btn btn-soft" id="advBack">← Previous</button><button class="btn btn-primary" id="advNext">Next page →</button></div></div>';
 document.body.appendChild(modal);
 const lessons=()=>current.track==="CAD"?cad:prog;
 const lesson=()=>lessons()[current.index];
 function data(){
  const l=lesson(),t=l.task||"Complete the practical activity and document the result.";
  if(current.page===0)return{label:"LEARN · 1 OF 4",title:"Understand the idea",body:l.body,blocks:[["Why it matters",current.track==="CAD"?"Good CAD communicates design intent so teammates can build, adjust, and repair the robot.":"Good programming makes robot behavior predictable and easier to debug."],["Learning goal","Explain "+l.title.toLowerCase()+" and identify where it appears on a real FTC robot."]]};
  if(current.page===1)return{label:"LEARN · 2 OF 4",title:"Work through the method",body:"Follow these steps in order. Inspect the result before moving on.",steps:l.steps};
  if(current.page===2)return{label:"LEARN · 3 OF 4",title:"Guided build challenge",body:t,blocks:[["What to produce",current.track==="CAD"?"A real Onshape part, assembly, drawing, or design-review artifact. Keep it editable and name features clearly.":"A working FTC SDK code change, OpMode, subsystem, or test routine."],["Evidence to collect","Save a screenshot, drawing, dimension table, code excerpt, or test log. You will use it on the final page."]]};
  return{label:"CHECK YOUR WORK · 4 OF 4",title:"Final practical test",body:"Use your actual Onshape document or FTC project. This checklist reviews your evidence; it cannot directly open Onshape, compile FTC code, or operate your robot.",blocks:[["Practical test",t],["Evidence",current.track==="CAD"?"Describe the feature or assembly you created and a dimension or motion check you performed.":"Describe the code you built, the test you ran, and the observed result. Do not claim a physical robot test if you only tested code."]],checks:l.checks||["The result meets the lesson requirements.","The work was checked in the intended environment.","Evidence and one improvement are documented."]};
 }
 function draw(){
  const l=lesson(),d=data(),id=current.track+"-"+current.index,s=load()[id]||{};
  document.getElementById("advTrack").textContent=(current.track==="CAD"?"CAD ACADEMY":"PROGRAMMING ACADEMY")+" · PAGE "+(current.page+1)+" OF 4";
  document.getElementById("advTitle").textContent=l.title;document.getElementById("advDots").innerHTML=[0,1,2,3].map(n=>'<span class="'+(n<=current.page?"on":"")+'"></span>').join("");
  let h='<div class="eyebrow">'+esc(d.label)+'</div><h2>'+esc(d.title)+'</h2><p>'+esc(d.body)+'</p>';
  if(d.steps)h+='<ol>'+d.steps.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ol>';
  if(d.blocks)d.blocks.forEach(x=>h+='<div class="adv-academy-block"><b>'+esc(x[0])+'</b><p>'+esc(x[1])+'</p></div>');
  if(current.page===3){h+='<label for="advEvidence"><b>Your evidence / test notes</b></label><textarea id="advEvidence" class="adv-academy-evidence" placeholder="What did you build? What did you test? What happened? What would you improve?">'+esc(s.evidence||"")+'</textarea>';h+=d.checks.map((x,i)=>'<label class="adv-academy-check"><input type="checkbox" data-adv-check="'+i+'" '+((s.checks||[]).includes(i)?"checked":"")+'><span>'+esc(x)+'</span></label>').join("");h+='<div class="adv-academy-result" id="advResult">'+(s.passed?"✓ Passed and saved on this device.":"Pass requires written evidence and all three review checks.")+'</div>'}
  document.getElementById("advContent").innerHTML=h;document.getElementById("advBack").disabled=current.page===0;document.getElementById("advNext").textContent=current.page===3?"Check my work":"Next page →";
  const all=load();all[id]={...all[id],lastPage:Math.max(all[id]?.lastPage||0,current.page)};save(all);
 }
 function render(host,list,track){
  host.innerHTML='<div class="adv-academy-grid">'+list.map((l,i)=>{const s=load()[track+"-"+i]||{};return '<article class="adv-academy-card"><div class="academy-lesson-meta"><span>'+(track==="CAD"?"CAD":"PROGRAMMING")+'</span><span>'+(s.passed?"✓ PASSED":"4 PAGES")+'</span></div><h3>'+String(i+1).padStart(2,"0")+' · '+esc(l.title)+'</h3><p>'+esc(l.body)+'</p><button class="btn btn-primary btn-small" data-adv-open="'+track+':'+i+'">'+(s.passed?"Review lesson":"Open lesson")+'</button></article>'}).join("")+'</div>';
  host.querySelectorAll("[data-adv-open]").forEach(b=>b.addEventListener("click",()=>{const a=b.dataset.advOpen.split(":");current={track:a[0],index:Number(a[1]),page:0};modal.classList.add("open");draw()}));
 }
 function submit(){
  const d=data(),e=document.getElementById("advEvidence").value.trim(),checks=[...document.querySelectorAll("[data-adv-check]")].filter(x=>x.checked).map(x=>Number(x.dataset.advCheck)),passed=e.length>=40&&checks.length===d.checks.length,id=current.track+"-"+current.index,all=load();
  all[id]={...(all[id]||{}),lastPage:3,evidence:e,checks,passed,submittedAt:new Date().toISOString()};save(all);
  document.getElementById("advResult").textContent=passed?"✓ Passed! Your evidence and review checks are saved on this device.":"Not passed. Add at least 40 characters about your actual work and check all three criteria.";
  if(passed){const xp=JSON.parse(localStorage.getItem("rangersPlatformXpV2")||"{}");const award="advanced-"+id;if(!xp[award]){xp[award]=60;localStorage.setItem("rangersPlatformXpV2",JSON.stringify(xp));}}
  render(cadHost,cad,"CAD");render(progHost,prog,"Programming");
 }
 document.getElementById("advClose").addEventListener("click",()=>modal.classList.remove("open"));modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});
 document.getElementById("advBack").addEventListener("click",()=>{if(current.page>0){current.page--;draw()}});
 document.getElementById("advNext").addEventListener("click",()=>{if(current.page<3){current.page++;draw()}else submit()});
 render(cadHost,cad,"CAD");render(progHost,prog,"Programming");
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();