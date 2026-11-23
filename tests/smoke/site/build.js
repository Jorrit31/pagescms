// Bouwt de site uit content/ naar de map dist/. NIET AANPASSEN per klant (alleen src/ verschilt).
// Cloudflare Pages draait dit bij elke wijziging (build command: npm run build, output: dist).
// De HTML zelf maakt src/render.js, zodat het live voorbeeld precies dezelfde code gebruikt.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
// Het beheerscherm (formulier, bezoekersteller, live voorbeeld). CMS_URL in Cloudflare Pages mag het overschrijven.
const CMS_STANDAARD = 'https://beheerscherm.jorritbasten31.workers.dev';
const DIST = path.join(ROOT, 'dist');
const leesJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// content/home.json -> content.home
// content/nieuws/eerste-bericht.json -> content.nieuws = [{ _bestand: 'eerste-bericht', ... }]
function leesContent() {
  const content = {};
  const map = path.join(ROOT, 'content');
  for (const f of fs.readdirSync(map, { withFileTypes: true })) {
    const p = path.join(map, f.name);
    if (f.isFile() && f.name.endsWith('.json')) content[f.name.slice(0, -5)] = leesJson(p);
    else if (f.isDirectory()) {
      content[f.name] = fs.readdirSync(p).filter((n) => n.endsWith('.json')).sort()
        .map((n) => Object.assign(leesJson(path.join(p, n)), { _bestand: n.slice(0, -5) }));
    }
  }
  return content;
}

const content = leesContent();
// Inplannen (src/inplannen.js): wat nu nog niet (of niet meer) online hoort, komt niet op de site.
// Het beheerscherm bouwt de site vanzelf opnieuw op elk ingepland tijdstip. Het live voorbeeld krijgt alles.
const inplannen = require('./src/inplannen.js');
const opSite = inplannen.filter(content);
const volgende = inplannen.momenten(content)[0];
if (volgende) console.log(`Ingepland: de site verandert weer op ${inplannen.mooi(volgende)}.`);
const css = fs.readFileSync(path.join(ROOT, 'src/style.css'), 'utf8');
const js = fs.existsSync(path.join(ROOT, 'src/script.js')) ? fs.readFileSync(path.join(ROOT, 'src/script.js'), 'utf8') : '';
const render = require('./src/render.js');
// Formulieren versturen via het beheerscherm (dat bewaart het bericht en mailt de klant).
// Nodig: CMS_URL (zie hieronder) en "repository" in package.json, of zelf FORMULIER_URL.
const pakket = leesJson(path.join(ROOT, 'package.json'));
const repoNaam = String(process.env.SITE_REPO || pakket.repository || '').replace(/^github:/, '').replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
const cmsBasis = String(process.env.CMS_URL || CMS_STANDAARD).split(',').map((u) => { try { return new URL(u.trim()).origin; } catch (e) { return null; } }).find(Boolean);
const formulier = process.env.FORMULIER_URL || (cmsBasis && /^[\w.-]+\/[\w.-]+$/.test(repoNaam) ? `${cmsBasis}/api/forms/${repoNaam}/contact` : '');
if (!formulier) console.log('Let op: het contactformulier verstuurt nog niets ("repository" in package.json ontbreekt).');
// Bezoekersteller zonder cookies: telt in het beheerscherm (pagina "Bezoekers"). Zelfde voorwaarden als het formulier.
const teller = process.env.TELLER_URL === 'uit' ? '' : process.env.TELLER_URL || (cmsBasis && /^[\w.-]+\/[\w.-]+$/.test(repoNaam) ? `${cmsBasis}/api/stats/${repoNaam}` : '');
const { paginas, basisUrl } = render(opSite, { css, js, formulier, teller, siteUrl: process.env.SITE_URL });

