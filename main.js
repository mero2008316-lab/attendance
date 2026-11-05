/* ====== Settings (public values, safe to expose) ====== */
const SUPABASE_URL='https://fcopxtbenksodfmobliq.supabase.co';
const SUPABASE_KEY='sb_publishable_nRTFpE-BL9Hvcbrkg84B5Q_mXLcybos';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S={screen:'login',faculties:[],years:[],me:null,mem:[],tab:'req',busy:false};
const ROLE={student:'طالب',doctor:'دكتور',ta:'معيد',admin:'أدمن',pending_admin:'أدمن (بانتظار الكود)'};
const ERR={'Invalid login credentials':'الإيميل أو كلمة المرور غير صحيحة','User already registered':'الإيميل مسجل قبل كده','bad_code':'كود الأدمن غير صحيح لهذه الكلية','not_allowed':'غير مسموح لك بهذا الإجراء','Password should be':'كلمة المرور قصيرة (6 أحرف على الأقل)','Email not confirmed':'الإيميل غير مؤكد (اقفلي Confirm email من Supabase)','rate limit':'محاولات كتير، استني شوية وجربي تاني'};
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',4000)}
function errMsg(e){const m=(e&&e.message)||String(e);for(const k in ERR)if(m.includes(k))return ERR[k];return 'حصل خطأ: '+m}
const val=id=>(document.getElementById(id)||{}).value||'';

/* ====== Theme ====== */
function applyTheme(t){document.documentElement.dataset.theme=t;$('#tg').textContent=t==='dark'?'☀️':'🌙'}
function toggleTheme(){const n=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('theme',n)}catch(e){}applyTheme(n)}
let th;try{th=localStorage.getItem('theme')}catch(e){}if(!th)th=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';applyTheme(th);

/* ====== Data ====== */
async function loadPublic(){
  const f=await sb.from('faculties').select('id,university,name').eq('active',true).order('name');
  const y=await sb.from('years').select('id,faculty_id,name').order('name');
  S.faculties=f.data||[];S.years=y.data||[];
}
async function loadMe(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){S.me=null;S.screen=S.screen==='login'||!S.screen?'login':S.screen;return}
  const p=await sb.from('profiles').select('id,role,full_name,email,phone,student_id').eq('id',session.user.id).single();
  if(p.error){toast(errMsg(p.error));S.me=null;return}
  S.me=p.data;
  const m=await sb.from('memberships').select('faculty_id,year_id,status,faculties(name,university)').eq('user_id',session.user.id);
  S.mem=m.data||[];S.screen='home';
  S.tab=S.me.role==='admin'?'req':'home';
}

/* ====== Auth actions ====== */
async function doLogin(){
  const b=$('#go');b.disabled=true;
  const {error}=await sb.auth.signInWithPassword({email:val('e').trim().toLowerCase(),password:val('p')});
  b.disabled=false;if(error)return toast(errMsg(error));
  await loadMe();render();
}
async function doRegister(kind){
  const e=val('e').trim().toLowerCase(),p=val('p'),n=val('n').trim();
  if(!n||!e||p.length<6)return toast('كمّلي البيانات (كلمة المرور 6 أحرف على الأقل)');
  let data={role:kind==='admin'?'admin':kind,full_name:n};
  if(kind==='student'){
    if(!val('sid')||val('nid').length!==14)return toast('أدخلي الـID والرقم القومي (14 رقم)');
    if(!val('fac')||!val('yr'))return toast('اختاري الكلية والفرقة');
    Object.assign(data,{student_id:val('sid').trim(),national_id:val('nid').trim(),faculty_id:val('fac'),year_id:val('yr')});
  }else if(kind==='doctor'||kind==='ta'){
    const ids=[...document.querySelectorAll('.cc:checked')].map(x=>x.value);
    if(!val('ph')||!ids.length)return toast('أدخلي الموبايل واختاري كلية واحدة على الأقل');
    data.role=val('rl');Object.assign(data,{phone:val('ph').trim(),faculty_ids:ids});
  }else if(!val('fac')||!val('code'))return toast('اختاري الكلية وأدخلي كود الأدمن');
  const b=$('#go');b.disabled=true;
  const r=await sb.auth.signUp({email:e,password:p,options:{data}});
  if(r.error){b.disabled=false;return toast(errMsg(r.error))}
  if(!r.data.session){b.disabled=false;return toast('تم إنشاء الحساب. لازم تأكدي الإيميل أو تقفلي Confirm email من Supabase')}
  if(kind==='admin'){const a=await sb.rpc('register_admin',{p_faculty:val('fac'),p_code:val('code').trim()});if(a.error)toast(errMsg(a.error))}
  await loadMe();b.disabled=false;
  toast(kind==='admin'&&S.me&&S.me.role==='admin'?'تم تسجيلك كأدمن ✅':'تم إرسال الطلب، بانتظار موافقة الأدمن');render();
}
async function submitAdminCode(){
  const a=await sb.rpc('register_admin',{p_faculty:val('fac'),p_code:val('code').trim()});
  if(a.error)return toast(errMsg(a.error));await loadMe();render();
}
async function logout(){await sb.auth.signOut();S.me=null;S.screen='login';render()}

