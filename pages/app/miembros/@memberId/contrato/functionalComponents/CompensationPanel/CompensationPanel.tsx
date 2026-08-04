import React, { useCallback, useMemo, useState } from "react";
import type { MemberCompensation, MemberCompensationInput } from "../../../../../../../api/types";

type Props = { items: MemberCompensation[]; onCreate: (input: MemberCompensationInput) => Promise<boolean>; onUpdate: (id:number,input:MemberCompensationInput)=>Promise<boolean>; onDelete: (id: number) => Promise<void> };
const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const today = () => new Date().toISOString().slice(0, 10);

export function CompensationPanel({ items, onCreate, onUpdate, onDelete }: Props) {
  const [editingId,setEditingId]=useState(0);
  const [payType,setPayType]=useState<"MONTHLY"|"HOURLY">("MONTHLY");
  const [gross,setGross]=useState("");
  const [hours,setHours]=useState("160");
  const [burden,setBurden]=useState("30");
  const [from,setFrom]=useState(today());
  const [to,setTo]=useState("");
  const [notes,setNotes]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const sorted=useMemo(()=>[...items].sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom)),[items]);
  const submit=useCallback(async()=>{
    const grossAmount=Number(gross), monthlyHours=payType==="MONTHLY"?Number(hours):null, employerCostPct=Number(burden);
    if(!Number.isFinite(grossAmount)||grossAmount<0||payType==="MONTHLY"&&(!monthlyHours||monthlyHours<=0)||!Number.isFinite(employerCostPct)||employerCostPct<0){setError("Revisa salario, horas y coste empresa");return}
    setBusy(true);setError("");
    const input={payType,grossAmount,monthlyHours,employerCostPct,effectiveFrom:from,effectiveTo:to||null,notes:notes.trim()||null};
    const ok=editingId?await onUpdate(editingId,input):await onCreate(input);
    if(ok){setEditingId(0);setGross("");setTo("");setNotes("")};setBusy(false);
  },[burden,editingId,from,gross,hours,notes,onCreate,onUpdate,payType,to]);
  const edit=useCallback((item:MemberCompensation)=>{setEditingId(item.id);setPayType(item.payType);setGross(String(item.grossAmount));setHours(String(item.monthlyHours||160));setBurden(String(item.employerCostPct));setFrom(item.effectiveFrom);setTo(item.effectiveTo||"");setNotes(item.notes||"")},[]);
  return <section className="grid gap-4" data-ui="compensation-panel">
    <div className="grid gap-3 rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface-2)] p-4" data-ui="compensation-form">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-ui="compensation-fields">
        <label className="grid gap-1 text-sm" data-ui="compensation-type-label">Tipo<select className="bo-input" value={payType} onChange={e=>setPayType(e.target.value as "MONTHLY"|"HOURLY")} data-ui="compensation-type"><option value="MONTHLY" data-ui="compensation-monthly">Mensual</option><option value="HOURLY" data-ui="compensation-hourly">Por hora</option></select></label>
        <label className="grid gap-1 text-sm" data-ui="compensation-gross-label">{payType==="MONTHLY"?"Salario bruto mensual":"Bruto por hora"}<input className="bo-input" inputMode="decimal" aria-label={payType==="MONTHLY"?"Salario bruto mensual":"Bruto por hora"} value={gross} onChange={e=>setGross(e.target.value)} data-ui="compensation-gross" /></label>
        {payType==="MONTHLY"?<label className="grid gap-1 text-sm" data-ui="compensation-hours-label">Horas mensuales<input className="bo-input" inputMode="decimal" aria-label="Horas mensuales" value={hours} onChange={e=>setHours(e.target.value)} data-ui="compensation-hours" /></label>:null}
        <label className="grid gap-1 text-sm" data-ui="compensation-burden-label">Coste empresa %<input className="bo-input" inputMode="decimal" value={burden} onChange={e=>setBurden(e.target.value)} data-ui="compensation-burden" /></label>
        <label className="grid gap-1 text-sm" data-ui="compensation-from-label">Desde<input className="bo-input" type="date" value={from} onChange={e=>setFrom(e.target.value)} data-ui="compensation-from" /></label>
        <label className="grid gap-1 text-sm" data-ui="compensation-to-label">Hasta opcional<input className="bo-input" type="date" value={to} onChange={e=>setTo(e.target.value)} data-ui="compensation-to" /></label>
      </div>
      <label className="grid gap-1 text-sm" data-ui="compensation-notes-label">Notas<input className="bo-input" value={notes} onChange={e=>setNotes(e.target.value)} data-ui="compensation-notes" /></label>
      {error?<p className="text-sm text-[var(--bo-text-danger)]" role="alert" data-ui="compensation-error">{error}</p>:null}
      <div className="flex gap-2" data-ui="compensation-actions"><button className="bo-btn bo-btn--primary w-fit" type="button" disabled={busy} onClick={()=>void submit()} data-ui="compensation-submit">{busy?"Guardando...":editingId?"Guardar salario":"Añadir salario"}</button>{editingId?<button className="bo-btn bo-btn--ghost" type="button" onClick={()=>setEditingId(0)} data-ui="compensation-cancel">Cancelar</button>:null}</div>
    </div>
    <div className="grid gap-2" data-ui="compensation-list">{sorted.map(item=><article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--bo-border)] p-3" key={item.id} data-ui="compensation-item"><div data-ui="compensation-item-main"><strong className="text-sm" data-ui="compensation-rate">{money.format(item.effectiveHourlyCost)}/h</strong><p className="text-xs text-[var(--bo-muted)]" data-ui="compensation-detail">{item.payType==="MONTHLY"?`${money.format(item.grossAmount)}/mes · ${item.monthlyHours} h/mes`:`${money.format(item.grossAmount)}/h`} · empresa +{item.employerCostPct}% · {item.effectiveFrom} → {item.effectiveTo||"actual"}</p></div><div className="flex gap-2" data-ui="compensation-item-actions"><button className="bo-btn bo-btn--ghost" type="button" onClick={()=>edit(item)} data-ui="compensation-edit">Editar</button><button className="bo-btn bo-btn--ghost" type="button" onClick={()=>void onDelete(item.id)} data-ui="compensation-delete">Eliminar</button></div></article>)}{!sorted.length?<p className="text-sm text-[var(--bo-muted)]" data-ui="compensation-empty">Sin salario configurado. Costes laborales aparecerán como incompletos.</p>:null}</div>
  </section>;
}
