/* UI v2: sky-blue theme, side navigation, requests filters + accept all, clearer attendance method. Loaded last. */
document.head.insertAdjacentHTML('beforeend',`<style>
:root{--bg:#f1f8fd;--card:#fff;--tx:#0f2638;--mu:#587186;--pr:#0284c7;--prt:#fff;--hn:#7dd3fc;--hn2:#e3f3fc;--bd:#d6e7f3}
:root[data-theme="dark"]{--bg:#0b1620;--card:#12202d;--tx:#e6f1f9;--mu:#8fa8bc;--pr:#38bdf8;--prt:#04202f;--hn:#0369a1;--hn2:#10283a;--bd:#22384b}
.wrap{max-width:1100px}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:10px 14px;margin-bottom:14px;box-shadow:0 2px 10px rgba(2,132,199,.08)}
.who{display:flex;align-items:center;gap:10px;font-weight:600}.av{width:38px;height:38px;border-radius:50%;background:var(--pr);color:var(--prt);display:flex;align-items:center;justify-content:center;font-weight:700}
.burger{display:none}.shell{display:flex;gap:16px;align-items:flex-start}.content{flex:1;min-width:0}
.side{width:230px;flex-shrink:0;position:sticky;top:12px;background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:10px}
.side button{display:block;width:100%;text-align:right;background:transparent;color:var(--tx);border:0;padding:12px 14px;border-radius:12px;font-weight:500;margin:2px 0}
.side button:hover{background:var(--hn2)}.side button.on,.side button.on:hover{background:var(--pr);color:var(--prt)}
.content .tabs{gap:6px;border:0;background:var(--hn2);padding:4px;border-radius:12px;width:fit-content;max-width:100%}
.content .tabs button{border-radius:9px;padding:8px 14px;border:0}.content .tabs button.on{background:var(--pr);color:var(--prt);border:0}
.card{border-radius:16px;box-shadow:0 1px 6px rgba(2,132,199,.06)}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px}.chip{background:var(--hn2);color:var(--tx);border:1px solid var(--bd);border-radius:99px;padding:7px 14px}.chip.on{background:var(--pr);color:var(--prt)}
.bulk{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap}.who2{display:flex;gap:10px;align-items:center}
.opts{display:grid;grid-template-columns:1fr 1fr;gap:10px}.opt{border:2px solid var(--bd);border-radius:14px;padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:4px}.opt.on{border-color:var(--pr);background:var(--hn2)}.opt span{color:var(--mu);font-size:13px}.mins{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}.mins input{width:90px}
@media(max-width:800px){.burger{display:inline-block;width:auto}.shell{display:block}.side{display:none;position:fixed;top:72px;right:12px;left:12px;width:auto;z-index:20;box-shadow:0 12px 30px rgba(0,0,0,.3)}.side.open{display:block}}
@media(max-width:520px){.opts{grid-template-columns:1fr}}
</style>`);
{const m=document.querySelector('meta[name=theme-color]');if(m)m.content='#0284c7'}
const ICON={'الطلبات':'📥','المواد':'📚','التقارير':'📊','موادي':'📚','جدولي':'🗓️','الإعدادات':'⚙️','الرئيسية':'🏠'};
S.rf='all';
/* ---- admin requests ---- */
const rrole=r=>(r.profiles||{}).role,RL={student:'طالب',doctor:'دكتور',ta:'معيد'};
const rlist=()=>(S.reqs||[]).filter(r=>S.rf==='all'||rrole(r)===S.rf);
function reqView(){
  const L=S.reqs||[],cnt=k=>k==='all'?L.length:L.filter(r=>rrole(r)===k).length,list=rlist();
  return `<div class="card"><h3>طلبات الانضمام</h3><div class="chips">${[['all','الكل'],['student','الطلبة'],['doctor','الدكاترة'],['ta','المعيدين']].map(([k,t])=>`<button class="chip ${S.rf===k?'on':''}" onclick="S.rf='${k}';render()">${t} <b>${cnt(k)}</b></button>`).join('')}</div>
  ${list.length?`<div class="bulk"><button class="ok" onclick="bulk(true)">✔ قبول الكل (${list.length})</button><button class="bad" onclick="bulk(false)">✖ رفض الكل</button></div>`:''}
  ${list.map(r=>{const p=r.profiles||{};return `<div class="row"><div class="who2"><span class="av">${esc((p.full_name||'؟').trim()[0])}</span><div><b>${esc(p.full_name)}</b> <span class="tag">${RL[p.role]||''}</span><div class="mu">${esc(p.email)}${p.student_id?' · ID '+esc(p.student_id):''}${r.years?' · '+esc(r.years.name):''}</div></div></div><span><button class="ok" onclick="decide('${r.user_id}','${r.faculty_id}',true)">قبول</button> <button class="bad" onclick="decide('${r.user_id}','${r.faculty_id}',false)">رفض</button></span></div>`}).join('')||'<div class="mu">لا توجد طلبات في هذا القسم.</div>'}</div>`}