/* ====== Admin actions ====== */
async function loadRequests(){
  const r=await sb.from('memberships').select('user_id,faculty_id,status,faculties(name),years(name),profiles(full_name,email,phone,student_id,role)').eq('status','pending');
  S.reqs=r.data||[];if(r.error)toast(errMsg(r.error));
}
async function decide(u,f,ok){
  const r=await sb.rpc('approve_membership',{p_user:u,p_faculty:f,p_ok:ok});
  if(r.error)return toast(errMsg(r.error));toast(ok?'تم القبول ✅':'تم الرفض');await loadRequests();render();
}
async function savePhone(){
  const r=await sb.from('profiles').update({phone:val('sp').trim()}).eq('id',S.me.id);
  if(r.error)return toast(errMsg(r.error));S.me.phone=val('sp').trim();toast('تم الحفظ ✅')
}

/* ====== Views ====== */
const facOpts=()=>'<option value="">اختاري...</option>'+S.faculties.map(f=>`<option value="${f.id}">${esc(f.name)} — ${esc(f.university)}</option>`).join('');
function setYears(){const f=val('fac'),y=$('#yr');if(y)y.innerHTML='<option value="">اختاري...</option>'+S.years.filter(x=>x.faculty_id===f).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}
const creds='<label>الإيميل</label><input id="e" type="email" dir="ltr" autocomplete="email"><label>كلمة المرور</label><input id="p" type="password" dir="ltr" autocomplete="current-password">';
const back='<button class="link" onclick="S.screen=\'login\';render()">رجوع لتسجيل الدخول</button>';
function authView(){
  const s=S.screen;
  if(s==='login')return `<div class="card narrow"><h2>🎓 الحضور الذكي</h2>${creds}<button id="go" class="full" onclick="doLogin()">دخول</button>
  <div class="mu" style="margin:18px 0 6px">مستخدم جديد؟</div>
  <button class="link" onclick="S.screen='student';render()">طالب</button> · <button class="link" onclick="S.screen='staff';render()">دكتور / معيد</button> · <button class="link" onclick="S.screen='admin';render()">أدمن كلية</button></div>`;
  if(s==='student')return `<div class="card narrow"><h2>تسجيل طالب</h2><label>الاسم (كما في الكارنيه)</label><input id="n"><label>الرقم الجامعي (ID)</label><input id="sid"><label>الرقم القومي</label><input id="nid" inputmode="numeric" maxlength="14">${creds}
  <label>الكلية</label><select id="fac" onchange="setYears()">${facOpts()}</select><label>الفرقة</label><select id="yr"><option value="">اختاري الكلية أولاً</option></select>
  <button id="go" class="full" onclick="doRegister('student')">إرسال الطلب</button><div style="margin-top:10px">${back}</div></div>`;
  if(s==='staff')return `<div class="card narrow"><h2>تسجيل دكتور / معيد</h2><label>الاسم</label><input id="n"><label>رقم الموبايل</label><input id="ph" inputmode="tel">${creds}
  <label>الصفة</label><select id="rl"><option value="doctor">دكتور</option><option value="ta">معيد</option></select><label>الكليات التي تدرّس بها</label>
  ${S.faculties.map(f=>`<label class="cb"><input type="checkbox" class="cc" value="${f.id}">${esc(f.name)} — ${esc(f.university)}</label>`).join('')}
  <button id="go" class="full" onclick="doRegister('doctor')">إرسال الطلب</button><div style="margin-top:10px">${back}</div></div>`;
  return `<div class="card narrow"><h2>تسجيل أدمن كلية</h2><label>الاسم</label><input id="n">${creds}<label>الكلية</label><select id="fac">${facOpts()}</select>
  <label>كود الأدمن الخاص بالكلية</label><input id="code" dir="ltr"><button id="go" class="full" onclick="doRegister('admin')">تسجيل</button><div style="margin-top:10px">${back}</div></div>`;
}
function homeView(){
  const m=S.me,adm=m.role==='admin',tb=(k,t)=>`<button class="${S.tab===k?'on':''}" onclick="S.tab='${k}';tabGo()">${t}</button>`;
  if(m.role==='pending_admin')return `<div class="card hd"><b>${esc(m.full_name)}</b><button onclick="logout()">خروج</button></div><div class="card narrow"><h3>أدخلي كود الأدمن</h3><div class="mu">حسابك اتعمل، بس لازم تثبتي الكلية بكودها.</div><label>الكلية</label><select id="fac">${facOpts()}</select><label>الكود</label><input id="code" dir="ltr"><button class="full" onclick="submitAdminCode()">تأكيد</button></div>`;
  const st=S.mem.map(x=>x.status),waiting=!adm&&!st.includes('approved'),rej=waiting&&st.length&&st.every(x=>x==='rejected');
  let body='';
  if(S.tab==='req'&&adm)body=`<div class="card"><h3>طلبات الانضمام</h3>${(S.reqs||[]).map(r=>{const p=r.profiles||{};return `<div class="row"><div><b>${esc(p.full_name)}</b> <span class="tag">${ROLE[p.role]||''}</span><div class="mu">${esc(p.email)} ${p.student_id?' · ID '+esc(p.student_id):''} ${r.years?' · '+esc(r.years.name):''}</div><div class="mu">${esc(r.faculties&&r.faculties.name)}</div></div><span><button class="ok" onclick="decide('${r.user_id}','${r.faculty_id}',true)">قبول</button> <button class="bad" onclick="decide('${r.user_id}','${r.faculty_id}',false)">رفض</button></span></div>`}).join('')||'<div class="mu">لا توجد طلبات الآن.</div>'}</div>`;
  else if(S.tab==='set')body=`<div class="card"><h3>الإعدادات</h3><label>الإيميل</label><input value="${esc(m.email)}" disabled><label>رقم الموبايل</label><input id="sp" value="${esc(m.phone||'')}"><button class="full" onclick="savePhone()">حفظ</button><div class="mu" style="margin-top:8px">الاسم والرقم القومي والـID لا يمكن تغييرها.</div></div>`;
  else body=waiting?`<div class="card"><h3>${rej?'تم رفض طلبك':'طلبك بانتظار موافقة الأدمن ⏳'}</h3><div class="mu">${rej?'تواصلي مع أدمن الكلية.':'هتقدري تستخدمي النظام بعد القبول.'}</div></div>`:`<div class="card"><h3>أهلاً ${esc(m.full_name)} 👋</h3><div class="mu">حسابك مفعّل. المواد والحضور هتظهر هنا في الخطوة الجاية.</div></div>`;
  return `<div class="card hd"><b>🎓 ${esc(m.full_name)} <span class="tag">${ROLE[m.role]}</span></b><button onclick="logout()">خروج</button></div>
  <div class="tabs">${adm?tb('req','الطلبات'):tb('home','الرئيسية')}${tb('set','الإعدادات')}</div>${body}`;
}
async function tabGo(){if(S.tab==='req')await loadRequests();render()}
function render(){$('#app').innerHTML=(S.me?homeView():authView())}

