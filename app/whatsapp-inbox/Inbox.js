'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import './inbox.css';
export default function Inbox() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState('');
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp/inbox/conversations', { cache: 'no-store' });
      if (response.status === 401) { setAuthenticated(false); return; }
      if (!response.ok) throw new Error('تعذر تحميل المحادثات. تأكد من إعداد صندوق الرسائل.');
      setAuthenticated(true); setConversations((await response.json()).conversations);
    } catch (error) { setNotice(error.message); }
  }, []);
  const loadThread = useCallback(async (phone) => {
    if (!phone) return;
    try {
      const response = await fetch(`/api/whatsapp/inbox/conversations/${encodeURIComponent(phone)}`, { cache: 'no-store' });
      if (response.status === 401) { setAuthenticated(false); return; }
      if (!response.ok) throw new Error('تعذر تحميل الرسائل');
      setThread(await response.json());
    } catch (error) { setNotice(error.message); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!authenticated) return;
    const timer = setInterval(() => { refresh(); if (selected) loadThread(selected); }, 10000);
    return () => clearInterval(timer);
  }, [authenticated, refresh, selected, loadThread]);
  async function login(event) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/whatsapp/inbox/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (!response.ok) throw new Error(response.status === 429 ? 'انتظر 15 دقيقة ثم أعد المحاولة' : 'كلمة المرور غير صحيحة أو لم يتم إعداد الصندوق');
      setPassword(''); await refresh();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  async function action(payload) {
    setBusy(true); setNotice('');
    try {
      const response = await fetch(`/api/whatsapp/inbox/conversations/${encodeURIComponent(selected)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر تنفيذ الطلب');
      setText(''); await Promise.all([refresh(), loadThread(selected)]);
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  return <main className="inboxPage"><header className="pageHead"><div><span className="eyebrow">HALOVERA COMMAND</span><h1>صندوق واتساب</h1><p>رسائل رقم هلوفيرا والرد عليها من مكان واحد.</p></div><Link className="back" href="/">القيادة</Link></header>
    {notice && <p className="inboxError" role="alert">{notice}</p>}
    {authenticated === false ? <form className="inboxLogin" onSubmit={login}><h2>دخول المالك</h2><label>كلمة مرور الصندوق<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={busy}>دخول</button></form> : authenticated === null ? <p>جارٍ تحميل الصندوق…</p> : <div className="inboxGrid">
      <aside className="inboxList"><h2>المحادثات</h2>{conversations.length ? conversations.map(item => <button key={item.phone} className={selected === item.phone ? 'active' : ''} onClick={() => { setSelected(item.phone); setThread(null); loadThread(item.phone); }}><strong>{item.display_name || item.phone}</strong><small dir="ltr">{item.phone}</small><span>{item.last_text || 'رسالة جديدة'}</span></button>) : <p>لا توجد محادثات بعد. ستظهر الرسائل هنا بعد ربط الرقم وWebhook.</p>}</aside>
      <section className="inboxThread">{thread ? <><div className="threadHeader"><div><strong>{thread.conversation.display_name || thread.conversation.phone}</strong><small dir="ltr">{thread.conversation.phone}</small></div><button disabled={busy} onClick={() => action({ action: 'mode', mode: thread.conversation.mode === 'human' ? 'bot' : 'human' })}>{thread.conversation.mode === 'human' ? 'إعادة الرد الآلي' : 'تولّي المحادثة يدويًا'}</button></div><div className="threadMessages" aria-live="polite">{thread.messages.map(m => <div key={m.id} className={'bubble ' + (m.direction === 'out' ? 'sent' : 'received')}><p>{m.body}</p><small>{m.created_at} · {m.direction === 'out' ? 'صادر' : 'وارد'}</small></div>)}</div>{thread.suggestion && <div className="aiSuggestion"><strong>اقتراح الذكاء · {thread.suggestion.category}</strong><p>{thread.suggestion.summary}</p><p>{thread.suggestion.draft}</p><button type="button" onClick={() => setText(thread.suggestion.draft)}>نسخ الاقتراح إلى الرد</button><small>راجع النص قبل الإرسال.</small></div>}<form className="threadComposer" onSubmit={e => { e.preventDefault(); if (text.trim()) action({ action: 'send', text }); }}><textarea aria-label="اكتب ردًا" placeholder="اكتب ردك هنا…" maxLength={4096} value={text} onChange={e => setText(e.target.value)} /><button disabled={busy || !text.trim()}>إرسال الرد</button></form><p className="inboxHint">الرد اليدوي يوقف الرد الآلي لهذه المحادثة. لإعادته اضغط «إعادة الرد الآلي». الرد خارج نافذة خدمة العملاء قد يتطلب قالبًا معتمدًا من Meta.</p></> : <div className="emptyState">اختر محادثة لعرض رسائلها.</div>}</section>
    </div>}
  </main>;
}
