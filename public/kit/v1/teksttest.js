#!/usr/bin/env node
// Teksttest: controleert of teksten van de klant, van elke lengte, nergens over elkaar vallen,
// worden afgeknipt of buiten beeld lopen. Draai dit vóór je een site oplevert:
//   node tools/teksttest.js
// Het maakt een kopie van de site met alle teksten heel lang, heel kort en met een extreem lang woord,
// bouwt die, en bekijkt elke pagina op 9 schermmaten (van 320 tot 1920 breed). Uitkomst: 0 = goed.
// Nodig: Playwright (staat klaar in een Claude-omgeving; anders: npm i -D playwright && npx playwright install chromium).
// Opties: --varianten lang,kort,woord  --fotos map   (met --fotos komt van elke pagina een schermafdruk)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const SITE = path.resolve(__dirname, '..');
const arg = (n, std) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : std; };
const VARIANTEN = arg('varianten', 'lang,kort,woord').split(',');
const FOTOS = arg('fotos', '');
const SCHERMEN = [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [390, 844], [360, 640], [320, 568]];

// Welke waarden geen tekst voor bezoekers zijn (links, foto's, kleuren, keuzes, datums...)
const GEEN_TEKST = /^(type|link|links?url|url|foto|fotoklein|fotos?|logo|favicon|anker|code|onderwerp|kleur|kleuren|talen|tonen|fotoplek|website|datum|planning|van|naar|vanaf|tot|instagram|facebook|tiktok|pinterest|youtube|whatsapp|telefoon|email|e-?mail|adres|focus|layout|stijl|alle|schrijf|knoplink|cijfer|sterren|nummer)$/i;
const LANG_WOORD = 'Bloemschikwerkplaatsvoorjaarsbijeenkomstenreeksaanmelding';
function verander(s, variant) {
  const rijk = /<\w/.test(s);
  if (variant === 'kort') return rijk ? '<p>A</p>' : 'A';
  if (variant === 'woord') return rijk ? `<p>${LANG_WOORD}${LANG_WOORD}</p>` : LANG_WOORD;
  if (rijk) return s + s + `<p>${LANG_WOORD} ${s.replace(/<[^>]+>/g, ' ').repeat(3)}</p>`;
  return `${s} ${s} ${LANG_WOORD} ${s} ${s}`;
}
function loop(o, variant, sleutel) {
  if (Array.isArray(o)) return o.map((x) => loop(x, variant, sleutel));
  if (o && typeof o === 'object') { for (const k of Object.keys(o)) o[k] = loop(o[k], variant, /^(nl|de|en|fr)$/.test(k) ? sleutel : k); return o; }
  if (typeof o !== 'string' || !o.trim()) return o;
  if (GEEN_TEKST.test(sleutel || '') || /^(https?:|mailto:|tel:|pagina:|#|\/|\d{4}-\d\d-\d\d)/.test(o.trim()) || /^[\d\s.,:+%€-]+$/.test(o) && variant !== 'lang') return o;
  if (/\.(jpe?g|png|webp|gif|svg|avif)$/i.test(o)) return o;
  return verander(o, variant);
}
function jsons(map) {
  return fs.readdirSync(map, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? jsons(path.join(map, d.name)) : d.name.endsWith('.json') ? [path.join(map, d.name)] : []);
}
function paginas(dist, basis = '') {
  return fs.readdirSync(path.join(dist, basis), { withFileTypes: true }).flatMap((d) => d.isDirectory() ? paginas(dist, path.join(basis, d.name)) : d.name === 'index.html' ? ['/' + (basis ? basis.split(path.sep).join('/') + '/' : '')] : []);
}

function zoek() {
  const uit = [];
  const W = document.documentElement.clientWidth;
  const vast = (el) => { for (let p = el; p; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return true; return false; };
  // Tekst alleen voor schermlezers (1 bij 1 pixel) telt niet mee
  const piepklein = (el) => { for (let p = el; p && p !== document.body; p = p.parentElement) { const r = p.getBoundingClientRect(); if (r.width <= 2 || r.height <= 2) return getComputedStyle(p).overflow !== 'visible'; } return false; };
  const zichtbaar = (el) => { const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) return false; return el.getClientRects().length > 0; };
  const naam = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).join('.'); const sec = el.closest('section,header,footer,.mededeling'); return (sec ? (sec.id || sec.className.split(' ')[0]) + ' › ' : '') + s; };
  const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return p; } return null; };
  // 1) Horizontaal buiten beeld
  if (document.documentElement.scrollWidth > W + 1) uit.push(`pagina is breder dan het scherm (${document.documentElement.scrollWidth} > ${W})`);
  // Stukjes: tekstregels, knoppen, foto's
  const stukken = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style,noscript,select,option,.hp,[hidden],.mobielmenu,.balk,.uitvoer,.verzonden,[aria-hidden="true"]')) continue;
    if (piepklein(el)) continue;
    if (!zichtbaar(el) || vast(el) || el.closest('details:not([open]) > :not(summary)')) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const b of r.getClientRects()) if (b.width > 1 && b.height > 1) stukken.push({ el, b, soort: 'tekst' });
  }
  document.querySelectorAll('.knop, img, input, textarea, select, .pijl, .rondje').forEach((el) => {
    if (el.closest('.mobielmenu,.balk,[hidden],.uitvoer,.verzonden,.actiebalk') || !zichtbaar(el) || vast(el)) return;
    const b = el.getBoundingClientRect(); if (b.width > 1 && b.height > 1) stukken.push({ el, b, soort: el.tagName === 'IMG' ? 'foto' : 'knop' });
  });
  // 2) Tekst buiten het scherm (niet in een schuifrij)
  for (const s of stukken) if (s.soort === 'tekst' && !inScroller(s.el) && (s.b.right > W + 1 || s.b.left < -1)) uit.push(`buiten beeld: ${naam(s.el)} "${s.el.textContent.trim().slice(0, 40)}"`);
  // 3) Overlap tussen stukjes die niet in elkaar zitten
  const raak = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  const gezien = new Set();
  for (let i = 0; i < stukken.length; i++) for (let j = i + 1; j < stukken.length; j++) {
    const A = stukken[i], B = stukken[j];
    if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    if (A.soort === 'foto' && B.soort === 'foto') continue;
    if (!raak(A.b, B.b)) continue;
    const knip = (X) => { const sc = inScroller(X.el); if (!sc) return X.b; const r = sc.getBoundingClientRect(); return { left: Math.max(X.b.left, r.left), right: Math.min(X.b.right, r.right), top: X.b.top, bottom: X.b.bottom }; };
    if (!raak(knip(A), knip(B))) continue;
    if (A.el.closest('.h-titel,.duo') && A.el.closest('.h-titel,.duo') === B.el.closest('.h-titel,.duo') && (A.el.closest('.script,.hand') || B.el.closest('.script,.hand'))) continue;
    const k = naam(A.el) + ' ✕ ' + naam(B.el);
    if (gezien.has(k)) continue; gezien.add(k);
    uit.push(`overlap: ${k} ("${A.el.textContent.trim().slice(0, 30)}" / "${B.el.textContent.trim().slice(0, 30)}")`);
  }
  // 4) Afgeknipt: tekst die buiten een vak met overflow hidden valt
  const gemeld = new Set();
  for (const st of stukken) {
    if (st.soort === 'foto') continue;
    for (let p = st.el; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const hx = cs.overflowX === 'hidden' || cs.overflowX === 'clip', hy = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
      if (!hx && !hy) continue;
      if (p.matches('.hp')) break;
      const r = p.getBoundingClientRect();
      const bx = hx && (st.b.left < r.left - 1 || st.b.right > r.right + 1), by = hy && (st.b.top < r.top - 1 || st.b.bottom > r.bottom + 1);
      if (bx || by) { const k = naam(st.el) + '|' + naam(p); if (!gemeld.has(k)) { gemeld.add(k); uit.push(`afgeknipt: ${naam(st.el)} "${st.el.textContent.trim().slice(0, 30)}" valt buiten ${naam(p)}`); } }
    }
  }
  return uit;
}