/* ====== PWA ====== */
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

(async()=>{await loadPublic();await loadMe();if(S.me&&S.me.role==='admin')await loadRequests();render()})();

;
/* Batch 1 fixes + Batch 2 (admin setup) + Batch 3 (QR attendance). Loaded after the main script. */
Object.assign(ERR,{not_enrolled:'أنت غير مسجل في هذه المادة',qr_expired:'الـQR قديم أو منتهي، اطلبي الحالي من الدكتور',window_closed:'التسجيل مغلق حالياً',no_location:'لم يحدد الدكتور موقع المحاضرة بعد',too_far:'أنت بعيد عن مكان المحاضرة',other_device:'حسابك مربوط بجهاز آخر، راجعي الأدمن',already_checked_in:'تم تسجيل حضورك قبل كده',need_gps:'فعّلي الموقع (GPS) من المتصفح',not_in_period:'أنت غير مسجل في هذه الفترة',locked_or_not_allowed:'التعديل مقفول (اليوم انتهى)'});
const rng=(a,b)=>'\u2066'+String(a||'').slice(0,5)+' - '+String(b||'').slice(0,5)+'\u2069';
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
document.head.insertAdjacentHTML('beforeend','<style>.center{min-height:100vh;display:flex;align-items:center;justify-content:center}.center .narrow{width:100%;max-width:520px;margin:0;padding:30px}.big{padding:14px;font-size:16px}input[type=radio]{width:auto;margin:0 0 0 8px;flex-shrink:0}.cb{gap:4px}.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--bd);padding:6px 8px;text-align:center;white-space:nowrap}th{background:var(--hn2)}.qrb{display:flex;justify-content:center;padding:12px;background:#fff;border-radius:12px;width:fit-content;margin:8px auto}.pbar{height:10px;background:var(--bd);border-radius:9px;overflow:hidden}.pbar i{display:block;height:100%}</style>');
const _auth=window.authView;
window.authView=function(){
  if(S.screen==='login')return `<div class="card narrow"><h2 style="font-size:24px">🎓 الحضور الذكي</h2><div class="mu">سجّلي دخولك للمتابعة</div>${creds}<button id="go" class="full big" onclick="doLogin()">دخول</button><button class="ghost full big" onclick="S.screen='choose';render()">إنشاء حساب جديد</button></div>`;
  if(S.screen==='choose')return `<div class="card narrow"><h2>إنشاء حساب جديد</h2><div class="mu">اختاري نوع الحساب</div><button class="full big" onclick="S.screen='student';render()">🎒 طالب</button><button class="full big" onclick="S.screen='staff';render()">👨‍🏫 دكتور / معيد</button><div style="margin-top:12px">${back}</div></div>`;
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
  if((r==='doctor'||r==='ta')&&S.tab==='my'){const u=await sb.from('units').select('id,name,kind,day,start_time,end_time,mode,timer_end,loc_lat,loc_lng,loc_radius,capacity,courses(name)').eq('instructor_id',S.me.id);S.units=u.data||[]}
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
  <div class="card"><h3>المواد الحالية</h3>${cs.map(c=>`<div class="row"><div><b>${esc(c.name)}</b> <span class="tag">${esc(yn(c.year_id))}</span>${(c.units||[]).map(u=>`<div class="mu">${u.kind==='lecture'?'محاضرة':esc((u.sections&&u.sections.name||'')+' - '+u.name)} · ${DAYS[u.day]} ${rng(u.start_time,u.end_time)} · ${esc(((S.staff||[]).find(p=>p.id===u.instructor_id)||{}).full_name||'')}</div>`).join('')}</div><button class="bad" onclick="delCourse('${c.id}')">حذف</button></div>`).join('')||'<div class="mu">لا توجد مواد.</div>'}</div>`}
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
  <div class="card"><h3>طريقة التفعيل</h3><label class="cb"><input type="radio" name="m" ${u.mode==='auto'?'checked':''} onchange="ctl({p_mode:'auto'})">تلقائي وقت المحاضرة (${DAYS[u.day]} ${rng(u.start_time,u.end_time)})</label><label class="cb"><input type="radio" name="m" ${u.mode==='timer'?'checked':''} onchange="ctl({p_mode:'timer'})">مؤقت يدوي</label>${u.mode==='timer'?`<div class="grid2"><input id="mn" type="number" value="15"><button class="ok" onclick="ctl({p_mode:'timer',p_minutes:+val('mn')||15})">▶ ابدأ</button><button class="bad" onclick="ctl({p_minutes:0})">⏹ إيقاف</button></div>`:''}</div>`;
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
  else if(S.tab==='set')body=`<div class="card"><h3>الإعدادات</h3><label>الإيميل</label><input value="${esc(m.email)}" disabled><label>رقم الموبايل</label><input id="sp" value="${esc(m.phone||'')}"><button class="full" onclick="if(!okPhone(val('sp').trim()))return toast('رقم الموبايل غير صحيح');savePhone()">حفظ</button></div>${adm?termForm():''}`;
  else if(adm&&S.tab==='req')body=homeView().split('<div class="tabs">')[1].split('</div>').slice(1).join('</div>');
  else if(adm&&S.tab==='crs')body=adminCourses();
  else if(adm&&S.tab==='usr')body=usersView();
  else if(adm&&S.tab==='xls')body=xlsView();
  else if(m.role==='student'&&S.tab==='sch')body=schedView();
  else if(m.role==='student')body=S.cid?courseView():`<div class="card"><h3>موادي</h3>${(S.courses||[]).map(c=>`<div class="row"><b>${esc(c.name)}</b><button onclick="openCourse('${c.id}')">فتح</button></div>`).join('')||'<div class="mu">لا توجد مواد لفرقتك بعد.</div>'}</div>`;
  else body=S.uid?unitView():`<div class="card"><h3>موادي</h3>${(S.units||[]).map(u=>`<div class="row"><div><b>${esc(u.courses&&u.courses.name)}</b> <span class="tag">${u.kind==='lecture'?'محاضرة':esc(u.name)}</span><div class="mu">${DAYS[u.day]} ${rng(u.start_time,u.end_time)}</div></div><button onclick="openUnit('${u.id}')">فتح</button></div>`).join('')||'<div class="mu">لا توجد مواد مسندة إليك بعد.</div>'}</div>`;
  app.innerHTML=`<div class="card hd"><b>🎓 ${esc(m.full_name)} <span class="tag">${ROLE[m.role]}</span></b><button onclick="logout()">خروج</button></div><div class="tabs">${adm?tb('req','الطلبات')+tb('crs','المواد')+tb('usr','المستخدمين')+tb('xls','التقارير'):ok?tb('my','موادي')+(m.role==='student'?tb('sch','جدولي'):''):''}${ok?tb('set','الإعدادات'):''}</div>${body}`;
  if(S.sub==='met'&&S.uid)drawQR()};
