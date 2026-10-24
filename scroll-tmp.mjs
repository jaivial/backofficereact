import { chromium } from "@playwright/test";
const b = await chromium.connectOverCDP("http://127.0.0.1:9362");
const p = b.contexts()[0].pages().find(x=>x.url().includes("3098"));
await p.evaluate(()=>{document.querySelector('[data-ui="pos-page"]').scrollTop=99999;});
await b.close();
