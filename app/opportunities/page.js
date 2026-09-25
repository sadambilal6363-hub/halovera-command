import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import Discoveries from './Discoveries';

export const dynamic = "force-dynamic";

function assess(x){
  let score=0; const reasons=[];
  const text=`${x.business_name||""} ${x.category||""} ${x.location||""} ${x.notes||""}`.toLowerCase();

  if(x.phone||x.whatsapp){score+=20;reasons.push("وسيلة تواصل متاحة")}
  if(Number(x.estimated_value||0)>0){score+=10;reasons.push("قيمة متوقعة")}
  if(x.next_follow_up){score+=10;reasons.push("متابعة محددة")}
  if(x.status==="qualified"||x.status==="proposal"){score+=20;reasons.push("فرصة متقدمة")}

  const local=/مليحة|الشارقة|sharjah|maleha|mleiha/.test(text);
  if(local){score+=15;reasons.push("ضمن السوق المستهدف")}

  const fit=/مطعم|كافتيريا|صالون|سوبر|متجر|حلويات|عقار|تأمين|مقاول|restaurant|cafe|salon|market|shop|real estate/.test(text);
  if(fit){score+=15;reasons.push("نشاط مناسب لخدمات هلوفيرا")}

  const need=/بدون موقع|لا يوجد موقع|موقع قديم|منيو|واتساب|كتالوج|حجز|روابط معطلة|no website|old website/.test(text);
  if(need){score+=20;reasons.push("احتياج رقمي واضح")}

  const excluded=/جامعة|حكوم|وزارة|بلدية|سلسلة كبيرة|university|government|ministry/.test(text);
  if(excluded){score-=50;reasons.push("جهة منخفضة الملاءمة للاستهداف")}

  score=Math.max(0,Math.min(score,100));
  const band=score>=70?"قوية":score>=45?"تحتاج مراجعة":"ضعيفة";
  return {score,band,reasons};
}

export default async function Page(){
  let leads=[];
  try{
    const {env}=await getCloudflareContext({async:true});
    const r=await env.DB.prepare("SELECT * FROM leads WHERE status NOT IN ('won','lost','closed') ORDER BY created_at DESC LIMIT 200").all();
    leads=r.results||[];
  }catch(e){console.error(e)}
  const radar=leads.map(x=>({...x,...assess(x)})).sort((a,b)=>b.score-a.score);
  const strong=radar.filter(x=>x.score>=70), review=radar.filter(x=>x.score>=45&&x.score<70), weak=radar.filter(x=>x.score<45);
  return <main>
    <div className="pageHead"><div><span className="eyebrow">OPPORTUNITY RADAR</span><h1>رادار الفرص</h1><p>فلترة الفرص قبل أن نضيّع وقت هلوفيرا في التواصل غير المجدي.</p></div><Link className="back" href="/">القيادة</Link></div>
    <section className="command"><div className="commandTitle"><span className="pulse"/>فلترة تجارية مفعلة</div><h2>الجودة قبل العدد</h2><p className="commandCopy">الأولوية للنشاط المناسب، السوق المستهدف، وجود وسيلة تواصل، واحتياج رقمي واضح. الجهات منخفضة الملاءمة تُخفض تلقائيًا.</p><div className="radarFlow"><span>بحث</span><span>فلترة</span><span>تقييم</span><span>موافقة</span><span>تواصل</span><span>متابعة</span></div></section>
    <section className="stats financeStats"><article><strong>{strong.length}</strong><span>فرص قوية 70+</span></article><article><strong>{review.length}</strong><span>تحتاج مراجعة 45–69</span></article><article><strong>{weak.length}</strong><span>ضعيفة أقل من 45</span></article></section>
    <section className="sectionHead"><div><span className="eyebrow">FILTERED</span><h2>الفرص مرتبة بالأولوية</h2></div><Link className="textBtn" href="/leads">إضافة فرصة</Link></section>
    <div className="tableCard">{radar.length?radar.map(x=><div className="row opportunityRow" key={x.id}><div><b>{x.business_name}</b><small>{[x.category,x.location].filter(Boolean).join(" — ")||"فرصة مسجلة"}</small><small>{x.reasons.slice(0,3).join(" • ")||"لا توجد مؤشرات كافية بعد"}</small></div><div><strong>{x.score}%</strong><small>{x.band}</small></div></div>):<div className="emptyState">لا توجد فرص مفتوحة بعد.</div>}</div>
    <Discoveries />
    <section className="approvalBox"><div><span className="eyebrow">SEARCH RULE</span><h2>لن نتواصل مع كل ما نجده</h2><p>عند ربط البحث الخارجي، الفرص الضعيفة تُحفظ أو تُستبعد، والقوية فقط تنتقل إلى قائمة التواصل.</p></div><Link href="/automation">مركز التشغيل الآلي</Link></section>
  </main>
}