window.decide=async function(u,f,ok){const r=await sb.rpc('approve_membership',{p_user:u,p_faculty:f,p_ok:ok});if(r.error)return toast(errMsg(r.error));toast(ok?'تم القبول ✅':'تم الرفض');await loadRequests();render()};
render();

;
/* Batch 4 (schedule registration + section requests + section attendance) and Batch 5 (Excel). */
Object.assign(ERR,{no_attempts_left:'استهلكتي المحاولات الـ3 لتعديل الجدول',period_full:'الفترة دي اكتملت',duplicate_course:'اخترتي أكتر من فترة لنفس المادة',empty_schedule:'اختاري فترة واحدة على الأقل',use_submit_schedule:'استخدمي زرار حفظ الجدول'});
/* ---------- student: schedule ---------- */
const _lt=window.loadTab;
window.loadTab=async function(){await _lt();if(S.me.role==='student'&&S.tab==='sch')await loadSched()};
async function loadSched(){
  const [c,r,s]=await Promise.all([sb.from('courses').select('id,name,units(id,kind,name,day,start_time,end_time,capacity,sections(name))').order('name'),sb.from('section_requests').select('id,course_id,unit_id,status,created_at').eq('student_id',S.me.id).order('created_at'),sb.from('schedule_submissions').select('id',{count:'exact',head:true})]);
  S.sc=(c.data||[]).filter(x=>(x.units||[]).some(u=>u.kind==='period'));S.rq=r.data||[];S.used=s.count||0}
