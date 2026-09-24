import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";

export const dynamic = "force-dynamic";

const money = (v) => new Intl.NumberFormat("ar-AE", { style:"currency", currency:"AED", maximumFractionDigits:0 }).format(Number(v || 0));

async function dashboard() {
  try {
    const { env } = await getCloudflareContext({ async:true });
    const db = env.DB;
    const [projects, clients, leads, tasks, finance] = await Promise.all([
      db.prepare("SELECT id,name,category,status,priority,budget,amount_paid,domain,live_url,updated_at FROM projects ORDER BY updated_at DESC LIMIT 6").all(),
      db.prepare("SELECT COUNT(*) n FROM clients").first(),
      db.prepare("SELECT COUNT(*) n FROM leads WHERE status NOT IN ('lost','closed','won')").first(),
      db.prepare("SELECT COUNT(*) n FROM tasks WHERE status != 'done'").first(),
      db.prepare("SELECT COALESCE(SUM(CASE WHEN payment_status='paid' THEN amount ELSE 0 END),0) income FROM payments").first()
    ]);
    return { ok:true, projects:projects.results||[], clients:clients?.n||0, leads:leads?.n||0, tasks:tasks?.n||0, income:finance?.income||0 };
  } catch(e) { console.error(e); return {ok:false,projects:[],clients:0,leads:0,tasks:0,income:0}; }
}

export default async function Home(){
  const d=await dashboard();
  const statusLabel={planning:"تخطيط",in_progress:"قيد التنفيذ",waiting:"بانتظار الموافقة",completed:"مكتمل"};
  const stats=[[d.clients,"العملاء"],[d.leads,"الفرص المفتوحة"],[d.tasks,"المهام المفتوحة"],[money(d.income),"المبالغ المحصلة"]];
  return <main>
    <header className="topbar"><div><span className="eyebrow">HALOVERA COMMAND</span><h1>مركز القيادة</h1><p>نظام تشغيل هلوفيرا لإدارة العملاء والمبيعات والمشاريع والمال.</p></div><div className="avatar">H</div></header>
    <section className="command"><div className="commandTitle"><span className="pulse"/>{d.ok?"D1 متصلة — البيانات مباشرة":"قاعدة البيانات غير متصلة"}</div><h2>كل العمل من لوحة واحدة</h2><p className="commandCopy">صُمم ليكبر من إدارة هلوفيرا اليوم إلى منتج SaaS قابل للبيع لاحقًا.</p><div className="quick"><Link href="/today">اليوم</Link><Link href="/automation">التشغيل الآلي</Link><Link href="/whatsapp-inbox">صندوق واتساب</Link><Link href="/opportunities">رادار الفرص</Link><Link href="/clients">العملاء</Link><Link href="/leads">المبيعات</Link><Link href="/projects">المشاريع</Link><Link href="/finance">المالية</Link><Link href="/tasks">المهام</Link></div></section>
    <section className="stats">{stats.map(([n,l])=><article key={l}><strong>{n}</strong><span>{l}</span></article>)}</section>
    <section className="sectionHead"><div><span className="eyebrow">العمل الآن</span><h2>آخر المشاريع</h2></div><Link className="textBtn" href="/projects">عرض الكل</Link></section>
    <section className="projects">{d.projects.length?d.projects.map(p=><article className="project" key={p.id}><div className="projectTop"><div><span className="type">{p.category||"مشروع"}</span><h3>{p.name}</h3></div><span className={"status "+(p.status==="completed"?"done":"")}>{statusLabel[p.status]||p.status||"تخطيط"}</span></div><div className="projectFoot"><span>{p.domain||p.live_url||"بدون رابط"}</span><strong>{money(p.budget)}</strong></div></article>):<article className="project empty"><h3>لا توجد مشاريع بعد</h3><p>أضف أول مشروع من قسم المشاريع.</p></article>}</section>
    <section className="approvalBox"><div><span className="eyebrow">بنية قابلة للتوسع</span><h2>CRM + Projects + Finance</h2><p>البيانات محفوظة في D1، والواجهة مهيأة لإضافة مستخدمين وصلاحيات واشتراكات وتقارير لاحقًا.</p></div><Link href="/leads">فتح خط المبيعات</Link></section>
    <nav className="bottomNav"><Link className="active" href="/">القيادة</Link><Link href="/today">اليوم</Link><Link href="/automation">الآلي</Link><Link href="/opportunities">الفرص</Link><Link href="/clients">العملاء</Link><Link href="/leads">المبيعات</Link><Link href="/projects">المشاريع</Link><Link href="/finance">المالية</Link><Link href="/tasks">المهام</Link></nav>
  </main>
}