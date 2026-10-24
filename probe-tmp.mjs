import { chromium } from "@playwright/test";
const b = await chromium.connectOverCDP("http://127.0.0.1:9362");
const p = b.contexts()[0].pages().find(x=>x.url().includes("3098"));
const r = await p.evaluate(()=>{const q=s=>document.querySelector(s); const rect=e=>e?{h:Math.round(e.getBoundingClientRect().height),y:Math.round(e.getBoundingClientRect().y)}:null; return {vh:innerHeight, work:rect(q('.pos-sell__work')), register:rect(q('.pos-sell__row--register')), ticket:rect(q('.pos-ticketPanel')), head:rect(q('.pos-ticketPanel__head')||q('.pos-ticketPanel header')), lines:rect(q('.pos-ticketPanel__lines')), total:rect(q('.pos-ticketPanel__total')||q('[data-testid="pos-ticket-total"]')), keypad:rect(q('.pos-keypad')), line:rect(q('.pos-line'))};});
console.log(JSON.stringify(r));
await b.close();
