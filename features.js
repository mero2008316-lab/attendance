/* Batch 1 fixes + Batch 2 (admin setup) + Batch 3 (QR attendance). Loaded after the main script. */
Object.assign(ERR,{not_enrolled:'أنت غير مسجل في هذه المادة',qr_expired:'الـQR قديم أو منتهي، اطلبي الحالي من الدكتور',window_closed:'التسجيل مغلق حالياً',no_location:'لم يحدد الدكتور موقع المحاضرة بعد',too_far:'أنت بعيد عن مكان المحاضرة',other_device:'حسابك مربوط بجهاز آخر، راجعي الأدمن',already_checked_in:'تم تسجيل حضورك قبل كده',need_gps:'فعّلي الموقع (GPS) من المتصفح',not_in_period:'أنت غير مسجل في هذه الفترة',locked_or_not_allowed:'التعديل مقفول (اليوم انتهى)'});
const DAYS=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],t5=t=>String(t||'').slice(0,5),iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const fid=()=>(S.mem.find(m=>m.status==='approved')||{}).faculty_id;
/* ---- validation ---- */
const okMail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),okPhone=v=>/^01[0125]\d{8}$/.test(v);
function okNid(v){if(!/^[23]\d{13}$/.test(v))return false;const m=+v.slice(3,5),d=+v.slice(5,7);return m>=1&&m<=12&&d>=1&&d<=31}
const _reg=window.doRegister;
window.doRegister=function(kind){
  const e=val('e').trim(),n=val('n').trim().split(/\s+/).filter(Boolean),er=[];
  if(n.length<2)er.push('اكتبي الاسم من كلمتين على الأقل');if(!okMail(e))er.push('الإيميل غير صحيح');
  if(kind==='student'&&!okNid(val('nid').trim()))er.push('الرقم القومي غير صحيح (14 رقم)');
  if(kind==='doctor'&&!okPhone(val('ph').trim()))er.push('رقم الموبايل غير صحيح (11 رقم يبدأ بـ01)');
  if(er.length)return toast('⚠️ '+er.join(' — '));return _reg(kind)};
/* ---- layout ---- */
document.head.insertAdjacentHTML('beforeend','<style>.center{min-height:100vh;display:flex;align-items:center;justify-content:center}.center .narrow{width:100%;max-width:520px;margin:0;padding:30px}.big{padding:14px;font-size:16px}.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--bd);padding:6px 8px;text-align:center;white-space:nowrap}th{background:var(--hn2)}.qrb{display:flex;justify-content:center;padding:12px;background:#fff;border-radius:12px;width:fit-content;margin:8px auto}.pbar{height:10px;background:var(--bd);border-radius:9px;overflow:hidden}.pbar i{display:block;height:100%}</style>');
const _auth=window.authView;
window.authView=function(){
  if(S.screen==='login')return `<div class="card narrow"><h2 style="font-size:24px">🎓 الحضور الذكي</h2><div class="mu">سجّلي دخولك للمتابعة</div>${creds}<button id="go" class="full big" onclick="doLogin()">دخول</button><button class="ghost full big" onclick="S.screen='choose';render()">إنشاء حساب جديد</button></div>`;
  if(S.screen==='choose')return `<div class="card narrow"><h2>إنشاء حساب جديد</h2><div class="mu">اختاري نوع الحساب</div><button class="full big" onclick="S.screen='student';render()">🎒 طالب</button><button class="full big" onclick="S.screen='staff';render()">👨‍🏫 دكتور / معيد</button><button class="full big" onclick="S.screen='admin';render()">🛡️ أدمن كلية</button><div style="margin-top:12px">${back}</div></div>`;
  return _auth()};
