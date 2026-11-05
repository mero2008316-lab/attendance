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
