"use client";
import { useState } from "react";

export default function ClientForm(){
  const [form,setForm]=useState({name:"",company_name:"",phone:"",whatsapp:"",email:"",location:"",notes:""});
  const [state,setState]=useState("idle");
  const change=e=>setForm({...form,[e.target.name]:e.target.value});
  async function submit(e){
    e.preventDefault(); setState("saving");
    try{
      const r=await fetch("/api/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const j=await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||"تعذر الحفظ");
      setState("done"); setForm({name:"",company_name:"",phone:"",whatsapp:"",email:"",location:"",notes:""});
      window.location.reload();
    }catch(err){console.error(err);setState("error")}
  }
  return <form className="clientForm" onSubmit={submit}>
    <h2>إضافة عميل جديد</h2>
    <div className="formGrid">
      <input required name="name" value={form.name} onChange={change} placeholder="اسم العميل *"/>
      <input name="company_name" value={form.company_name} onChange={change} placeholder="اسم النشاط / الشركة"/>
      <input name="phone" value={form.phone} onChange={change} placeholder="رقم الهاتف"/>
      <input name="whatsapp" value={form.whatsapp} onChange={change} placeholder="واتساب"/>
      <input type="email" name="email" value={form.email} onChange={change} placeholder="البريد الإلكتروني"/>
      <input name="location" value={form.location} onChange={change} placeholder="الموقع"/>
    </div>
    <textarea name="notes" value={form.notes} onChange={change} placeholder="ملاحظات"/>
    <button type="submit" disabled={state==="saving"}>{state==="saving"?"جارٍ الحفظ...":"حفظ العميل"}</button>
    {state==="error"&&<p className="formError">تعذر الحفظ. تحقق من اتصال D1 ثم حاول مرة أخرى.</p>}
  </form>
}