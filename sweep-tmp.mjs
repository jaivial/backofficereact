import { chromium } from "@playwright/test";
const B="https://127.0.0.1:3010";
const pages=[
 ["/app/fichaje","DatePicker"],
 ["/app/facturas","DatePicker"],
 ["/app/reservas/config?date=2026-08-19","MonthCalendarDatePicker"],
 ["/app/reservas/tables?date=2026-08-19","MonthCalendarDatePicker"],
 ["/app/horarios","DateRangePicker"],
 ["/app/pos","POSCashDay"],
 ["/app/reservas","?"],
 ["/app/config","?"],
];
const b=await chromium.launch();
const c=await b.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
const p=await c.newPage();
const errs=[];
p.on("pageerror",e=>errs.push(e.message.slice(0,150)));
await p.goto(B+"/login",{waitUntil:"load"});
await p.evaluate(async()=>{await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:"admin@villacarmen.com",password:"admin123"}),credentials:"include"});});
for (const [url,kind] of pages){
  errs.length=0;
  try{ await p.goto(B+url,{waitUntil:"networkidle",timeout:25000}); }catch(e){ console.log(url,"NAV-FAIL"); continue; }
  await p.waitForTimeout(2200);
  const btns=p.locator('[data-ui="date-picker-btn"], [data-ui="date-range-btn"], [data-ui="date-dropdown"]');
  const n=await btns.count();
  if(!n){ console.log(`${url} [${kind}] -> no date button found`); continue; }
  let out=[];
  for(let i=0;i<n;i++){
    const t=btns.nth(i);
    if(!(await t.isVisible().catch(()=>false))){ out.push(`#${i}:hidden`); continue; }
    await t.click().catch(e=>out.push(`#${i}:clickerr`));
    await p.waitForTimeout(700);
    const pop=p.locator('[data-ui="date-picker-popover"], [data-ui="date-range-popover"], [role="dialog"][aria-label="Calendario"]');
    const cnt=await pop.count();
    const vis=cnt? await pop.first().isVisible():false;
    out.push(`#${i}:${vis?"OK":"FAIL(count="+cnt+")"}`);
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  }
  console.log(`${url} [${kind}] btns=${n} -> ${out.join(" ")} ${errs.length?"| ERR:"+errs[0]:""}`);
}
await b.close();
