"use client";
import {useState} from "react";
export default function ProjectForm({clients=[]}){
 const [f,setF]=useState({client_id:"",name:"",category:"",domain:"",live_url:"",budget:"",status:"planning",priority:"normal"});
 const [s,setS]=useState("idle"); const ch=e=>setF({...f,[e.target.name]:e.target.value});
 async function submit(e){e.preventDefault();setS("saving");try{const r=await fetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error);setS("done");window.location.reload()}catch(e){console.error(e);setS("error")}}
 return <form className="clientForm" onSubmit={submit}><h2>إضافة مشروع جديد</h2><div className="formGrid">
 <input required name="name" value={f.name} onChange={ch} placeholder="اسم المشروع *"/>
 <select name="client_id" value={f.client_id} onChange={ch}><option value="">اختر العميل</option>{clients.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
 <input name="category" value={f.category} onChange={ch} placeholder="نوع المشروع"/>
 <input name="budget" type="number" min="0" value={f.budget} onChange={ch} placeholder="الميزانية AED"/>
 <input name="domain" value={f.domain} onChange={ch} placeholder="الدومين"/>
 <input name="live_url" value={f.live_url} onChange={ch} placeholder="رابط الموقع"/>
 <select name="status" value={f.status} onChange={ch}><option value="planning">تخطيط</option><option value="in_progress">قيد التنفيذ</option><option value="waiting">بانتظار الموافقة</option><option value="completed">مكتمل</option></select>
 <select name="priority" value={f.priority} onChange={ch}><option value="normal">عادية</option><option value="high">عالية</option><option value="urgent">عاجلة</option></select>
 </div><button type="submit" disabled={s==="saving"}>{s==="saving"?"جارٍ الحفظ...":"حفظ المشروع"}</button>{s==="error"&&<p className="formError">تعذر حفظ المشروع.</p>}</form>
}