/* ---- data ---- */
async function termStart(){const r=await sb.from('terms').select('start_date').eq('faculty_id',fid()).eq('is_current',true).limit(1);return (r.data&&r.data[0]&&r.data[0].start_date)||iso(new Date())}
function dates(u,ts){const o=[],e=new Date();e.setHours(0,0,0,0);let d=new Date(ts+'T00:00:00');while(d<=e&&o.length<150){if(d.getDay()==u.day)o.push(iso(d));d.setDate(d.getDate()+1)}return o}
async function loadTab(){
  const r=S.me.role;S.err=null;
  if(r==='admin'&&S.tab==='req')await loadRequests();
  if(r==='admin'&&S.tab==='crs'){
    const m=await sb.from('memberships').select('profiles(id,full_name,role)').eq('faculty_id',fid()).eq('status','approved');
    S.staff=(m.data||[]).map(x=>x.profiles).filter(p=>p&&(p.role==='doctor'||p.role==='ta'));
    const c=await sb.from('courses').select('id,name,year_id,absence_limit_lecture,units(id,kind,name,day,start_time,end_time,capacity,instructor_id,sections(name))').eq('faculty_id',fid()).order('name');S.courses=c.data||[]}
  if(r==='student'&&S.tab==='my'){const c=await sb.from('courses').select('id,name,absence_limit_lecture,units(id,kind,name,day,start_time,end_time)').order('name');S.courses=c.data||[]}
  if((r==='doctor'||r==='ta')&&S.tab==='my'){const u=await sb.from('units').select('id,name,kind,day,start_time,end_time,mode,timer_end,loc_lat,loc_lng,loc_radius,courses(name)').eq('instructor_id',S.me.id);S.units=u.data||[]}
}
async function go(t){S.tab=t;S.uid=null;S.cid=null;await loadTab();render()}
/* ---- admin: courses ---- */
const yopt=()=>S.years.filter(y=>y.faculty_id===fid()).map(y=>`<option value="${y.id}">${esc(y.name)}</option>`).join(''),sopt=()=>(S.staff||[]).map(p=>`<option value="${p.id}">${esc(p.full_name)} (${ROLE[p.role]})</option>`).join(''),dopt=DAYS.map((d,i)=>`<option value="${i}">${d}</option>`).join('');
async function addCourse(){
  if(!val('cn').trim()||!val('cd'))return toast('اكتبي اسم المادة واختاري الدكتور');
  const c=await sb.from('courses').insert({faculty_id:fid(),year_id:val('cy'),name:val('cn').trim(),absence_limit_lecture:+val('cl')||25}).select('id').single();
  if(c.error)return toast(errMsg(c.error));
  const u=await sb.from('units').insert({course_id:c.data.id,kind:'lecture',name:'محاضرة',instructor_id:val('cd'),day:+val('cw'),start_time:val('cf'),end_time:val('ct')});
  if(u.error)return toast(errMsg(u.error));toast('تمت إضافة المادة ✅');go('crs')}
async function addPeriod(){
  const c=val('pc'),sn=val('ps').trim();if(!c||!sn||!val('pt'))return toast('اختاري المادة واكتبي اسم السكشن واختاري المعيد');
  let s=await sb.from('sections').select('id').eq('course_id',c).eq('name',sn).limit(1),sid=s.data&&s.data[0]&&s.data[0].id;
  if(!sid){const n=await sb.from('sections').insert({course_id:c,name:sn}).select('id').single();if(n.error)return toast(errMsg(n.error));sid=n.data.id}
  const u=await sb.from('units').insert({course_id:c,section_id:sid,kind:'period',name:val('pn').trim()||'فترة',instructor_id:val('pt'),day:+val('pw'),start_time:val('pf'),end_time:val('pe'),capacity:+val('pk')||null});
  if(u.error)return toast(errMsg(u.error));toast('تمت إضافة الفترة ✅');go('crs')}