/* ---------- wegschrijven ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
if (fs.existsSync(path.join(ROOT, 'public'))) fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });
for (const p of paginas) {
  const doel = path.join(DIST, p.pad);
  if (!doel.startsWith(DIST + path.sep)) throw new Error('Ongeldig paginapad: ' + p.pad);
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  fs.writeFileSync(doel, p.html);
}

// Doorverwijzingen (content/doorverwijzingen.json): oude adressen blijven werken.
// "lijst" maak je zelf in het beheerscherm (bijvoorbeeld adressen van de oude website).
// "automatisch" vult het beheerscherm als de klant een pagina hernoemt of verwijdert (bestandsnamen).
// Oude adressen van verwijderde bestanden: per map de regel van render.js. Nieuwe soort pagina's? Zet hem hier bij.
const OUD_ADRES = { paginas: (naam) => `${naam}/`, nieuws: (naam) => `nieuws/${naam}/` };
function doorverwijzingen() {
  const bestand = content.doorverwijzingen || {};
  const bestaat = new Set(paginas.map((p) => '/' + p.pad.replace(/index\.html$/, '')));
  const adresVan = (pad) => {
    const bron = String(pad || '').replace(/^content\//, '').replace(/\.json$/, '');
    const pagina = paginas.find((p) => p.bron === bron);
    if (pagina) return '/' + pagina.pad.replace(/index\.html$/, '');
    const [map, ...rest] = bron.split('/');
    return OUD_ADRES[map] && rest.length ? '/' + OUD_ADRES[map](rest.join('/')) : null;
  };
  const netjes = (a) => { const t = String(a || '').trim(); if (/^https?:\/\//i.test(t)) return t; if (!t) return ''; return ('/' + t.replace(/^\/+/, '')).replace(/\s/g, '%20'); };
  const regels = new Map();
  for (const r of Array.isArray(bestand.automatisch) ? bestand.automatisch : []) {
    const van = adresVan(r && r.van);
    const naar = (r && r.naar ? adresVan(r.naar) : null) || '/';
    if (van && van !== '/' && !bestaat.has(van) && van !== naar) regels.set(van, naar);
  }
  // Wat je zelf invult gaat voor (en mag ook een bestaande pagina doorsturen).
  for (const r of Array.isArray(bestand.lijst) ? bestand.lijst : []) {
    const van = netjes(r && r.van);
    const naar = netjes(r && r.naar) || '/';
    if (van.startsWith('/') && van !== '/' && van !== naar) regels.set(van, naar);
  }
  if (!regels.size) return;
  const tekst = [...regels].map(([van, naar]) => `${van} ${naar} 301`).join('\n');
  fs.appendFileSync(path.join(DIST, '_redirects'), `${tekst}\n`);
  console.log(`${regels.size} doorverwijzing(en).`);
}
doorverwijzingen();

// Voor Google: robots.txt en (als het adres van de site bekend is) sitemap.xml met alle pagina's.
const vandaag = new Date().toISOString().slice(0, 10);
const inSitemap = paginas.filter((p) => p.pad !== '404.html' && p.pad !== 'zoeken/index.html');
if (basisUrl) {
  const regels = inSitemap.map((p) => `  <url><loc>${(basisUrl + p.pad.replace(/index\.html$/, '')).replace(/&/g, '&amp;')}</loc><lastmod>${vandaag}</lastmod></url>`);
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${regels.join('\n')}\n</urlset>\n`);
} else {
  console.log('Let op: geen sitemap gemaakt. Vul bij Algemene gegevens het adres van de website in (of SITE_URL).');
}
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /preview\n${basisUrl ? `Sitemap: ${basisUrl}sitemap.xml\n` : ''}`);

// Zoeken op de site (blok "Zoeken" en de zoekknop in het menu): de tekst van elke pagina in zoeken.json.
const tekstVan = (html) => html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<form\b[\s\S]*?<\/form>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const zoekIndex = inSitemap.map((p) => {
  const titel = ((p.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || p.html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const main = (p.html.match(/<main>([\s\S]*)<\/main>/i) || [])[1] || '';
  return { titel: tekstVan(titel), url: p.pad.replace(/index\.html$/, ''), tekst: tekstVan(main).slice(0, 6000) };
});
fs.writeFileSync(path.join(DIST, 'zoeken.json'), JSON.stringify(zoekIndex));

// Live voorbeeld voor het beheerscherm op /preview.
// CMS_URL (in Cloudflare Pages bij Variables and Secrets, voor Production én Preview) = het adres
// van het beheerscherm. Alleen dat adres mag het voorbeeld tonen en aansturen.
const cmsAdressen = String(process.env.CMS_URL || CMS_STANDAARD).split(',').map((u) => {
  try { return new URL(u.trim()).origin; } catch (e) { return null; }
}).filter(Boolean);
const start = { content, css, js, cms: cmsAdressen, formulier };
const preview = fs.readFileSync(path.join(ROOT, 'src/preview.html'), 'utf8')
  .replace('/*__START__*/null', () => JSON.stringify(start).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'));
