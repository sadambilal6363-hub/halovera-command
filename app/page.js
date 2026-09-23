import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;
    const [projects, projectCount, clientCount, todoCount] = await Promise.all([
      db.prepare("SELECT id, name, category, status, priority, budget, amount_paid, domain, live_url, updated_at FROM projects ORDER BY updated_at DESC LIMIT 8").all(),
      db.prepare("SELECT COUNT(*) AS n FROM projects WHERE status != 'completed'").first(),
      db.prepare("SELECT COUNT(*) AS n FROM clients").first(),
      db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status = 'todo'").first()
    ]);
    return {
      projects: projects.results || [],
      stats: [
        [String(clientCount?.n || 0), "العملاء"],
        [String(projectCount?.n || 0), "مشاريع نشطة"],
        [String(todoCount?.n || 0), "مهام مفتوحة"],
        [String((projects.results || []).length), "آخر المشاريع"]
      ],
      connected: true
    };
  } catch (error) {
    console.error("D1 dashboard error:", error);
    return { projects: [], stats: [["0","العملاء"],["0","مشاريع نشطة"],["0","مهام مفتوحة"],["0","آخر المشاريع"]], connected: false };
  }
}

export default async function Home() {
  const data = await getDashboardData();
  return (
    <main>
      <header className="topbar">
        <div>
          <span className="eyebrow">HALOVERA COMMAND</span>
          <h1>مركز القيادة</h1>
          <p>موظف هلوفيرا الداخلي — المشاريع والعملاء والمهام في مكان واحد.</p>
        </div>
        <div className="avatar">H</div>
      </header>

      <section className="command">
        <div className="commandTitle"><span className="pulse" /> {data.connected ? "D1 متصلة — النظام جاهز" : "تعذر الاتصال بقاعدة البيانات"}</div>
        <h2>ماذا تريد أن أنفذ؟</h2>
        <div className="inputRow">
          <div className="fakeInput">مثال: أضف عميلًا أو مشروعًا جديدًا…</div>
          <button aria-label="إرسال">←</button>
        </div>
        <div className="chips"><span>+ عميل جديد</span><span>+ مشروع جديد</span><span>حالة المشاريع</span></div>
      </section>

      <section className="stats">
        {data.stats.map(([n,label]) => <article key={label}><strong>{n}</strong><span>{label}</span></article>)}
      </section>

      <section className="sectionHead">
        <div><span className="eyebrow">بيانات مباشرة من D1</span><h2>المشاريع</h2></div>
      </section>

      <section className="projects">
        {data.projects.length === 0 ? (
          <article className="project"><h3>لا توجد مشاريع محفوظة بعد</h3><p>الاتصال جاهز. أضف أول مشروع إلى قاعدة البيانات ليظهر هنا مباشرة.</p></article>
        ) : data.projects.map((p) => (
          <article className="project" key={p.id}>
            <div className="projectTop">
              <div><span className="type">{p.category || "مشروع"}</span><h3>{p.name}</h3></div>
              <span className={`status ${p.status === "completed" ? "done" : ""}`}>{p.status || "planning"}</span>
            </div>
            <div className="projectFoot">
              <span>{p.domain || p.live_url || "بدون دومين"}</span>
              <button>{p.priority || "normal"}</button>
            </div>
          </article>
        ))}
      </section>

      <section className="approvalBox">
        <div><span className="eyebrow">HALOVERA COMMAND</span><h2>قاعدة التشغيل أصبحت حقيقية</h2><p>هذه الصفحة تقرأ الآن من Cloudflare D1 بدل البيانات التجريبية داخل الكود.</p></div>
      </section>

      <nav className="bottomNav"><span className="active">القيادة</span><span>العملاء</span><span>المشاريع</span><span>الموافقات</span></nav>
    </main>
  );
}
