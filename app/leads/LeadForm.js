"use client";
import {useState} from "react";
export default function LeadForm(){
 const [f,setF]=useState({business_name:"",contact_name:"",phone:"",whatsapp:"",email:"",category:"",location:"",source:"",status:"new",estimated_value:"",next_follow_up:"",notes:""});const [s,setS]=useState("idle");const ch=e=>setF({...f,[e.target.name]:e.target.value});
 async function submit(e){e.preventDefault();setS("saving");try{const r=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error);window.location.reload()}catch(e){console.error(e);setS("error")}}
 return <form className="clientForm" onSubmit={submit}><h2>إضافة فرصة بيع</h2><div className="formGrid">
 <input required name="business_name" value={f.business_name} onChange={ch} placeholder="اسم النشاط *"/><input name="contact_name" value={f.contact_name} onChange={ch} placeholder="اسم المسؤول"/>
 <input name="phone" value={f.phone} onChange={ch} placeholder="الهاتف"/><input name="whatsapp" value={f.whatsapp} onChange={ch} placeholder="واتساب"/>
 <input name="category" value={f.category} onChange={ch} placeholder="نوع النشاط"/><input name="location" value={f.location} onChange={ch} placeholder="الموقع"/>
 <input name="estimated_value" type="number" min="0" value={f.estimated_value} onChange={ch} placeholder="القيمة المتوقعة AED"/><input name="next_follow_up" type="date" value={f.next_follow_up} onChange={ch}/>
 <select name="status" value={f.status} onChange={ch}><option value="new">جديدة</option><option value="contacted">تم التواصل</option><option value="proposal">عرض سعر</option><option value="negotiation">تفاوض</option><option value="won">تم البيع</option><option value="lost">مفقودة</option></select>
 </div><textarea name="notes" value={f.notes} onChange={ch} placeholder="ملاحظات"/><button disabled={s==="saving"}>{s==="saving"?"جارٍ الحفظ...":"حفظ فرصة البيع"}</button>{s==="error"&&<p className="formError">تعذر حفظ الفرصة.</p>}</form>
}