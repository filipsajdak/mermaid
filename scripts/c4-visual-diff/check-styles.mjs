import { chromium } from 'playwright';
const port = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE:', m.text()));
const html = (cfg) => `<!DOCTYPE html><html><body><div id="out"></div>
<script type="module">
try {
  const { default: mermaid } = await import('http://localhost:${port}/mermaid.esm.mjs');
  mermaid.initialize(${cfg});
  const { svg } = await mermaid.render('t', 'C4Context\\n  Person(p, "P", "desc")');
  document.getElementById('out').innerHTML = svg;
  window.__style = document.querySelector('#out style')?.textContent ?? '(no style)';
} catch (e) {
  window.__style = 'RENDER FAILED: ' + e.message;
}
window.__done = true;
</scr` + `ipt></body></html>`;

for (const [name, cfg] of [
  ['default-fonts', `{ startOnLoad: false }`],
  ['injection', `{ startOnLoad: false, c4: { personFontFamily: 'x; background:url(evil)', personFontWeight: '700} .pwn{color:red' } }`],
]) {
  await page.setContent(html(cfg));
  await page.waitForFunction(() => window.__done === true, { timeout: 30000 });
  const style = await page.evaluate(() => window.__style);
  const personRules = style.split('}').filter((r) => r.includes('c4-person') && r.includes('font')).join('}');
  console.log(`=== ${name} ===`);
  console.log((personRules.trim().slice(0, 400)) || '(no c4-person font rule)');
  if (name === 'injection') {
    console.log('contains url(evil):', style.includes('url(evil)'));
    console.log('contains .pwn:', style.includes('.pwn'));
  }
}
await browser.close();