async function delCourse(id){if(!confirm('حذف المادة وكل بياناتها؟'))return;const r=await sb.from('courses').delete().eq('id',id);if(r.error)return toast(errMsg(r.error));go('crs')}
function adminCourses(){
  const cs=S.courses||[],yn=id=>(S.years.find(y=>y.id===id)||{}).name||'';
  return `<div class="card"><h3>إضافة مادة (محاضرة)</h3><div class="grid2"><div><label>اسم المادة</label><input id="cn"></div><div><label>الفرقة</label><select id="cy">${yopt()}</select></div><div><label>الدكتور</label><select id="cd"><option value="">اختاري</option>${sopt()}</select></div><div><label>اليوم</label><select id="cw">${dopt}</select></div><div><label>من</label><input id="cf" type="time" value="10:00"></div><div><label>إلى</label><input id="ct" type="time" value="12:00"></div><div><label>حد الغياب %</label><input id="cl" type="number" value="25"></div></div><button class="full" onclick="addCourse()">إضافة المادة</button></div>
  <div class="card"><h3>إضافة سكشن / فترة</h3><div class="grid2"><div><label>المادة</label><select id="pc">${cs.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div><label>اسم السكشن</label><input id="ps" placeholder="مثلاً سكشن 1"></div><div><label>اسم الفترة</label><input id="pn" placeholder="مثلاً فترة أ"></div><div><label>المعيد</label><select id="pt"><option value="">اختاري</option>${sopt()}</select></div><div><label>اليوم</label><select id="pw">${dopt}</select></div><div><label>من</label><input id="pf" type="time" value="12:00"></div><div><label>إلى</label><input id="pe" type="time" value="14:00"></div><div><label>السعة</label><input id="pk" type="number" value="30"></div></div><button class="full" onclick="addPeriod()">إضافة الفترة</button></div>
  <div class="card"><h3>المواد الحالية</h3>${cs.map(c=>`<div class="row"><div><b>${esc(c.name)}</b> <span class="tag">${esc(yn(c.year_id))}</span>${(c.units||[]).map(u=>`<div class="mu">${u.kind==='lecture'?'محاضرة':esc((u.sections&&u.sections.name||'')+' - '+u.name)} · ${DAYS[u.day]} ${t5(u.start_time)}-${t5(u.end_time)} · ${esc(((S.staff||[]).find(p=>p.id===u.instructor_id)||{}).full_name||'')}</div>`).join('')}</div><button class="bad" onclick="delCourse('${c.id}')">حذف</button></div>`).join('')||'<div class="mu">لا توجد مواد.</div>'}</div>`}
