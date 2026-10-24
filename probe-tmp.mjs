import { chromium } from "@playwright/test";
const b = await chromium.connectOverCDP("http://127.0.0.1:9362");
const p = b.contexts()[0].pages().find(x=>x.url().includes("3098"));
const r = await p.evaluate(()=>{const q=s=>document.querySelector(s); const rect=e=>e?{y:Math.round(e.getBoundingClientRect().y),h:Math.round(e.getBoundingClientRect().height)}:null; const small=[...document.querySelectorAll('button,a,input,[role=button]')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&r.height>0&&(r.width<44||r.height<44);}).map(e=>(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,30)+` ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`); return {vw:innerWidth, docW:document.documentElement.scrollWidth, pageSW:q('[data-ui="pos-page"]')?.scrollWidth, rail:rect(q('.pos-rail')), keypad:rect(q('.pos-keypad')), products:rect(q('.pos-products')), smallTargets: small.slice(0,25), smallCount: small.length};});
console.log(JSON.stringify(r,null,1));
await b.close();
