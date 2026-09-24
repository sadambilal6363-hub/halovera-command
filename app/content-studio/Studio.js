'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import './studio.css';

const kindNames = { offer: 'عرض للعميل', post: 'بوست', ad: 'إعلان' };
const channelNames = { whatsapp_message: 'رسالة واتساب لعميل', whatsapp_status: 'حالة واتساب', website: 'الموقع', facebook: 'فيسبوك', instagram: 'إنستغرام' };
const initial = { business_name: '', brief: '', kind: 'offer', channel: 'whatsapp_message', recipient: '', title: '', body: '' };

export default function Studio() {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState('');
  const [form, setForm] = useState(initial);
  const [drafts, setDrafts] = useState([]);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState({});
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
        body: JSON.stringify({ action: operation, ...revised, consentConfirmed: Boolean(consent[draft.id]) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر تنفيذ الطلب');
      if (operation === 'edit') setNotice('حُفظ التعديل وأُلغي الاعتماد السابق.');
      if (operation === 'approve') setNotice('اعتمدت النسخة الحالية. لم تُنشر بعد.');
      if (operation === 'publish') setNotice('أكدت Meta قبول الرسالة. راجع حالة وصولها في المحادثة.');
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
        {form.channel === 'whatsapp_message' && <label>رقم العميل برمز الدولة<input dir="ltr" inputMode="tel" maxLength={20} value={form.recipient} onChange={event => setForm({ ...form, recipient: event.target.value.replace(/\D/g, '') })} placeholder="9715XXXXXXXX" /></label>}
        <label className="studioWide">معلومات مؤكدة عن النشاط والهدف<textarea maxLength={2500} value={form.brief} onChange={event => setForm({ ...form, brief: event.target.value })} placeholder="ما الذي نعرفه فعلًا؟ ما الخدمة المناسبة؟" /></label>
        <label className="studioWide">عنوان للمسودة اليدوية<input maxLength={160} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
        <label className="studioWide">نص للمسودة اليدوية<textarea maxLength={4000} value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} /></label>
      </div><div className="studioActions"><button disabled={busy || !form.business_name.trim() || !form.brief.trim() || (form.channel === 'whatsapp_message' && !/^\d{6,20}$/.test(form.recipient))} onClick={() => create('generate')}>تجهيز بالذكاء</button><button className="secondary" disabled={busy || !form.business_name.trim() || !form.brief.trim() || !form.title.trim() || !form.body.trim() || (form.channel === 'whatsapp_message' && !/^\d{6,20}$/.test(form.recipient))} onClick={() => create('manual')}>حفظ مسودة يدوية</button></div><p className="studioHint">التجهيز بالذكاء يحتاج إعداد OpenAI API. لا تُرسل المسودات إلى أحد.</p></section>
      <section className="studioList"><h2>المسودات والموافقات</h2>{drafts.length ? drafts.map(draft => {
        const revised = edits[draft.id] || { title: draft.title, body: draft.body };
        const changed = revised.title !== draft.title || revised.body !== draft.body;
        const status = { approved: 'معتمدة ولم تُرسل', published: 'قبلتها Meta', sending: 'قيد الإرسال', send_unknown: 'راجع المحادثة قبل أي إعادة' }[draft.status] || 'بانتظار مراجعتك';
        return <article className="studioCard" key={draft.id}><div className="studioTop"><strong>{draft.business_name}</strong><span>{kindNames[draft.kind]} · {channelNames[draft.channel]} · {status}</span></div><small>المعطيات: {draft.brief}</small>{draft.channel === 'whatsapp_message' && <small dir="ltr">{draft.recipient}</small>}<label>العنوان<input maxLength={160} disabled={draft.status === 'published' || draft.status === 'sending' || draft.status === 'send_unknown'} value={revised.title} onChange={event => setEdits({ ...edits, [draft.id]: { ...revised, title: event.target.value } })} /></label><label>النص<textarea maxLength={4000} disabled={draft.status === 'published' || draft.status === 'sending' || draft.status === 'send_unknown'} value={revised.body} onChange={event => setEdits({ ...edits, [draft.id]: { ...revised, body: event.target.value } })} /></label>{draft.channel === 'whatsapp_message' && draft.status === 'approved' && <label className="studioConsent"><input type="checkbox" checked={Boolean(consent[draft.id])} onChange={event => setConsent({ ...consent, [draft.id]: event.target.checked })} /> أؤكد أن العميل وافق على تلقي العرض وأن الرسالة تخص محادثته الحالية.</label>}<div className="studioActions"><button className="secondary" disabled={busy || !changed || draft.status !== 'draft' && draft.status !== 'approved'} onClick={() => action(draft, 'edit')}>حفظ التعديل</button><button disabled={busy || changed || draft.status !== 'draft'} onClick={() => action(draft, 'approve')}>اعتماد النسخة</button>{draft.channel === 'whatsapp_status' && <button className="secondary" disabled={busy || changed || draft.status !== 'approved'} onClick={async () => { try { await navigator.clipboard.writeText(`${draft.title}\n\n${draft.body}`); setNotice('نُسخ نص الحالة. افتح واتساب أعمال ← التحديثات ← إضافة حالة ثم انشرها.'); } catch { setNotice('تعذر النسخ؛ حدّد النص وانسخه يدويًا.'); } }}>نسخ للحالة</button>}<button className="secondary" disabled={busy || changed || draft.status !== 'approved' || (draft.channel === 'whatsapp_message' && !consent[draft.id])} onClick={() => action(draft, 'publish')}>{draft.channel === 'whatsapp_message' ? 'إرسال عبر واتساب' : 'انشر'}</button></div><p className="studioHint">{draft.channel === 'whatsapp_status' ? 'لا يُرسل نظامنا حالة واتساب آليًا؛ انشر النص من التطبيق بعد اعتماده.' : draft.channel === 'whatsapp_message' ? 'يحتاج الرقم الحقيقي وعميلًا راسلك خلال 24 ساعة. خارجها يلزم قالب رسالة معتمد.' : 'قناة النشر غير مربوطة؛ لن يظهر تأكيد نشر وهمي.'}</p></article>;
      }) : <p>لا توجد مسودات بعد.</p>}</section>
    </>}
  </main>;
}