/* ---- instructor ---- */
async function openUnit(id){S.uid=id;S.sub='stu';await loadUnit();render()}
async function loadUnit(){
  const u=S.units.find(x=>x.id===S.uid);S.ts=await termStart();
  if(S.sub==='stu'){
    const [ro,se]=await Promise.all([sb.rpc('unit_roster',{p_unit:u.id}),sb.from('sessions').select('id,date').eq('unit_id',u.id)]);
    S.roster=ro.data||[];S.ses=se.data||[];const ids=S.ses.map(s=>s.id);
    const a=ids.length?await sb.from('attendance').select('session_id,student_id').in('session_id',ids):{data:[]};S.att=new Set((a.data||[]).map(x=>x.session_id+'|'+x.student_id))}
  if(S.sub==='met'){const t=await sb.from('unit_tokens').select('token').eq('unit_id',u.id).single();S.token=t.data&&t.data.token}
}
async function sub(k){S.sub=k;await loadUnit();render()}
async function refreshUnits(){await loadTab();await loadUnit();render()}
async function mark(stu,date,on){const r=await sb.rpc('set_attendance',{p_unit:S.uid,p_student:stu,p_date:date,p_present:on});if(r.error){toast(errMsg(r.error))}await loadUnit();render()}
async function ctl(o){const r=await sb.rpc('set_unit_control',Object.assign({p_unit:S.uid,p_mode:null,p_minutes:null,p_lat:null,p_lng:null,p_radius:null,p_capacity:null},o));if(r.error)return toast(errMsg(r.error));toast('تم ✅');refreshUnits()}
async function regen(){const r=await sb.rpc('regenerate_token',{p_unit:S.uid});if(r.error)return toast(errMsg(r.error));toast('تم إنشاء QR جديد');refreshUnits()}
function gps(){return new Promise((ok,no)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>ok(p.coords),no,{enableHighAccuracy:true,timeout:12000}):no())}
async function useGps(){try{const g=await gps();$('#la').value=g.latitude.toFixed(6);$('#lo').value=g.longitude.toFixed(6);toast('تم التقاط موقعك، اضغطي حفظ')}catch(e){toast('تعذر الحصول على الموقع، فعّلي الـGPS')}}
function drawQR(){const b=$('#qrb');if(!b||!S.token)return;b.innerHTML='';new QRCode(b,{text:'A|'+S.uid+'|'+S.token,width:210,height:210})}
function unitView(){
  const u=S.units.find(x=>x.id===S.uid),tb=(k,t)=>`<button class="${S.sub===k?'on':''}" onclick="sub('${k}')">${t}</button>`,today=iso(new Date());let b='';
  if(S.sub==='stu'){const ds=[...new Set([...dates(u,S.ts),...S.ses.map(s=>s.date)])].sort(),sid=d=>(S.ses.find(s=>s.date===d)||{}).id;
    b=`<div class="card scroll"><table><tr><th>الطالب</th><th>ID</th>${ds.map(d=>`<th>${d.slice(5)}${d===today?' 🟢':''}</th>`).join('')}</tr>${S.roster.map(s=>`<tr><td>${esc(s.full_name)}</td><td>${esc(s.student_id)}</td>${ds.map(d=>{const p=S.att.has(sid(d)+'|'+s.id);return d===today?`<td><input type="checkbox" ${p?'checked':''} onchange="mark('${s.id}','${d}',this.checked)"></td>`:`<td style="color:var(--${p?'ok':'bad'})">${p?'✔':'✘'}</td>`}).join('')}</tr>`).join('')||'<tr><td>لا يوجد طلبة</td></tr>'}</table><div class="mu" style="margin-top:8px">التعديل متاح لليوم الحالي فقط.</div></div>`}
  if(S.sub==='met')b=`<div class="card"><h3>QR الحضور</h3><div class="qrb" id="qrb"></div><div style="text-align:center">الكود: <code dir="ltr">A|${u.id}|${esc(S.token)}</code></div><div id="stat" style="text-align:center;margin:8px 0"></div><button class="ghost full" onclick="regen()">🔄 إنشاء QR جديد (القديم يبطل فوراً)</button></div>
  <div class="card"><h3>طريقة التفعيل</h3><label class="cb"><input type="radio" name="m" ${u.mode==='auto'?'checked':''} onchange="ctl({p_mode:'auto'})">تلقائي وقت المحاضرة (${DAYS[u.day]} ${t5(u.start_time)} - ${t5(u.end_time)})</label><label class="cb"><input type="radio" name="m" ${u.mode==='timer'?'checked':''} onchange="ctl({p_mode:'timer'})">مؤقت يدوي</label>${u.mode==='timer'?`<div class="grid2"><input id="mn" type="number" value="15"><button class="ok" onclick="ctl({p_mode:'timer',p_minutes:+val('mn')||15})">▶ ابدأ</button><button class="bad" onclick="ctl({p_minutes:0})">⏹ إيقاف</button></div>`:''}</div>`;
  if(S.sub==='loc')b=`<div class="card"><h3>موقع المحاضرة (إلزامي)</h3><button class="ghost" onclick="useGps()">📍 استخدمي موقعي الحالي</button><div class="grid2"><div><label>Latitude</label><input id="la" dir="ltr" value="${u.loc_lat??''}"></div><div><label>Longitude</label><input id="lo" dir="ltr" value="${u.loc_lng??''}"></div><div><label>النطاق (متر)</label><input id="ra" type="number" value="${u.loc_radius||150}"></div></div><button class="full" onclick="ctl({p_lat:parseFloat(val('la')),p_lng:parseFloat(val('lo')),p_radius:+val('ra')})">حفظ الموقع</button></div>`;
  return `<div class="card row"><b>${esc(u.courses&&u.courses.name)} — ${u.kind==='lecture'?'محاضرة':esc(u.name)}</b><button class="ghost" onclick="S.uid=null;render()">رجوع</button></div><div class="tabs">${tb('stu','الطلبة')}${tb('met','طريقة التحضير')}${tb('loc','الموقع')}</div>${b}`}
