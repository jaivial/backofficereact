import { chromium } from "@playwright/test";
const b = await chromium.connectOverCDP("http://127.0.0.1:9362");
const p = b.contexts()[0].pages().find(x=>x.url().includes("3098"));
const r = await p.evaluate(()=>{const btn=[...document.querySelectorAll('.pos-rail__btn, button')].find(b=>/Comanda$/.test(b.textContent.trim())||b.getAttribute('aria-label')==='Comanda'); return {comandaDisabled: btn?.disabled, comandaText: btn?.textContent.trim(), comandaTitle: btn?.title, lines:[...document.querySelectorAll('.pos-line')].map(l=>l.innerText.replace(/\n/g,' ').slice(0,40))};});
console.log(JSON.stringify(r));
await b.close();
