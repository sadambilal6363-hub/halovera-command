'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import './discoveries.css';

export default function Discoveries() {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState('');
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const automaticAttempted = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/opportunities/discover', { cache:'no-store' });
      if (response.status === 401) { setAuthenticated(false); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل الفرص');
      setAuthenticated(true); setItems(data.items);
      const last = data.last_run_at && Date.parse(data.last_run_at.replace(' ', 'T') + 'Z');
      if (!automaticAttempted.current && (!last || Date.now() - last >= 6 * 60 * 60 * 1000)) {
        automaticAttempted.current = true;
        const scan = await fetch('/api/opportunities/discover', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ action:'scan' }) });
        if (scan.ok) {
          const updated = await fetch('/api/opportunities/discover', { cache:'no-store' });
          if (updated.ok) setItems((await updated.json()).items);
        } else {
          setNotice('تعذر تحديث البحث الآن؛ يمكنك المحاولة بزر البحث لاحقًا.');
        }
      }
    } catch (error) { setNotice(error.message); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  async function login(event) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/whatsapp/inbox/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ password }) });
      if (!response.ok) throw new Error('تعذر تسجيل الدخول');
      setPassword(''); await refresh();
    } catch(error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  async function action(input) {
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/opportunities/discover', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(input) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر تنفيذ البحث');
      if (input.action === 'scan') setNotice(`وجدنا ${data.found} نشاطًا في المصدر العام. راجع البيانات قبل التواصل.`);
      else setNotice('تم تجهيز مسودة عرض في استوديو المحتوى. راجعها واعتمدها إن كانت مناسبة.');
      await refresh();
    } catch(error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  return <section className="discovery"><div className="sectionHead"><div><span className="eyebrow">LOCAL DISCOVERY</span><h2>اكتشاف أنشطة مليحة</h2><p>نجمع فرصًا من بيانات أنشطة عامة، ونجهز مسودة عرض لك. القرار بالتواصل يبقى لك.</p></div></div>
    {notice && <p role="status" className="discoveryNotice">{notice}</p>}
    {authenticated === false ? <form className="discoveryLogin" onSubmit={login}><label>كلمة مرور المالك <input type="password" required value={password} onChange={event => setPassword(event.target.value)} /></label><button disabled={busy}>دخول</button></form> : authenticated === null ? <p>جارٍ تحميل الفرص…</p> : <>
      <button className="discoveryScan" disabled={busy} onClick={() => action({ action:'scan' })}>ابحث عن فرص جديدة</button><p className="discoveryHint">المصدر: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© مساهمو OpenStreetMap</a>. قد تكون بيانات الأنشطة ناقصة أو قديمة. لا نستنتج أن النشاط بلا موقع لمجرد غياب رابطه هنا.</p>
      {items.length ? <div className="discoveryList">{items.map(item => <article key={item.source_key} className="discoveryItem"><div><strong>{item.business_name}</strong><small>{item.category} · {item.location} · تقييم أولي {item.score}/100</small><small>{item.reason}</small><a href={item.source_url} target="_blank" rel="noopener noreferrer">راجع مصدر النشاط</a>{item.website && <a href={item.website} target="_blank" rel="noopener noreferrer">موقع النشاط</a>}{item.phone && <small dir="ltr">{item.phone}</small>}</div><div><button disabled={busy} onClick={() => action({ action:'prepare', source_key:item.source_key })}>{item.status === 'prepared' ? 'جهّز عرضًا آخر' : 'جهّز عرضًا'}</button></div></article>)}</div> : <p>لا توجد نتائج محفوظة. ابدأ البحث.</p>}
      <Link className="textBtn" href="/content-studio">عرض المسودات للموافقة</Link>
    </>}
  </section>;
}
