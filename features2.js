/* Batch 4 (schedule registration + section requests + section attendance) and Batch 5 (Excel). */
Object.assign(ERR,{no_attempts_left:'استهلكتي المحاولات الـ3 لتعديل الجدول',period_full:'الفترة دي اكتملت',duplicate_course:'اخترتي أكتر من فترة لنفس المادة',empty_schedule:'اختاري فترة واحدة على الأقل',use_submit_schedule:'استخدمي زرار حفظ الجدول'});
/* ---------- student: schedule ---------- */
const _lt=window.loadTab;
window.loadTab=async function(){await _lt();if(S.me.role==='student'&&S.tab==='sch')await loadSched()};
async function loadSched(){
  const [c,r,s]=await Promise.all([sb.from('courses').select('id,name,units(id,kind,name,day,start_time,end_time,capacity,sections(name))').order('name'),sb.from('section_requests').select('id,course_id,unit_id,status,created_at').eq('student_id',S.me.id).order('created_at'),sb.from('schedule_submissions').select('id',{count:'exact',head:true})]);
  S.sc=(c.data||[]).filter(x=>(x.units||[]).some(u=>u.kind==='period'));S.rq=r.data||[];S.used=s.count||0}
const plabel=u=>`${esc(u.sections&&u.sections.name||'')} - ${esc(u.name)} · ${DAYS[u.day]} ${t5(u.start_time)}-${t5(u.end_time)}${u.capacity?' (سعة '+u.capacity+')':''}`;
const popts=(c,sel)=>'<option value="">— بدون —</option>'+(c.units||[]).filter(u=>u.kind==='period').map(u=>`<option value="${u.id}" ${u.id===sel?'selected':''}>${plabel(u)}</option>`).join('');
const activeReq=cid=>S.rq.filter(r=>r.course_id===cid&&['pending','accepted'].includes(r.status)).pop();
function schedView(){
  const left=3-S.used;
  return `<div class="card"><h3>جدولي</h3><div class="row"><span>المحاولات المتبقية: <b>${Math.max(left,0)}</b> من 3</span><span class="mu">حفظ الجدول كله يحسب محاولة واحدة</span></div></div>
  ${S.sc.map(c=>{const a=activeReq(c.id),last=S.rq.filter(r=>r.course_id===c.id).pop(),rej=!a&&last&&last.status==='rejected';
    return `<div class="card"><div class="row" style="border:0"><b>${esc(c.name)}</b>${a?`<span class="tag">${a.status==='accepted'?'✅ مقبول':'⏳ بانتظار المعيد'}</span>`:rej?'<span class="tag">❌ مرفوض</span>':''}</div>
    <select id="pk_${c.id}" ${left<=0?'disabled':''}>${popts(c,a&&a.unit_id)}</select>
    ${rej?`<div class="mu" style="margin-top:8px">المعيد رفض طلبك، اختاري فترة بديلة (مجاناً، من غير ما تستهلكي محاولة):</div><select id="rj_${c.id}">${popts(c)}</select><button class="ghost" onclick="freePick('${c.id}')">اختيار البديلة</button>`:''}</div>`}).join('')||'<div class="card mu">لا توجد سكاشن متاحة لفرقتك بعد.</div>'}
  ${S.sc.length?`<button class="full big" ${left<=0?'disabled':''} onclick="saveSched()">حفظ الجدول</button>`:''}`}
async function saveSched(){
  const sel=S.sc.map(c=>({c,u:val('pk_'+c.id)})).filter(x=>x.u),chg=sel.filter(x=>{const a=activeReq(x.c.id);return !a||a.unit_id!==x.u});
  if(!sel.length)return toast('اختاري فترة واحدة على الأقل');if(!chg.length)return toast('لم تغيري أي حاجة');
  if(!confirm('الحفظ هيستهلك محاولة من 3. متأكدة؟'))return;
  const r=await sb.rpc('submit_schedule',{p_units:sel.map(x=>x.u)});
  if(r.error){const m=r.error.message||'',k=Object.keys(ERR).find(k=>m.includes(k));return toast(k?ERR[k]:errMsg(r.error))}
  toast('تم الحفظ ✅ المحاولات المتبقية: '+r.data);await go('sch')}