const plabel=u=>`${esc(u.sections&&u.sections.name||'')} - ${esc(u.name)} · ${DAYS[u.day]} ${rng(u.start_time,u.end_time)}${u.capacity?' (سعة '+u.capacity+')':''}`;
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
  await addPeopleSheets(wb);if(!wb.SheetNames.length)return toast('لا توجد مواد');XLSX.writeFile(wb,'attendance_'+iso(new Date())+'.xlsx');toast('تم تنزيل الملف ✅')}
render();

;
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
    btns.forEach(b=>{const c=b.cloneNode(true),t=c.textContent.trim();c.textContent=t;side.append(c)});shell.append(side)}
  const main=document.createElement('main');main.className='content';body.forEach(n=>main.append(n));shell.append(main);
  app.replaceChildren(top,shell);
  if(m.role==='admin'&&S.tab==='req'&&btns.length)main.innerHTML=reqView();
  if(S.uid&&S.sub==='met'&&S.units){const u=S.units.find(x=>x.id===S.uid),c=[...main.querySelectorAll('.card')].find(x=>x.textContent.includes('طريقة التفعيل'));if(u&&c)c.innerHTML=methodCard(u)}
};
render();

;
/* Final: users management (reset device/password), term settings, owner screen. Loaded last. */
Object.assign(ERR,{weak_password:'كلمة المرور لازم 6 أحرف على الأقل',weak_code:'الكود لازم 8 أحرف على الأقل'});Object.assign(ICON,{'المستخدمين':'👥'});
const _lt3=window.loadTab;
window.loadTab=async function(){await _lt3();if(S.me.role!=='admin')return;
  if(S.tab==='usr'){const m=await sb.from('memberships').select('user_id,years(name),profiles(full_name,email,student_id,role)').eq('faculty_id',fid()).eq('status','approved');S.users=(m.data||[]).filter(x=>x.profiles&&['student','doctor','ta'].includes(x.profiles.role))}
  if(S.tab==='set'){const t=await sb.from('terms').select('id,name,start_date,end_date,is_current').eq('faculty_id',fid()).order('start_date',{ascending:false});S.terms=t.data||[]}};
S.uf='all';S.uq='';
function ulist(){const q=S.uq.trim().toLowerCase(),L=(S.users||[]).filter(u=>(S.uf==='all'||u.profiles.role===S.uf)&&(!q||(u.profiles.full_name+u.profiles.email+(u.profiles.student_id||'')).toLowerCase().includes(q)));
  return L.map(u=>{const p=u.profiles;return `<div class="row"><div class="who2"><span class="av">${esc((p.full_name||'؟').trim()[0])}</span><div><b>${esc(p.full_name)}</b> <span class="tag">${RL[p.role]}</span><div class="mu">${esc(p.email)}${p.student_id?' · ID '+esc(p.student_id):''}${u.years?' · '+esc(u.years.name):''}</div></div></div><span>${p.role==='student'?`<button class="ghost" onclick="resetDev('${u.user_id}')">🔓 فك الجهاز</button> `:''}<button class="ghost" onclick="resetPw('${u.user_id}')">🔑 كلمة مرور</button></span></div>`}).join('')||'<div class="mu">لا نتائج.</div>'}
function usersView(){const U=S.users||[],c=k=>k==='all'?U.length:U.filter(u=>u.profiles.role===k).length;
  return `<div class="card"><h3>المستخدمون</h3><div class="chips">${[['all','الكل'],['student','الطلبة'],['doctor','الدكاترة'],['ta','المعيدين']].map(([k,t])=>`<button class="chip ${S.uf===k?'on':''}" onclick="S.uf='${k}';render()">${t} <b>${c(k)}</b></button>`).join('')}</div><input placeholder="🔎 بحث بالاسم أو الإيميل أو الـID" value="${esc(S.uq)}" oninput="S.uq=this.value;$('#ulist').innerHTML=ulist()"><div id="ulist" style="margin-top:8px">${ulist()}</div></div>`}
async function resetDev(id){if(!confirm('فك ربط جهاز الطالب؟ هيتربط بأول جهاز يسجل منه.'))return;const r=await sb.rpc('admin_reset_device',{p_user:id});toast(r.error?errMsg(r.error):'تم فك الربط ✅')}
async function resetPw(id){const p=prompt('اكتبي كلمة المرور الجديدة (6 أحرف على الأقل)');if(!p)return;const r=await sb.rpc('admin_reset_password',{p_user:id,p_pass:p});toast(r.error?errMsg(r.error):'تم تغيير كلمة المرور ✅ بلغي صاحب الحساب بيها')}
function termForm(){const T=S.terms||[],c=T.find(t=>t.is_current)||T[0];
  return `<div class="card"><h3>الترم الحالي</h3>${c?`<div class="grid2"><div><label>الاسم</label><input id="tn" value="${esc(c.name)}"></div><div><label>بداية الترم</label><input id="ts" type="date" value="${c.start_date}"></div><div><label>نهاية الترم</label><input id="te" type="date" value="${c.end_date}"></div></div><div class="mu" style="margin-top:6px">تواريخ المحاضرات في الجداول بتتحسب من بداية الترم، فاضبطيها على أول يوم دراسة فعلي.</div><button class="full" onclick="saveTerm('${c.id}')">حفظ الترم</button>`:'<div class="mu">لا يوجد ترم.</div>'}
  <hr style="border:0;border-top:1px solid var(--bd);margin:18px 0"><h3>فتح ترم جديد</h3><div class="mu">بيبدأ ترم جديد وبتتجدد محاولات تعديل الجدول للطلبة.</div><div class="grid2"><div><label>الاسم</label><input id="nn"></div><div><label>بداية</label><input id="ns" type="date"></div><div><label>نهاية</label><input id="ne" type="date"></div></div><button class="ghost full" onclick="newTerm()">فتح الترم الجديد</button></div>`}
