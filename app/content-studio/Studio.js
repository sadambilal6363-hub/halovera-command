'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import './studio.css';

const kindNames = { offer: 'عرض للعميل', post: 'بوست', ad: 'إعلان' };
const channelNames = { website: 'الموقع', facebook: 'فيسبوك', instagram: 'إنستغرام' };
const initial = { business_name: '', brief: '', kind: 'offer', channel: 'website', title: '', body: '' };

export default function Studio() {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState('');
  const [form, setForm] = useState(initial);
  const [drafts, setDrafts] = useState([]);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/content', { cache: 'no-store' });
      if (response.status === 401) { setAuthenticated(false); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر تحميل المسودات');
      setAuthenticated(true); setDrafts(result.drafts);
    } catch (error) { setNotice(error.message); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function login(event) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/whatsapp/inbox/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (!response.ok) throw new Error('تعذر تسجيل الدخول');
      setPassword(''); await refresh();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function create(action) {
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر تجهيز المسودة');
      setForm(initial); await refresh(); setNotice('تم حفظ مسودة جديدة. راجعها قبل الاعتماد.');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function action(draft, operation) {
    setBusy(true); setNotice('');
    try {
      const revised = edits[draft.id] || { title: draft.title, body: draft.body };
      const response = await fetch(`/api/content/${encodeURIComponent(draft.id)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: operation, ...revised }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر تنفيذ الطلب');
      if (operation === 'edit') setNotice('حُفظ التعديل وأُلغي الاعتماد السابق.');
      if (operation === 'approve') setNotice('اعتمدت النسخة الحالية. لم تُنشر بعد.');
      await refresh(); setEdits(current => { const updated = { ...current }; delete updated[draft.id]; return updated; });
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  return <main className="studioPage"><header className="pageHead"><div><span className="eyebrow">HALOVERA COMMAND</span><h1>استوديو المحتوى</h1><p>جهّز عرضًا أو بوستًا أو إعلانًا، وراجع النسخة قبل اعتمادها.</p></div><Link className="back" href="/">القيادة</Link></header>
    {notice && <p className="studioNotice" role="status">{notice}</p>}
    {authenticated === false ? <form className="studioCard studioLogin" onSubmit={login}><h2>دخول المالك</h2><label>كلمة مرور الصندوق<input type="password" required value={password} onChange={event => setPassword(event.target.value)} /></label><button disabled={busy}>دخول</button></form> : authenticated === null ? <p>جارٍ التحميل…</p> : <>
      <section className="studioCard"><h2>مسودة جديدة</h2><div className="studioFields">
        <label>النشاط أو العميل<input maxLength={120} value={form.business_name} onChange={event => setForm({ ...form, business_name: event.target.value })} placeholder="مثال: مطعم في مليحة" /></label>
        <label>النوع<select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value })}>{Object.entries(kindNames).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
        <label>القناة المقترحة<select value={form.channel} onChange={event => setForm({ ...form, channel: event.target.value })}>{Object.entries(channelNames).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
        <label className="studioWide">معلومات مؤكدة عن النشاط والهدف<textarea maxLength={2500} value={form.brief} onChange={event => setForm({ ...form, brief: event.target.value })} placeholder="ما الذي نعرفه فعلًا؟ ما الخدمة المناسبة؟" /></label>
        <label className="studioWide">عنوان للمسودة اليدوية<input maxLength={160} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
        <label className="studioWide">نص للمسودة اليدوية<textarea maxLength={4000} value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} /></label>
      </div><div className="studioActions"><button disabled={busy || !form.business_name.trim() || !form.brief.trim()} onClick={() => create('generate')}>تجهيز بالذكاء</button><button className="secondary" disabled={busy || !form.business_name.trim() || !form.brief.trim() || !form.title.trim() || !form.body.trim()} onClick={() => create('manual')}>حفظ مسودة يدوية</button></div><p className="studioHint">التجهيز بالذكاء يحتاج إعداد OpenAI API. لا تُرسل المسودات إلى أحد.</p></section>
      <section className="studioList"><h2>المسودات والموافقات</h2>{drafts.length ? drafts.map(draft => {
        const revised = edits[draft.id] || { title: draft.title, body: draft.body };
        const changed = revised.title !== draft.title || revised.body !== draft.body;
        return <article className="studioCard" key={draft.id}><div className="studioTop"><strong>{draft.business_name}</strong><span>{kindNames[draft.kind]} · {channelNames[draft.channel]} · {draft.status === 'approved' ? 'معتمدة ولم تُنشر' : 'بانتظار مراجعتك'}</span></div><small>المعطيات: {draft.brief}</small><label>العنوان<input maxLength={160} value={revised.title} onChange={event => setEdits({ ...edits, [draft.id]: { ...revised, title: event.target.value } })} /></label><label>النص<textarea maxLength={4000} value={revised.body} onChange={event => setEdits({ ...edits, [draft.id]: { ...revised, body: event.target.value } })} /></label><div className="studioActions"><button className="secondary" disabled={busy || !changed} onClick={() => action(draft, 'edit')}>حفظ التعديل</button><button disabled={busy || changed || draft.status === 'approved'} onClick={() => action(draft, 'approve')}>اعتماد النسخة</button><button className="secondary" disabled={busy || changed || draft.status !== 'approved'} onClick={() => action(draft, 'publish')}>انشر</button></div><p className="studioHint">النشر سيبلغك بأن القناة غير مربوطة حتى نوصل حساب النشر؛ لن يظهر تأكيد نشر وهمي.</p></article>;
      }) : <p>لا توجد مسودات بعد.</p>}</section>
    </>}
  </main>;
}
