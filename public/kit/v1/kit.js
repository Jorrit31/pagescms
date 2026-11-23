#!/usr/bin/env node
// Webstudio kit: haalt de vaste bestanden (die op elke klantsite hetzelfde zijn) op bij het
// beheerscherm, zodat een verbetering daar meteen voor alle sites geldt. NIET AANPASSEN per klant.
//
// Draait vóór elke bouw (package.json: "build": "node tools/kit.js && node build.js").
// Welke bestanden: "webstudioKit" in package.json. Lukt ophalen niet (beheerscherm onbereikbaar,
// geen internet), dan bouwt de site gewoon met de kopie die in de repo staat.
// Lokaal bijwerken en daarna committen: node tools/kit.js
// Uitzetten (bijvoorbeeld om iets te testen): KIT=uit in Cloudflare Pages.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const VERSIE = 'v1';
const CMS_STANDAARD = 'https://beheerscherm.jorritbasten31.workers.dev';

const pakket = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const bestanden = Array.isArray(pakket.webstudioKit) ? pakket.webstudioKit : [];
const basis = String(process.env.KIT_URL || process.env.CMS_URL || CMS_STANDAARD).split(',')
  .map((u) => { try { return new URL(u.trim()).origin; } catch (e) { return null; } }).find(Boolean);

// Een bestand moet heel zijn voordat het een werkende kopie vervangt.
const klopt = (naam, tekst) => {
  if (!tekst || tekst.length < 200) return false;
  if (/\.js$/.test(naam)) {
    try { new vm.Script(tekst.replace(/^#!.*\n/, ''), { filename: naam }); } catch (e) { return false; }
    return true;
  }
  if (/\.html$/.test(naam)) return /<\/html>\s*$/i.test(tekst) && tekst.includes('renderSite');
  return true;
};

(async () => {
  if (process.env.KIT === 'uit' || !bestanden.length || !basis || typeof fetch !== 'function') return;
  let nieuw = 0;
  let mislukt = 0;
  for (const naam of bestanden) {
    const doel = path.join(ROOT, naam);
    if (!doel.startsWith(ROOT + path.sep)) continue;
    try {
      const antwoord = await fetch(`${basis}/kit/${VERSIE}/${naam.split('/').pop()}`, { signal: AbortSignal.timeout(15000) });
      if (!antwoord.ok) throw new Error(`HTTP ${antwoord.status}`);
      const tekst = await antwoord.text();
      if (!klopt(naam, tekst)) throw new Error('bestand is niet heel');
      const oud = fs.existsSync(doel) ? fs.readFileSync(doel, 'utf8') : '';
      if (oud !== tekst) { fs.mkdirSync(path.dirname(doel), { recursive: true }); fs.writeFileSync(doel, tekst); nieuw++; console.log(`Kit: ${naam} bijgewerkt.`); }
    } catch (e) {
      mislukt++;
      console.log(`Kit: ${naam} niet opgehaald (${e.message}), de kopie in de repo wordt gebruikt.`);
    }
  }
  if (!nieuw && !mislukt) console.log(`Kit ${VERSIE}: alles al bij.`);
})();