async function saveTerm(id){if(!val('ts')||!val('te'))return toast('حددي التواريخ');const r=await sb.from('terms').update({name:val('tn'),start_date:val('ts'),end_date:val('te')}).eq('id',id);if(r.error)return toast(errMsg(r.error));toast('تم الحفظ ✅');go('set')}
async function newTerm(){if(!val('nn')||!val('ns')||!val('ne'))return toast('أكملي بيانات الترم');if(!confirm('فتح ترم جديد؟'))return;
  await sb.from('terms').update({is_current:false}).eq('faculty_id',fid());const r=await sb.from('terms').insert({faculty_id:fid(),name:val('nn'),start_date:val('ns'),end_date:val('ne'),is_current:true});if(r.error)return toast(errMsg(r.error));toast('تم فتح الترم ✅');go('set')}
/* ---- owner ---- */
function genCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=crypto.getRandomValues(new Uint8Array(10));return [...b].map(x=>a[x%a.length]).join('')}
function ownerRender(){const app=$('#app'),m=S.me;app.className='wrap';
  app.innerHTML=`<div class="topbar"><div class="who"><span class="av">👑</span><span>${esc(m.full_name)} <span class="tag">صاحب المنصة</span></span></div><button class="ghost" onclick="logout()">خروج</button></div>
  <div class="card"><h3>إضافة جامعة / كلية</h3><div class="grid2"><div><label>الجامعة</label><input id="ou"></div><div><label>الكلية</label><input id="of"></div><div><label>الفرق (مفصولة بفاصلة)</label><input id="oy" value="الفرقة الأولى,الفرقة الثانية"></div></div><button class="full" onclick="ownAdd()">إضافة الكلية</button></div>
  <div class="card"><h3>الكليات</h3>${S.faculties.map(f=>`<div class="row"><div><b>${esc(f.name)}</b><div class="mu">${esc(f.university)} · ${S.years.filter(y=>y.faculty_id===f.id).map(y=>esc(y.name)).join('، ')}</div></div></div>`).join('')}</div>`}
async function ownAdd(){if(!val('ou').trim()||!val('of').trim())return toast('اكتبي الجامعة والكلية');
  const r=await sb.rpc('owner_add_faculty',{p_univ:val('ou').trim(),p_name:val('of').trim(),p_years:val('oy').split(',').map(x=>x.trim()).filter(Boolean)});if(r.error)return toast(errMsg(r.error));
  toast('تمت إضافة الكلية ✅');await loadPublic();render()}
const _r3=window.render;
window.render=function(){if(S.me&&S.me.role==='owner'){ownerRender();return}_r3()};
render();

;
/* Final 2: ID login, simplified registration, owner dashboard, device release for instructors, extra Excel sheets, calm classic UI. */
Object.assign(ERR,{'already registered':'الـID مسجل قبل كده'});
const idMail=v=>String(v).trim().toLowerCase()+'@students.example.com';
/* ---------- login & registration ---------- */
const _a2=window.authView;
window.authView=function(){
  if(S.screen==='login')return `<div class="card narrow"><h2>الحضور الذكي</h2><div class="mu">الطالب يدخل بالـID، والدكتور والمعيد والأدمن بالإيميل</div><label>الـID أو الإيميل</label><input id="e" dir="ltr" autocomplete="username"><label>كلمة المرور</label><input id="p" type="password" dir="ltr" autocomplete="current-password"><button id="go" class="full big" onclick="doLogin()">دخول</button><button class="ghost full big" onclick="S.screen='choose';render()">إنشاء حساب جديد</button></div>`;
  if(S.screen==='student')return `<div class="card narrow"><h2>تسجيل طالب</h2><label>الاسم (كما في الكارنيه)</label><input id="n"><label>الرقم الجامعي (ID) — هو اسم الدخول</label><input id="sid" dir="ltr"><label>الإيميل</label><input id="se" type="email" dir="ltr"><label>رقم الموبايل</label><input id="ph" inputmode="tel"><label>كلمة المرور</label><input id="p" type="password" dir="ltr" autocomplete="new-password"><label>الكلية</label><select id="fac" onchange="setYears()">${facOpts()}</select><label>الفرقة</label><select id="yr"><option value="">اختاري الكلية أولاً</option></select><label class="cb" style="margin-top:12px"><input type="checkbox" id="ok"> أوافق على استخدام موقعي ووقت تسجيلي لأغراض الحضور فقط</label><button id="go" class="full big" onclick="doRegister('student')">إرسال الطلب</button><div style="margin-top:10px">${back}</div></div>`;
  return _a2()};
