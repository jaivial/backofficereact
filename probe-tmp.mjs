import { chromium } from "@playwright/test";
const b = await chromium.connectOverCDP("http://127.0.0.1:9362");
const p = b.contexts()[0].pages().find(x=>x.url().includes("3098"));
const r = await p.evaluate(()=>{const out={}; let e=document.querySelector('[data-ui="pos-settings"]'); const chain=[]; while(e && e!==document.body){const cs=getComputedStyle(e); chain.push({tag:e.tagName, cls:(e.className||'').toString().slice(0,60), ovY:cs.overflowY, h:e.clientHeight, sh:e.scrollHeight}); e=e.parentElement;} return {vh:innerHeight, docH:document.documentElement.scrollHeight, chain};});
console.log(JSON.stringify(r,null,1));
await b.close();