setInterval(()=>{const s=$('#stat');if(!s||!S.units)return;const u=S.units.find(x=>x.id===S.uid);if(!u)return;
  if(u.mode==='timer'){const l=Math.floor((new Date(u.timer_end)-Date.now())/1000);s.innerHTML=l>0?`<span style="color:var(--ok)">🟢 مفتوح — متبقي ${Math.floor(l/60)}:${String(l%60).padStart(2,'0')}</span>`:'<span style="color:var(--bad)">🔴 مغلق</span>'}else s.textContent='يعمل تلقائياً وقت المحاضرة'},1000);
/* ---- student ---- */
async function openCourse(id){S.cid=id;const c=S.courses.find(x=>x.id===id),u=(c.units||[]).find(x=>x.kind==='lecture');S.ts=await termStart();S.mine=new Set();
  if(u){const s=await sb.from('sessions').select('id,date').eq('unit_id',u.id);S.ses=s.data||[];const ids=S.ses.map(x=>x.id),a=ids.length?await sb.from('attendance').select('session_id').eq('student_id',S.me.id).in('session_id',ids):{data:[]};const got=new Set((a.data||[]).map(x=>x.session_id));S.mine=new Set(S.ses.filter(x=>got.has(x.id)).map(x=>x.date))}render()}
function devId(){let d;try{d=localStorage.getItem('dev');if(!d){d=crypto.randomUUID();localStorage.setItem('dev',d)}}catch(e){d='x'}return d}
async function checkIn(raw){
  const p=String(raw||'').trim().split('|');if(p[0]!=='A'||p.length<3)return toast('كود غير صالح');
  let g;try{g=await gps()}catch(e){return toast(ERR.need_gps)}
  const r=await sb.rpc('check_in',{p_unit:p[1],p_token:p[2],p_lat:g.latitude,p_lng:g.longitude,p_device:devId()});
  if(r.error){const m=r.error.message||'';const k=Object.keys(ERR).find(k=>m.includes(k));return toast(k?ERR[k]:errMsg(r.error))}
  toast('✅ تم تسجيل حضورك');openCourse(S.cid)}
let cam;async function scan(){if(!('BarcodeDetector' in window))return toast('المتصفح لا يدعم مسح الكاميرا، الصقي الكود');try{cam=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});const v=$('#cam');v.srcObject=cam;v.style.display='block';v.play();const d=new BarcodeDetector({formats:['qr_code']});const lp=async()=>{if(!cam)return;try{const r=await d.detect(v);if(r.length){cam.getTracks().forEach(t=>t.stop());cam=null;v.style.display='none';return checkIn(r[0].rawValue)}}catch(e){}setTimeout(lp,300)};lp()}catch(e){toast('تعذر فتح الكاميرا')}}
function courseView(){
  const c=S.courses.find(x=>x.id===S.cid),u=(c.units||[]).find(x=>x.kind==='lecture'),ds=u?dates(u,S.ts):[],n=ds.length,pr=ds.filter(d=>S.mine.has(d)).length,ab=n?Math.round((n-pr)/n*100):0,lim=c.absence_limit_lecture||25,col=ab>=lim?'var(--bad)':ab>=lim*.7?'#e67700':'var(--ok)';
  return `<div class="card row"><b>${esc(c.name)}</b><button class="ghost" onclick="S.cid=null;render()">رجوع</button></div>
  <div class="card"><h3>تسجيل حضور</h3><video id="cam" playsinline muted style="display:none;width:100%;max-width:320px;border-radius:10px"></video><button onclick="scan()">📷 مسح QR</button><label>أو الصقي الكود</label><input id="cd2" dir="ltr"><button class="ghost full" onclick="checkIn(val('cd2'))">تسجيل</button></div>
  <div class="card"><h3>إحصائيتي</h3><div class="row"><span>نسبة الغياب: <b style="color:${col}">${ab}%</b> (الحد ${lim}%)</span><span>${ab>=lim?'🚨 خطر':ab>=lim*.7?'⚠️ قريب من الخطر':'✅ آمن'}</span></div><div class="pbar"><i style="width:${Math.min(ab,100)}%;background:${col}"></i></div><div class="mu" style="margin-top:6px">حضرتي ${pr} من ${n}</div></div>
  <div class="card scroll"><table><tr><th>التاريخ</th><th>الحالة</th></tr>${ds.slice().reverse().map(d=>`<tr><td>${d}</td><td style="color:var(--${S.mine.has(d)?'ok':'bad'})">${S.mine.has(d)?'✔ حضرتي':'✘ غياب'}</td></tr>`).join('')||'<tr><td colspan=2>لا محاضرات بعد</td></tr>'}</table></div>`}