window.doLogin=async function(){
  const v=val('e').trim();if(!v||!val('p'))return toast('اكتبي بيانات الدخول');const b=$('#go');b.disabled=true;
  const {error}=await sb.auth.signInWithPassword({email:v.includes('@')?v.toLowerCase():idMail(v),password:val('p')});b.disabled=false;
  if(error)return toast(errMsg(error));await loadMe();if(S.me&&S.me.role==='admin')await loadRequests();render()};
const _dr=window.doRegister;
window.doRegister=async function(kind){
  if(kind!=='student')return _dr(kind);
  const n=val('n').trim().split(/\s+/).filter(Boolean),id=val('sid').trim(),er=[];
  if(n.length<2)er.push('اكتبي الاسم من كلمتين على الأقل');if(!/^[A-Za-z0-9]{3,20}$/.test(id))er.push('الـID أرقام وحروف إنجليزي فقط (3-20)');
  if(!okMail(val('se').trim()))er.push('الإيميل غير صحيح');if(!okPhone(val('ph').trim()))er.push('رقم الموبايل غير صحيح (11 رقم يبدأ بـ01)');
  if(val('p').length<6)er.push('كلمة المرور 6 أحرف على الأقل');if(!val('fac')||!val('yr'))er.push('اختاري الكلية والفرقة');if(!$('#ok').checked)er.push('لازم توافقي على الشرط');
  if(er.length)return toast('⚠️ '+er.join(' — '));
  const b=$('#go');b.disabled=true;
  const r=await sb.auth.signUp({email:idMail(id),password:val('p'),options:{data:{role:'student',full_name:val('n').trim(),student_id:id,contact_email:val('se').trim().toLowerCase(),phone:val('ph').trim(),faculty_id:val('fac'),year_id:val('yr')}}});
  b.disabled=false;if(r.error)return toast(errMsg(r.error));
  if(!r.data.session)return toast('تم إنشاء الحساب. اقفلي Confirm email من Supabase');
  await loadMe();toast('تم إرسال الطلب، بانتظار موافقة الأدمن');render()};
/* ---------- Excel: students + staff sheets ---------- */
async function addPeopleSheets(wb){
  const m=await sb.from('memberships').select('years(name),profiles(full_name,student_id,phone,email,role)').eq('faculty_id',fid()).eq('status','approved'),L=(m.data||[]).filter(x=>x.profiles);
  const st=L.filter(x=>x.profiles.role==='student'),sf=L.filter(x=>['doctor','ta'].includes(x.profiles.role));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['الاسم','ID','الفرقة','الموبايل','الإيميل'],...st.map(x=>[x.profiles.full_name,x.profiles.student_id,x.years&&x.years.name||'',x.profiles.phone||'',x.profiles.email||''])]),'الطلبة');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['الاسم','الصفة','الموبايل','الإيميل'],...sf.map(x=>[x.profiles.full_name,RL[x.profiles.role],x.profiles.phone||'',x.profiles.email||''])]),'الدكاترة والمعيدين');
  wb.SheetNames=['الطلبة','الدكاترة والمعيدين',...wb.SheetNames.filter(n=>n!=='الطلبة'&&n!=='الدكاترة والمعيدين')]}