(async () => {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  const browser = await chromium.launch();
  let totaal = 0;
  for (const variant of VARIANTEN) {
    const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'teksttest-'));
    fs.cpSync(SITE, kopie, { recursive: true, filter: (p) => !/[\\/](\.git|node_modules|dist)([\\/]|$)/.test(p.slice(SITE.length)) });
    if (fs.existsSync(path.join(SITE, 'node_modules'))) fs.symlinkSync(path.join(SITE, 'node_modules'), path.join(kopie, 'node_modules'));
    for (const f of jsons(path.join(kopie, 'content'))) fs.writeFileSync(f, JSON.stringify(loop(JSON.parse(fs.readFileSync(f, 'utf8')), variant), null, 2));
    execFileSync(process.execPath, ['build.js'], { cwd: kopie, stdio: 'ignore' });
    const dist = path.join(kopie, 'dist');
    const server = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(dist, p);
      if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': types[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    });
    await new Promise((r) => server.listen(0, r));
    const poort = server.address().port;
    let fouten = 0;
    for (const pagina of paginas(dist)) for (const [w, h] of SCHERMEN) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', hasTouch: w < 800, isMobile: w < 800 });
      const p = await ctx.newPage();
      await p.goto(`http://localhost:${poort}${pagina}`, { waitUntil: 'networkidle' });
      const talen = await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-taal]')].map((b) => b.dataset.taal))]);
      for (const taal of talen.length ? talen : ['']) {
        await p.evaluate(async (taal) => { const b = taal && document.querySelector(`[data-taal="${taal}"]`); if (b) b.click(); document.querySelectorAll('.verborgen,[data-onthul]').forEach((e) => e.classList.add('toon')); await document.fonts.ready; }, taal);
        await p.waitForTimeout(100);
        const lijst = await p.evaluate(zoek);
        if (lijst.length) { fouten += lijst.length; console.log(`\n[${variant}] ${pagina} ${w}x${h}${taal ? ' ' + taal : ''}: ${lijst.length}`); lijst.slice(0, 25).forEach((f) => console.log('  - ' + f)); }
        if (FOTOS && taal === talen[0] || FOTOS && !talen.length) { fs.mkdirSync(FOTOS, { recursive: true }); await p.screenshot({ path: path.join(FOTOS, `${variant}${pagina.replace(/\//g, '_')}${w}x${h}.png`) }); }
      }
      await ctx.close();
    }
    server.close();
    fs.rmSync(kopie, { recursive: true, force: true });
    console.log(`[${variant}] ${fouten ? fouten + ' problemen' : 'alles goed'}`);
    totaal += fouten;
  }
  await browser.close();
  console.log(totaal ? `\nNiet goed: ${totaal} problemen. Los ze op in src/style.css (zie BOUWINSTRUCTIES, "Teksten van elke lengte").` : '\nGoed: geen enkele tekst valt over iets anders heen of wordt afgeknipt.');
  process.exit(totaal ? 1 : 0);
})();
