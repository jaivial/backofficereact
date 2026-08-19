import { chromium } from "@playwright/test";
const B="https://backoffice-dev.menustudioai.com";
const b=await chromium.launch();
const c=await b.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
const p=await c.newPage();
const errs=[];
p.on("pageerror",e=>errs.push("PE:"+e.message.slice(0,160)));
p.on("console",m=>{if(m.type()==="error")errs.push("CE:"+m.text().slice(0,160));});
try{
await p.goto(B+"/login",{waitUntil:"load",timeout:30000});
await p.evaluate(async()=>{await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:"admin@villacarmen.com",password:"admin123"}),credentials:"include"});});
await p.goto(B+"/app/reservas/config?date=2026-08-19",{waitUntil:"networkidle",timeout:30000});
await p.waitForTimeout(3000);
console.log("errors so far:", errs.slice(0,6).join("\n  ")||"none");
const t=p.getByTestId("reservas-config-date-picker");
console.log("trigger count:",await t.count());
await t.click();
await p.waitForTimeout(1500);
console.log("aria-expanded:",await t.getAttribute("aria-expanded"));
console.log("popover:",await p.locator('[data-ui="date-picker-popover"]').count());
console.log("month-calendar:",await p.getByTestId("month-calendar").count());
console.log("hydrated? react root has listeners:", await p.evaluate(()=>!!document.querySelector("#root")?.__reactContainer$ || Object.keys(document.querySelector("#root")||{}).some(k=>k.startsWith("__react"))));
}catch(e){console.log("ERR:",e.message.slice(0,300));}
console.log("all errors:",errs.slice(0,10).join("\n  ")||"none");
await b.close();
