import { chromium } from 'playwright';
const port = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
const html = `<!DOCTYPE html><html><body><div id="out"></div>
<script type="module">
try {
  const { default: mermaid } = await import('http://localhost:${port}/mermaid.esm.mjs');
  mermaid.initialize({ startOnLoad: false });
  const { svg } = await mermaid.render('t', 'flowchart TB\\n  A[x] --> P\\n  P@{ shape: person, label: "Person" }\\n  P --> B[y]');
  document.getElementById('out').innerHTML = svg;
  window.__result = 'OK len=' + svg.length;
} catch (e) {
  window.__result = 'RENDER FAILED: ' + (e.stack || e.message);
}
window.__done = true;
</scr`+`ipt></body></html>`;
await page.setContent(html);
await page.waitForFunction(() => window.__done === true, { timeout: 20000 }).catch(()=>{});
console.log(await page.evaluate(() => window.__result || '(no result - timeout)'));
await browser.close();
