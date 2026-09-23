const projects = [
  { name: 'هلوفيرا للعقارات', type: 'عقارات', status: 'قيد التنفيذ', progress: 82, action: 'مراجعة آخر تحديث' },
  { name: 'مشاكيك الحوار', type: 'مطعم', status: 'ينتظر موافقتي', progress: 91, action: 'اعتماد التعديلات' },
  { name: 'هلوفيرا للتأمين', type: 'تأمين', status: 'مكتمل', progress: 100, action: 'عرض الموقع' },
  { name: 'روح الماضي', type: 'مشروع عميل', status: 'قيد التنفيذ', progress: 68, action: 'فتح المشروع' },
];

const stats = [
  ['3', 'عملاء جدد'],
  ['4', 'قيد التنفيذ'],
  ['2', 'ينتظر موافقتي'],
  ['1', 'جاهز للتسليم'],
];

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <div>
          <span className="eyebrow">HALOVERA COMMAND</span>
          <h1>مركز القيادة</h1>
          <p>موظف هلوفيرا الداخلي — المشاريع والقرارات والتنفيذ في مكان واحد.</p>
        </div>
        <div className="avatar">H</div>
      </header>

      <section className="command">
        <div className="commandTitle"><span className="pulse" /> الموظف جاهز</div>
        <h2>ماذا تريد أن أنفذ؟</h2>
        <div className="inputRow">
          <div className="fakeInput">مثال: عميل جديد، مطعم في مليحة…</div>
          <button aria-label="إرسال">←</button>
        </div>
        <div className="chips"><span>+ عميل جديد</span><span>ابدأ مشروع</span><span>حالة المشاريع</span></div>
      </section>

      <section className="stats">
        {stats.map(([n, label]) => <article key={label}><strong>{n}</strong><span>{label}</span></article>)}
      </section>

      <section className="sectionHead">
        <div><span className="eyebrow">العمل الآن</span><h2>المشاريع</h2></div>
        <button className="textBtn">عرض الكل</button>
      </section>

      <section className="projects">
        {projects.map((p) => (
          <article className="project" key={p.name}>
            <div className="projectTop">
              <div><span className="type">{p.type}</span><h3>{p.name}</h3></div>
              <span className={`status ${p.status === 'مكتمل' ? 'done' : p.status.includes('موافقتي') ? 'approval' : ''}`}>{p.status}</span>
            </div>
            <div className="progress"><i style={{width: `${p.progress}%`}} /></div>
            <div className="projectFoot"><span>{p.progress}%</span><button>{p.action}</button></div>
          </article>
        ))}
      </section>

      <section className="approvalBox">
        <div><span className="eyebrow">يتطلب قرارك</span><h2>موافقتان بانتظارك</h2><p>الموظف لا يرسل سعرًا أو يحذف مشروعًا أو يسلّم للعميل قبل موافقتك.</p></div>
        <button>راجع القرارات</button>
      </section>

      <nav className="bottomNav"><span className="active">القيادة</span><span>العملاء</span><span>المشاريع</span><span>الموافقات</span></nav>
    </main>
  );
}