/* ---------- instructor: release a student's device ---------- */
async function insDev(id){if(!confirm('فك ربط جهاز الطالب؟ العملية بتتسجل باسمك.'))return;const r=await sb.rpc('instructor_reset_device',{p_user:id,p_unit:S.uid});toast(r.error?errMsg(r.error):'تم فك الربط ✅')}
/* ---------- owner dashboard ---------- */
async function ownerLoad(){const [f,y,m]=await Promise.all([sb.from('faculties').select('id,university,name,active').order('university'),sb.from('years').select('id,faculty_id,name').order('name'),sb.from('memberships').select('faculty_id,profiles(full_name,email,role)').eq('status','approved')]);S.own={f:f.data||[],y:y.data||[],m:m.data||[]};render()}
window.ownerRender=function(){
  const app=$('#app'),m=S.me;app.className='wrap';
  if(!S.own){app.innerHTML='<div class="card narrow">جاري التحميل...</div>';ownerLoad();return}
  const O=S.own,cnt=(f,r)=>O.m.filter(x=>x.faculty_id===f&&x.profiles&&r.includes(x.profiles.role)).length;
  app.innerHTML=`<div class="topbar"><div class="who"><span>${esc(m.full_name)} <span class="tag">صاحب المنصة</span></span></div><button class="ghost" onclick="logout()">خروج</button></div>
  <div class="card"><h3>إضافة كلية</h3><div class="grid2"><div><label>الجامعة</label><input id="ou"></div><div><label>الكلية</label><input id="of"></div><div><label>الفرق (مفصولة بفاصلة)</label><input id="oy" value="الفرقة الأولى,الفرقة الثانية"></div></div><button class="full" onclick="ownAdd()">إضافة الكلية</button><div class="mu" style="margin-top:8px">تعيين الأدمن بيتم من الداتا بيز فقط (make_admin.sql).</div></div>
  ${O.f.map(f=>`<div class="card"><div class="row" style="border:0"><div><b>${esc(f.name)}</b> <span class="tag">${f.active?'مفعّلة':'موقوفة'}</span><div class="mu">${esc(f.university)} · طلبة ${cnt(f.id,['student'])} · دكاترة ومعيدين ${cnt(f.id,['doctor','ta'])} · أدمن ${cnt(f.id,['admin'])}</div></div><button class="ghost" onclick="ownToggle('${f.id}',${!f.active})">${f.active?'إيقاف':'تفعيل'}</button></div>
  <div class="mu">الأدمن: ${O.m.filter(x=>x.faculty_id===f.id&&x.profiles&&x.profiles.role==='admin').map(x=>esc(x.profiles.full_name)+' ('+esc(x.profiles.email)+')').join('، ')||'لا يوجد'}</div>
  <label>الفرق</label>${O.y.filter(y=>y.faculty_id===f.id).map(y=>`<div class="row" style="padding:6px 0"><input id="yn_${y.id}" value="${esc(y.name)}" style="max-width:260px"><span><button class="ghost" onclick="ownYear('${y.id}')">حفظ</button> <button class="ghost" onclick="ownYearDel('${y.id}')">حذف</button></span></div>`).join('')}
  <div class="row" style="padding:6px 0;border:0"><input id="ya_${f.id}" placeholder="فرقة جديدة" style="max-width:260px"><button onclick="ownYearAdd('${f.id}')">إضافة فرقة</button></div></div>`).join('')}`};
async function ownDone(r,msg){if(r.error)return toast(errMsg(r.error));toast(msg);S.own=null;await loadPublic();render()}
async function ownAdd(){if(!val('ou').trim()||!val('of').trim())return toast('اكتبي الجامعة والكلية');await ownDone(await sb.rpc('owner_add_faculty',{p_univ:val('ou').trim(),p_name:val('of').trim(),p_years:val('oy').split(',').map(x=>x.trim()).filter(Boolean)}),'تمت إضافة الكلية ✅')}
async function ownToggle(id,a){await ownDone(await sb.from('faculties').update({active:a}).eq('id',id),'تم')}
async function ownYear(id){await ownDone(await sb.from('years').update({name:val('yn_'+id).trim()}).eq('id',id),'تم الحفظ ✅')}
async function ownYearDel(id){if(!confirm('حذف الفرقة؟'))return;await ownDone(await sb.from('years').delete().eq('id',id),'تم الحذف')}
async function ownYearAdd(f){if(!val('ya_'+f).trim())return toast('اكتبي اسم الفرقة');await ownDone(await sb.from('years').insert({faculty_id:f,name:val('ya_'+f).trim()}),'تمت الإضافة ✅')}
/* ---------- calm classic look ---------- */
document.head.insertAdjacentHTML('beforeend',`<style>
body,input,select,button{font-family:'Noto Naskh Arabic','Segoe UI',Tahoma,serif}body{font-size:16px;line-height:1.7}
h2,h3{font-weight:600;letter-spacing:.2px}.card{box-shadow:none;padding:20px;margin-bottom:16px}.av{display:none}
.topbar{box-shadow:none;border-radius:12px}.shell{gap:28px}.side{background:transparent;border:0;border-left:1px solid var(--bd);border-radius:0;padding:4px 0 4px 18px;width:210px}
.side button{background:transparent;color:var(--mu);border:0;border-bottom:1px solid transparent;border-radius:0;padding:12px 4px;font-weight:400;font-size:16px;margin:0}
.side button:hover{background:transparent;color:var(--tx)}.side button.on,.side button.on:hover{background:transparent;color:var(--tx);font-weight:600;border-bottom:2px solid var(--pr)}
.content .tabs{background:transparent;padding:0;border-bottom:1px solid var(--bd);border-radius:0;width:auto;gap:18px}.content .tabs button{padding:8px 2px;border-bottom:2px solid transparent;background:transparent;color:var(--mu)}.content .tabs button.on{background:transparent;color:var(--tx);border-bottom:2px solid var(--pr)}
@media(max-width:800px){.side{border:1px solid var(--bd);border-radius:12px;padding:8px 14px;background:var(--card)}}
</style>`);
const _r5=window.render;
window.render=function(){_r5();
  const t=document.querySelector('.content table');
  if(S.me&&['doctor','ta'].includes(S.me.role)&&S.uid&&S.sub==='stu'&&t&&S.roster&&S.roster.length){const rs=t.rows;rs[0].insertAdjacentHTML('beforeend','<th>الجهاز</th>');S.roster.forEach((s,i)=>{if(rs[i+1])rs[i+1].insertAdjacentHTML('beforeend',`<td><button class="ghost" onclick="insDev('${s.id}')">فك</button></td>`)})}};
render();

;
