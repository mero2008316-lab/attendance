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
