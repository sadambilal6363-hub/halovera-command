import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";

export const dynamic = "force-dynamic";

function scoreLead(x){
  let score=30;
  if(x.phone||x.whatsapp) score+=20;
  if(Number(x.estimated_value||0)>0) score+=15;
  if(x.next_follow_up) score+=15;
  if(x.status==="qualified"||x.status==="proposal") score+=20;
  return Math.min(score,100);
}

export default async function Page(){
  let leads=[];
  try{
    const {env}=await getCloudflareContext({async:true});
    const r=await env.DB.prepare("SELECT * FROM leads WHERE status NOT IN ('won','lost','closed') ORDER BY created_at DESC LIMIT 100").all();
    leads=r.results||[];
  }catch(e){console.error(e)}
  const radar=leads.map(x=>({...x,score:scoreLead(x)})).sort((a,b)=>b.score-a.score);
  return <main>
    <div className="pageHead"><div><span className="eyebrow">OPPORTUNITY RADAR</span><h1>رادار الفرص</h1><p>محطة جمع وفرز فرص هلوفيرا قبل تحويلها إلى تواصل ومبيعات.</p></div><Link className="back" href="/">القيادة</Link></div>
    <section className="command"><div className="commandTitle"><span className="pulse"/>المرحلة الأولى تعمل من بيانات Command</div><h2>من الفرصة إلى العميل</h2><p className="commandCopy">نجمع الفرص، نرتبها، ثم نضيف مصادر البحث والتواصل الآلي مع سجل وموافقة واضحة.</p><div className="radarFlow"><span>بحث</span><span>فرز</span><span>عرض</span><span>تواصل</span><span>متابعة</span><span>عميل</span></div></section>
    <section className="sectionHead"><div><span className="eyebrow">PRIORITY</span><h2>الفرص الحالية</h2></div><Link className="textBtn" href="/leads">إضافة فرصة</Link></section>
    <div className="tableCard">{radar.length?radar.map(x=><div className="row" key={x.id}><div><b>{x.business_name}</b><small>{[x.category,x.location].filter(Boolean).join(" — ")||"فرصة مسجلة"}</small></div><div><strong>{x.score}%</strong><small>أولوية التواصل</small></div></div>):<div className="emptyState">لا توجد فرص مفتوحة بعد. أضف فرصة، وبعد ربط مصادر البحث ستظهر الفرص المكتشفة هنا تلقائيًا.</div>}</div>
    <section className="approvalBox"><div><span className="eyebrow">NEXT LAYER</span><h2>التنفيذ الآلي المنضبط</h2><p>الخطوة التالية: ربط مصادر عامة للبحث، ثم إنشاء قائمة موافقة قبل أي تواصل خارجي.</p></div><Link href="/automation">مركز التشغيل الآلي</Link></section>
  </main>
}