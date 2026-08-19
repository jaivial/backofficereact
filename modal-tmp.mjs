import { chromium } from "@playwright/test";
const B="https://127.0.0.1:3010";
const b=await chromium.launch();
const c=await b.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
const p=await c.newPage();
p.on("pageerror",e=>console.log("[pageerror]",e.message.slice(0,150)));
await p.goto(B+"/login",{waitUntil:"load"});
await p.evaluate(async()=>{await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:"admin@villacarmen.com",password:"admin123"}),credentials:"include"});});

// POS no-cash-day modal
await p.goto(B+"/app/pos",{waitUntil:"networkidle"}); await p.waitForTimeout(2500);
let m = await p.getByTestId("pos-no-cash-day-picker").count();
console.log("pos-no-cash-day-picker present:", m);
if(m){ await p.getByTestId("pos-no-cash-day-picker").click(); await p.waitForTimeout(900);
  console.log("  pop:", await p.locator('[data-ui="date-picker-popover"]').count(), "vis:", await p.locator('[data-ui="date-picker-popover"]').isVisible().catch(()=>false)); }

// Facturas: open invoice form modal
await p.goto(B+"/app/facturas",{waitUntil:"networkidle"}); await p.waitForTimeout(2500);
const newBtn = p.locator('button', {hasText:/nueva factura|crear factura|nueva/i}).first();
if(await newBtn.count()){ await newBtn.click(); await p.waitForTimeout(2000);
  const di = p.getByTestId("invoice-date-input");
  console.log("invoice-date-input present:", await di.count());
  if(await di.count()){
    await di.click(); await p.waitForTimeout(900);
    const pop=p.locator('[data-ui="date-picker-popover"]');
    console.log("  pop:",await pop.count(),"vis:",await pop.count()?await pop.first().isVisible():false);
    if(await pop.count()){ const bb=await pop.first().boundingBox(); console.log("  box:",JSON.stringify(bb));
      const z=await pop.first().evaluate(el=>{const s=getComputedStyle(el);return {z:s.zIndex,pos:s.position,op:s.opacity,vis:s.visibility};});
      console.log("  computed:",JSON.stringify(z));
      // is it under the modal overlay?
      const bb2=bb; if(bb2){ const el=await p.evaluate(({x,y})=>{const e=document.elementFromPoint(x+5,y+5);return e?e.getAttribute("data-ui")||e.className?.toString().slice(0,60):null;},{x:bb2.x,y:bb2.y}); console.log("  elementFromPoint at popover corner:",el); }
    }
  }
} else console.log("no 'nueva factura' button");
await b.close();
