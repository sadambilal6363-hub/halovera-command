import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import ClientForm from "./ClientForm";
export const dynamic="force-dynamic";

export default async function Page(){
  let rows=[];
  try{
    const{env}=await getCloudflareContext({async:true});
    rows=(await env.DB.prepare("SELECT * FROM clients ORDER BY created_at DESC LIMIT 100").all()).results||[];
  }catch(e){console.error(e)}
  return <main>
    <div className="pageHead"><div><span className="eyebrow">CRM</span><h1>العملاء</h1><p>أضف العميل واحفظ بياناته مباشرة في قاعدة D1.</p></div><Link className="back" href="/">القيادة</Link></div>
    <ClientForm/>
    <div className="tableCard">{rows.length?rows.map(x=><div className="row" key={x.id}><div><b>{x.name}</b><small>{x.company_name||x.location||"—"}</small></div><div><span>{x.phone||x.whatsapp||"بدون رقم"}</span><small>{x.status||"lead"}</small></div></div>):<div className="emptyState">لا يوجد عملاء بعد. أضف أول عميل من النموذج أعلاه.</div>}</div>
  </main>
}