import { chromium } from "@playwright/test";
const B="https://127.0.0.1:3010";
const b=await chromium.launch();
const c=await b.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
const p=await c.newPage();
p.on("pageerror",e=>console.log("[pageerror]",e.message.slice(0,200)));
await p.goto(B+"/login",{waitUntil:"load"});
await p.evaluate(async()=>{await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:"admin@villacarmen.com",password:"admin123"}),credentials:"include"});});
await p.goto(B+"/app/facturas",{waitUntil:"networkidle"}); await p.waitForTimeout(2500);
// go to "añadir" tab -> invoice form with DatePickers
await p.getByTestId("tab-añadir").click(); await p.waitForTimeout(2500);
for (const tid of ["invoice-date-input","invoice-due-date-input","invoice-reservation-date-input"]) {
  const t=p.getByTestId(tid);
  const n=await t.count();
  if(!n){ console.log(tid,"absent"); continue; }
  if(!await t.first().isVisible().catch(()=>false)){ console.log(tid,"hidden"); continue; }
  await t.first().click(); await p.waitForTimeout(800);
  const pop=p.locator('[data-ui="date-picker-popover"]');
  const cnt=await pop.count();
  const vis=cnt?await pop.first().isVisible():false;
  let extra="";
  if(cnt){ const bb=await pop.first().boundingBox(); const cs=await pop.first().evaluate(el=>{const s=getComputedStyle(el);return s.zIndex+"|"+s.position+"|op:"+s.opacity;});
    const top=bb?await p.evaluate(({x,y})=>{const e=document.elementFromPoint(x+8,y+8);return e?(e.getAttribute("data-ui")||e.tagName+"."+String(e.className).slice(0,40)):null;},{x:bb.x,y:bb.y}):null;
    extra=` box=${JSON.stringify(bb)} css=${cs} topEl=${top}`; }
  console.log(tid,"->",vis?"OK":"FAIL","count="+cnt+extra);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
}
await b.close();
