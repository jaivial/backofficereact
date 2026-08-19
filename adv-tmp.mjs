import { chromium } from "@playwright/test";
const B="https://127.0.0.1:3010";
const b=await chromium.launch();
async function ctx(opts={}){const c=await b.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:900},...opts});const p=await c.newPage();
 p.on("pageerror",e=>console.log("  [pageerror]",e.message.slice(0,140)));
 await p.goto(B+"/login",{waitUntil:"load"});
 await p.evaluate(async()=>{await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:"admin@villacarmen.com",password:"admin123"}),credentials:"include"});});
 return {c,p};}
async function probe(p,label){const t=p.getByTestId("reservas-config-date-picker");
 if(!await t.count()){console.log(label,"-> trigger absent");return;}
 await t.click().catch(e=>console.log("  clickerr",e.message.slice(0,60)));
 await p.waitForTimeout(1200);
 const pop=p.locator('[data-ui="date-picker-popover"]');const cnt=await pop.count();
 const vis=cnt?await pop.first().isVisible():false;
 let d="";
 if(cnt){const bb=await pop.first().boundingBox();const cs=await pop.first().evaluate(el=>{const s=getComputedStyle(el);return `op:${s.opacity} vis:${s.visibility} z:${s.zIndex} disp:${s.display} tf:${s.transform}`;});
  const inView=bb?(bb.y>=0&&bb.y+bb.height<=await p.evaluate(()=>innerHeight)+1&&bb.x>=0):null;
  d=` box=${bb?`${Math.round(bb.x)},${Math.round(bb.y)} ${Math.round(bb.width)}x${Math.round(bb.height)}`:"null"} inView=${inView} ${cs}`;}
 console.log(`${label} -> ${vis?"OK":"FAIL"} count=${cnt}${d}`);
 await p.keyboard.press("Escape");await p.waitForTimeout(300);}

// 1. client-side navigation (Vike client routing) instead of full load
{const {c,p}=await ctx();
 await p.goto(B+"/app/reservas",{waitUntil:"networkidle"});await p.waitForTimeout(2500);
 await p.evaluate(()=>{const a=document.createElement("a");a.href="/app/reservas/config?date=2026-08-19";a.id="nav";document.body.appendChild(a);a.click();});
 await p.waitForTimeout(3500);
 console.log("url after client nav:",p.url());
 await probe(p,"client-side nav");await c.close();}

// 2. scrolled to bottom
{const {c,p}=await ctx();
 await p.goto(B+"/app/reservas/config?date=2026-08-19",{waitUntil:"networkidle"});await p.waitForTimeout(2500);
 await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(600);
 await probe(p,"scrolled bottom");await c.close();}

// 3. light theme
{const {c,p}=await ctx();
 await p.goto(B+"/app/reservas/config?date=2026-08-19",{waitUntil:"networkidle"});await p.waitForTimeout(2500);
 const tt=p.getByTestId("theme-toggle"); if(await tt.count()){await tt.click();await p.waitForTimeout(1200);}
 console.log("theme:",await p.evaluate(()=>document.documentElement.getAttribute("data-theme")));
 await probe(p,"light theme");await c.close();}

// 4. very short viewport (little vertical space)
{const {c,p}=await ctx({viewport:{width:1440,height:420}});
 await p.goto(B+"/app/reservas/config?date=2026-08-19",{waitUntil:"networkidle"});await p.waitForTimeout(2500);
 await probe(p,"short viewport 1440x420");await c.close();}

// 5. narrow viewport
{const {c,p}=await ctx({viewport:{width:360,height:640}});
 await p.goto(B+"/app/reservas/config?date=2026-08-19",{waitUntil:"networkidle"});await p.waitForTimeout(2500);
 await probe(p,"narrow 360x640");await c.close();}

// 6. reduced motion
{const {c,p}=await ctx({reducedMotion:"reduce"});
 await p.goto(B+"/app/reservas/config?date=2026-08-19",{waitUntil:"networkidle"});await p.waitForTimeout(2500);
 await probe(p,"reduced motion");await c.close();}
await b.close();