fs.writeFileSync(path.join(DIST, 'preview.html'), preview);
fs.copyFileSync(path.join(ROOT, 'src/render.js'), path.join(DIST, 'preview-render.js'));
fs.copyFileSync(path.join(ROOT, 'src/inplannen.js'), path.join(DIST, 'preview-inplannen.js'));
const previewKoppen = `  ! X-Frame-Options
  Content-Security-Policy: frame-ancestors 'self' ${cmsAdressen.length ? cmsAdressen.join(' ') : 'https:'}
  X-Robots-Tag: noindex
  Cache-Control: no-store
`;
fs.appendFileSync(path.join(DIST, '_headers'), `
/preview
${previewKoppen}
/preview.html
${previewKoppen}
/preview-render.js
  X-Robots-Tag: noindex
  Cache-Control: no-store
/preview-inplannen.js
  X-Robots-Tag: noindex
  Cache-Control: no-store
`);

// Grote foto's (bijvoorbeeld rechtstreeks van een telefoon) worden verkleind, zodat de site snel blijft.
async function verklein() {
  let sharp;
  try { sharp = require('sharp'); } catch (e) { console.log('Foto\'s niet verkleind (sharp niet geïnstalleerd).'); return; }
  const MAX = 1800;
  const map = path.join(DIST, 'img');
  if (!fs.existsSync(map)) return;
  const bestanden = [];
  (function loop(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) loop(p); else if (/\.(jpe?g|png|webp)$/i.test(f.name)) bestanden.push(p); } })(map);
  let aantal = 0;
  for (const p of bestanden) {
    try {
      const img = sharp(fs.readFileSync(p), { failOn: 'none' }).rotate();
      const m = await img.metadata();
      if (Math.max(m.width || 0, m.height || 0) <= MAX && fs.statSync(p).size <= 600 * 1024) continue;
      let uit = img.resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true });
      if (m.format === 'png') uit = uit.png({ compressionLevel: 9, palette: !m.hasAlpha });
      else if (m.format === 'webp') uit = uit.webp({ quality: 82 });
      else uit = uit.jpeg({ quality: 82, mozjpeg: true });
      const buf = await uit.toBuffer();
      if (buf.length < fs.statSync(p).size) { fs.writeFileSync(p, buf); aantal++; }
    } catch (e) { console.warn('Kon foto niet verkleinen, origineel blijft:', path.relative(DIST, p)); }
  }
  if (aantal) console.log(`${aantal} foto('s) verkleind.`);
}

// Controle: elke foto die in de content staat moet bestaan
const ontbreekt = [];
JSON.stringify(content, (key, v) => {
  if (typeof v === 'string' && /^\/?img\/.+\.(jpe?g|png|webp|gif|avif)$/i.test(v) && !fs.existsSync(path.join(DIST, v.replace(/^\/+/, '')))) ontbreekt.push(v);
  return v;
});
if (ontbreekt.length) console.warn('Let op, deze foto\'s bestaan niet:', [...new Set(ontbreekt)].join(', '));
verklein().then(() => console.log(`Klaar: ${paginas.length} pagina('s).`));