async function freePick(cid){const u=val('rj_'+cid);if(!u)return toast('اختاري فترة');const r=await sb.rpc('request_section',{p_unit:u});if(r.error){const m=r.error.message||'',k=Object.keys(ERR).find(k=>m.includes(k));return toast(k?ERR[k]:errMsg(r.error))}toast('تم إرسال الطلب ✅');await go('sch')}
/* ---------- student: course view with lecture + section attendance ---------- */
window.openCourse=async function(id){
  S.cid=id;S.ts=await termStart();const c=S.courses.find(x=>x.id===id);
  const rq=await sb.from('section_requests').select('unit_id').eq('student_id',S.me.id).eq('course_id',id).eq('status','accepted');
  const pu=(c.units||[]).find(u=>u.kind==='period'&&(rq.data||[]).some(x=>x.unit_id===u.id));
  S.cu=[(c.units||[]).find(u=>u.kind==='lecture'),pu].filter(Boolean);
  const l=await sb.from('courses').select('absence_limit_lecture,absence_limit_section').eq('id',id).single();S.lim=l.data||{};S.mineBy={};
  for(const u of S.cu){const s=await sb.from('sessions').select('id,date').eq('unit_id',u.id),ids=(s.data||[]).map(x=>x.id),a=ids.length?await sb.from('attendance').select('session_id').eq('student_id',S.me.id).in('session_id',ids):{data:[]},got=new Set((a.data||[]).map(x=>x.session_id));S.mineBy[u.id]=new Set((s.data||[]).filter(x=>got.has(x.id)).map(x=>x.date))}
  render()};
function blk(title,u,lim){
  const m=S.mineBy[u.id]||new Set(),ds=dates(u,S.ts),n=ds.length,pr=ds.filter(d=>m.has(d)).length,ab=n?Math.round((n-pr)/n*100):0,col=ab>=lim?'var(--bad)':ab>=lim*.7?'#e67700':'var(--ok)';
  return `<div class="card"><h3>${title}</h3><div class="row"><span>نسبة الغياب: <b style="color:${col}">${ab}%</b> (الحد ${lim}%)</span><span>${ab>=lim?'🚨 خطر':ab>=lim*.7?'⚠️ قريب من الخطر':'✅ آمن'}</span></div><div class="pbar"><i style="width:${Math.min(ab,100)}%;background:${col}"></i></div><div class="mu" style="margin:6px 0">حضرتي ${pr} من ${n}</div>
  <div class="scroll"><table><tr><th>التاريخ</th><th>الحالة</th></tr>${ds.slice().reverse().map(d=>`<tr><td>${d}</td><td style="color:var(--${m.has(d)?'ok':'bad'})">${m.has(d)?'✔ حضرتي':'✘ غياب'}</td></tr>`).join('')||'<tr><td colspan=2>لا يوجد بعد</td></tr>'}</table></div></div>`}
window.courseView=function(){
  const c=S.courses.find(x=>x.id===S.cid);
  return `<div class="card row"><b>${esc(c.name)}</b><button class="ghost" onclick="S.cid=null;render()">رجوع</button></div>
  <div class="card"><h3>تسجيل حضور</h3><video id="cam" playsinline muted style="display:none;width:100%;max-width:320px;border-radius:10px"></video><button onclick="scan()">📷 مسح QR</button><label>أو الصقي الكود</label><input id="cd2" dir="ltr"><button class="ghost full" onclick="checkIn(val('cd2'))">تسجيل</button></div>
  ${S.cu.map(u=>blk(u.kind==='lecture'?'المحاضرة':'السكشن — '+esc(u.name),u,(u.kind==='lecture'?S.lim.absence_limit_lecture:S.lim.absence_limit_section)||25)).join('')}
  ${S.cu.some(u=>u.kind==='period')?'':'<div class="mu">لم تسجلي في سكشن لهذه المادة (من تاب جدولي).</div>'}`};
/* ---------- instructor/TA: section requests ---------- */
const _lu=window.loadUnit;
window.loadUnit=async function(){
  if(S.sub==='req'){S.ts=await termStart();const r=await sb.rpc('unit_requests',{p_unit:S.uid});S.rqs=r.data||[];if(r.error)toast(errMsg(r.error))}else await _lu()};