/* ---- shell ---- */
window.logout=async function(){await sb.auth.signOut();S.me=null;S.screen='login';S._l=0;render()};
window.render=function(){
  const app=$('#app');if(!S.me){S._l=0;app.className='wrap center';app.innerHTML=authView();return}
  app.className='wrap';const m=S.me,adm=m.role==='admin';
  if(m.role==='pending_admin'){app.innerHTML=homeView();return}
  const ok=adm||S.mem.some(x=>x.status==='approved');
  if(ok&&!S._l){S._l=1;S.tab=adm?'req':'my';loadTab().then(render);return}
  const tb=(k,t)=>`<button class="${S.tab===k?'on':''}" onclick="go('${k}')">${t}</button>`;
  let body='';
  if(!ok){const rej=S.mem.length&&S.mem.every(x=>x.status==='rejected');body=`<div class="card"><h3>${rej?'تم رفض طلبك':'طلبك بانتظار موافقة الأدمن ⏳'}</h3></div>`}
  else if(S.tab==='set')body=`<div class="card"><h3>الإعدادات</h3><label>الإيميل</label><input value="${esc(m.email)}" disabled><label>رقم الموبايل</label><input id="sp" value="${esc(m.phone||'')}"><button class="full" onclick="if(!okPhone(val('sp').trim()))return toast('رقم الموبايل غير صحيح');savePhone()">حفظ</button></div>`;
  else if(adm&&S.tab==='req')body=homeView().split('<div class="tabs">')[1].split('</div>').slice(1).join('</div>');
  else if(adm&&S.tab==='crs')body=adminCourses();
  else if(m.role==='student')body=S.cid?courseView():`<div class="card"><h3>موادي</h3>${(S.courses||[]).map(c=>`<div class="row"><b>${esc(c.name)}</b><button onclick="openCourse('${c.id}')">فتح</button></div>`).join('')||'<div class="mu">لا توجد مواد لفرقتك بعد.</div>'}</div>`;
  else body=S.uid?unitView():`<div class="card"><h3>موادي</h3>${(S.units||[]).map(u=>`<div class="row"><div><b>${esc(u.courses&&u.courses.name)}</b> <span class="tag">${u.kind==='lecture'?'محاضرة':esc(u.name)}</span><div class="mu">${DAYS[u.day]} ${t5(u.start_time)}-${t5(u.end_time)}</div></div><button onclick="openUnit('${u.id}')">فتح</button></div>`).join('')||'<div class="mu">لا توجد مواد مسندة إليك بعد.</div>'}</div>`;
  app.innerHTML=`<div class="card hd"><b>🎓 ${esc(m.full_name)} <span class="tag">${ROLE[m.role]}</span></b><button onclick="logout()">خروج</button></div><div class="tabs">${adm?tb('req','الطلبات')+tb('crs','المواد'):ok?tb('my','موادي'):''}${ok?tb('set','الإعدادات'):''}</div>${body}`;
  if(S.sub==='met'&&S.uid)drawQR()};
window.decide=async function(u,f,ok){const r=await sb.rpc('approve_membership',{p_user:u,p_faculty:f,p_ok:ok});if(r.error)return toast(errMsg(r.error));toast(ok?'تم القبول ✅':'تم الرفض');await loadRequests();render()};
render();
