import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import ProjectForm from "./ProjectForm";
export const dynamic="force-dynamic";
export default async function Page(){
 let rows=[],clients=[];
 try{const{env}=await getCloudflareContext({async:true});const [p,c]=await Promise.all([env.DB.prepare("SELECT * FROM projects ORDER BY updated_at DESC LIMIT 100").all(),env.DB.prepare("SELECT id,name FROM clients ORDER BY name").all()]);rows=p.results||[];clients=c.results||[]}catch(e){console.error(e)}
 return <main><div className="pageHead"><div><span className="eyebrow">DELIVERY</span><h1>المشاريع</h1><p>أنشئ المشروع واربطه بالعميل واحفظه مباشرة في D1.</p></div><Link className="back" href="/">القيادة</Link></div>
 <ProjectForm clients={clients}/>
 <div className="tableCard">{rows.length?rows.map(x=><div className="row" key={x.id}><div><b>{x.name}</b><small>{x.category||x.domain||"—"}</small></div><div><span>{Number(x.budget||0).toLocaleString("ar-AE")} د.إ</span><small>{x.status||"planning"} · {x.priority||"normal"}</small></div></div>):<div className="emptyState">لا توجد مشاريع بعد. أضف أول مشروع من النموذج أعلاه.</div>}</div></main>
}