async function bulk(ok){const L=rlist();if(!L.length)return;if(!confirm((ok?'قبول ':'رفض ')+L.length+' طلب؟'))return;
  const rs=await Promise.all(L.map(r=>sb.rpc('approve_membership',{p_user:r.user_id,p_faculty:r.faculty_id,p_ok:ok})));const bad=rs.filter(x=>x.error).length;
  toast(bad?'تم، مع '+bad+' أخطاء':'تم ✅');await loadRequests();render()}
/* ---- attendance method card ---- */
function methodCard(u){
  const t=u.mode==='timer';
  return `<h3>طريقة التفعيل</h3><div class="mu" style="margin-bottom:10px">اختاري متى يقدر الطلبة يسجلوا الحضور:</div>
  <div class="opts"><div class="opt ${t?'':'on'}" onclick="ctl({p_mode:'auto'})"><b>⏰ تلقائي</b><span>مفتوح طول وقت المحاضرة: ${DAYS[u.day]} ${rng(u.start_time,u.end_time)}</span></div>
  <div class="opt ${t?'on':''}" onclick="ctl({p_mode:'timer'})"><b>⏱️ مؤقت يدوي</b><span>إنتي اللي تحددي مدة التسجيل</span></div></div>
  ${t?`<div class="mins"><span>المدة (دقيقة):</span>${[5,10,15,30].map(n=>`<button class="chip" onclick="$('#mn').value=${n}">${n}</button>`).join('')}<input id="mn" type="number" min="1" value="15"></div>
  <div class="bulk" style="margin-top:12px"><button class="ok" onclick="ctl({p_mode:'timer',p_minutes:+val('mn')||15})">▶ ابدأ التسجيل</button><button class="bad" onclick="ctl({p_minutes:0})">⏹ إيقاف</button></div>`:''}`}
/* ---- shell: side navigation ---- */
const _r2=window.render;
window.render=function(){
  _r2();const app=$('#app'),hd=app.querySelector(':scope > .hd');if(!S.me||!hd)return;
  const m=S.me,tabs=app.querySelector(':scope > .tabs'),body=[...app.children].filter(x=>x!==hd&&x!==tabs);
  const top=document.createElement('div');top.className='topbar';
  top.innerHTML=`<div class="who"><span class="av">${esc((m.full_name||'؟').trim()[0])}</span><span>${esc(m.full_name)} <span class="tag">${ROLE[m.role]}</span></span></div><span><button class="burger ghost" onclick="document.querySelector('.side').classList.toggle('open')">☰ القائمة</button> <button class="ghost" onclick="logout()">خروج</button></span>`;
  const shell=document.createElement('div');shell.className='shell';
  const btns=tabs?[...tabs.querySelectorAll('button')]:[];
  if(btns.length){const side=document.createElement('aside');side.className='side';
    btns.forEach(b=>{const c=b.cloneNode(true),t=c.textContent.trim();c.textContent=(ICON[t]||'•')+'  '+t;side.append(c)});shell.append(side)}
  const main=document.createElement('main');main.className='content';body.forEach(n=>main.append(n));shell.append(main);
  app.replaceChildren(top,shell);
  if(m.role==='admin'&&S.tab==='req'&&btns.length)main.innerHTML=reqView();
  if(S.uid&&S.sub==='met'&&S.units){const u=S.units.find(x=>x.id===S.uid),c=[...main.querySelectorAll('.card')].find(x=>x.textContent.includes('طريقة التفعيل'));if(u&&c)c.innerHTML=methodCard(u)}
};
render();