async function answer(id,ok){const r=await sb.rpc('respond_section_request',{p_req:id,p_accept:ok});if(r.error){const m=r.error.message||'',k=Object.keys(ERR).find(k=>m.includes(k));return toast(k?ERR[k]:errMsg(r.error))}toast(ok?'تم القبول ✅':'تم الرفض');await loadUnit();render()}
const _uv=window.unitView;
window.unitView=function(){
  const u=S.units.find(x=>x.id===S.uid),isP=u.kind==='period';
  if(S.sub==='req'&&isP){const acc=S.rqs.filter(r=>r.status==='accepted').length;
    return `<div class="card row"><b>${esc(u.courses&&u.courses.name)} — ${esc(u.name)}</b><button class="ghost" onclick="S.uid=null;render()">رجوع</button></div><div class="tabs"><button onclick="sub('stu')">الطلبة</button><button onclick="sub('met')">طريقة التحضير</button><button onclick="sub('loc')">الموقع</button><button class="on">الطلبات</button></div>
    <div class="card"><h3>سعة الفترة</h3><div class="mu">المقبولين: ${acc}</div><div class="grid2"><input id="cap" type="number" value="${u.capacity||''}"><button onclick="ctl({p_capacity:+val('cap')})">حفظ السعة</button></div></div>
    <div class="card"><h3>طلبات التسجيل</h3>${S.rqs.filter(r=>r.status==='pending').map(r=>`<div class="row"><div><b>${esc(r.full_name)}</b><div class="mu">ID ${esc(r.student_no)}</div></div><span><button class="ok" onclick="answer('${r.req_id}',true)">قبول</button> <button class="bad" onclick="answer('${r.req_id}',false)">رفض</button></span></div>`).join('')||'<div class="mu">لا توجد طلبات.</div>'}</div>`}
  const h=_uv();return isP?h.replace('الموقع</button>','الموقع</button><button onclick="sub(\'req\')">الطلبات</button>'):h};
/* ---------- admin: Excel ---------- */
function xlsView(){return `<div class="card"><h3>ملف الإكسل</h3><p class="mu">شيت لكل محاضرة وفترة: أسماء الطلبة في صفوف، وتواريخ المحاضرات في أعمدة (1 = حضر / 0 = غاب). بيتحدّث من الداتا الحالية كل مرة تنزليه.</p><button class="full big" onclick="exportXlsx()">⬇ تنزيل ملف الحضور</button></div>`}
async function exportXlsx(){
  toast('جاري تجهيز الملف...');const ts=await termStart(),c=await sb.from('courses').select('id,name,units(id,kind,name,day,sections(name))').eq('faculty_id',fid()),wb=XLSX.utils.book_new(),used=new Set();
  for(const co of c.data||[])for(const u of co.units||[]){
    const [ro,se]=await Promise.all([sb.rpc('unit_roster',{p_unit:u.id}),sb.from('sessions').select('id,date').eq('unit_id',u.id)]),ses=se.data||[],ids=ses.map(x=>x.id),a=ids.length?await sb.from('attendance').select('session_id,student_id').in('session_id',ids):{data:[]},set=new Set((a.data||[]).map(x=>x.session_id+'|'+x.student_id)),ds=[...new Set([...dates(u,ts),...ses.map(x=>x.date)])].sort(),sid=d=>(ses.find(x=>x.date===d)||{}).id;
    const rows=[['الطالب','ID',...ds],...(ro.data||[]).map(s=>[s.full_name,s.student_id,...ds.map(d=>set.has(sid(d)+'|'+s.id)?1:0)])];
    const nm=(co.name+' '+(u.kind==='lecture'?'محاضرة':((u.sections&&u.sections.name)||'')+' '+u.name)).replace(/[\\\/\?\*\[\]:]/g,'_').slice(0,27);let k=nm,i=2;while(used.has(k))k=nm.slice(0,24)+'_'+i++;used.add(k);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),k)}
  if(!wb.SheetNames.length)return toast('لا توجد مواد');XLSX.writeFile(wb,'attendance_'+iso(new Date())+'.xlsx');toast('تم تنزيل الملف ✅')}
render();
