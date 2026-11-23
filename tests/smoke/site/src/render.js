// Maakt de HTML van de site uit de content. Draait in Node (build.js) én in de browser (live voorbeeld).
// Daarom: geen require, geen fs, geen fetch. Alleen gewone JavaScript.
(function (wereld) {
'use strict';

function render(content, opties) {
opties = opties || {};
const bewerk = !!opties.bewerk;
const home = content.home || {};
const alg = content.algemeen || {};

/* ---------- hulpjes (laten staan) ---------- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const leeg = (v) => v == null || String(v).trim() === '';
const lijst = (a) => (Array.isArray(a) ? a : []);
// Foto's staan in de content als /img/naam.jpg; relatief maken werkt online, lokaal en in het voorbeeld.
const src = (p) => esc(String(p || '').replace(/^\/+/, ''));
// Waar een pagina van de site staat. content/paginas/over-ons.json -> over-ons/ (namen die de site
// zelf al gebruikt krijgen 'pagina-' ervoor), een item uit een andere map -> <map>/<bestand>/.
const BEZET = ['nieuws', 'img', 'fonts', 'preview', 'index', 'paginas', 'zoeken'];
const paginaPad = (x) => (BEZET.includes(x._bestand) ? 'pagina-' : '') + x._bestand + '/';
// Een link die de klant uit de lijst "Kies een pagina" koos: pagina:home, pagina:nieuws/2026-11-14-kerstbrood,
// pagina:paginas/over-ons. Bestaat de pagina niet (meer) of is hij verborgen, dan wijst de link nergens heen.
function paginaLink(waarde) {
  const [map, bestand] = String(waarde).slice('pagina:'.length).split('/');
  if (!bestand) return map === 'home' ? './' : '';
  const item = lijst(content[map]).find((x) => x && x._bestand === bestand);
  if (!item || item.verbergen) return '';
  return map === 'paginas' ? paginaPad(item) : `${map}/${bestand}/`;
}
// Alleen veilige links: https, mailto, tel, #sectie of een pagina op de eigen site.
function link(l) {
  let ruw = String(l == null ? '' : l).trim();
  if (/^pagina:/i.test(ruw)) { ruw = paginaLink(ruw); if (!ruw) return '#'; }
  const schoon = ruw.replace(/[\u0000- \u007f-\u009f]/g, '');
  if (!ruw) return '#';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(schoon) || /^#[\w-]*$/.test(schoon)) return esc(ruw);
  if (!/^[a-z][a-z0-9+.-]*:/i.test(schoon) && !schoon.startsWith('//')) return esc(ruw);
  return '#';
}
// Tekst met alinea's: een lege regel begint een nieuwe alinea.
const alineas = (t) => String(t == null ? '' : t).split(/\n\s*\n/).filter((x) => x.trim()).map((x) => `<p>${esc(x.trim()).replace(/\n/g, '<br>')}</p>`).join('\n');
// Opgemaakte tekst uit het beheerscherm (tussenkoppen, vet, lijsten, links, knoppen, foto's,
// video's, tabellen, uitlijnen, lijn en witruimte).
// Alleen deze onderdelen blijven over; scripts, stijlen en alle andere HTML gaan eruit.
// Tekst zonder opmaak (van vóór de tekstverwerker) wordt gewoon alinea's.
const OPMAAK = { p: 1, h2: 1, h3: 1, h4: 1, strong: 1, b: 1, em: 1, i: 1, u: 1, s: 1, a: 1, ul: 1, ol: 1, li: 1, blockquote: 1, span: 1, table: 1, thead: 1, tbody: 1, tr: 1, th: 1, td: 1, br: 0, hr: 0, img: 0 };
// Klassen die het beheerscherm zet; de rest gaat eruit. De vormgeving staat in style.css.
const UITLIJNEN = ['midden', 'rechts'];
const GROOTTE = ['tekst-klein', 'tekst-groot', 'tekst-xl'];
const REGELS = ['regels-dicht', 'regels-ruim'];
const FOTOPLEK = ['foto-links', 'foto-rechts', 'foto-klein'];
const klasUit = (a, lijst) => String(a.class || '').split(/\s+/).find((x) => lijst.includes(x)) || '';
const klasAttr = (a, lijst) => { const k = klasUit(a, lijst); return k ? ` class="${k}"` : ''; };
// Alleen video's van YouTube (zonder cookies) en Vimeo.
const videoBron = (l) => {
  const v = String(l || '').trim();
  return /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{6,20}$/.test(v) || /^https:\/\/player\.vimeo\.com\/video\/\d{5,12}$/.test(v) ? v : '';
};
const ontsnap = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#39|nbsp);/gi, (_, e) => {
  const n = e.toLowerCase();
  if (n[0] === '#') { const c = n[1] === 'x' ? parseInt(n.slice(2), 16) : parseInt(n.slice(1), 10); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ''; }
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }[n];
});
function opgemaakt(html) {
  const t = String(html == null ? '' : html);
  if (!/^\s*</.test(t)) return alineas(t);
  const delen = /<!--[\s\S]*?(?:-->|$)|<(script|style|iframe|object|embed|template|noscript|svg|math|textarea|title)\b[\s\S]*?(?:<\/\1\s*>|$)|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|</g;
  const open = [];
  let uit = '';
  let m;
  while ((m = delen.exec(t))) {
    if (m[5] !== undefined) { uit += esc(ontsnap(m[5])); continue; }
    if (m[0] === '<') { uit += '&lt;'; continue; }
    if (m[1] && m[1].toLowerCase() === 'iframe') { // een video uit het beheerscherm
      const v = videoBron(ontsnap((m[0].match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i) || [])[1] || ''));
      if (v) uit += `<div class="video"><iframe src="${esc(v)}" title="Video" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
      continue;
    }
    if (!m[3]) continue; // commentaar of een verboden blok
    let tag = m[3].toLowerCase();
    if (tag === 'h1') tag = 'h2'; // één h1 per pagina: die is van de titel
    if (!(tag in OPMAAK)) continue;
    if (m[2]) { // sluit-tag: alleen als hij open staat
      const plek = open.lastIndexOf(tag);
      if (plek === -1) continue;
      while (open.length > plek) uit += `</${open.pop()}>`;
      continue;
    }
    const a = {};
    m[4].replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g, (_, n, x, y, z) => { a[n.toLowerCase()] = ontsnap(x != null ? x : y != null ? y : z); });
    if (tag === 'a') {
      uit += `<a href="${link(a.href)}"${extern(a.href)}${/(^|\s)knop(\s|$)/.test(a.class || '') ? ' class="knop"' : ''}>`;
    } else if (tag === 'img') {
      const bronFoto = String(a.src || '').trim();
      if (/^https:\/\//i.test(bronFoto)) uit += `<img src="${esc(bronFoto)}" alt="${esc(a.alt)}"${klasAttr(a, FOTOPLEK)} loading="lazy">`;
      else if (bronFoto && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(bronFoto)) uit += `<img src="${src(bronFoto)}" alt="${esc(a.alt)}"${klasAttr(a, FOTOPLEK)} loading="lazy">`;
      continue;
    } else if (tag === 'hr') {
      uit += /(^|\s)ruimte(\s|$)/.test(a.class || '') ? '<hr class="ruimte">' : '<hr>';
      continue;
    } else if (tag === 'span') {
      const klassen = String(a.class || '').split(/\s+/).filter((k) => /^[a-z][\w-]*$/i.test(k)).join(' ');
      uit += klassen ? `<span class="${klassen}">` : '<span>';
    } else if (tag === 'p' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const k = [klasUit(a, UITLIJNEN), tag === 'p' ? klasUit(a, GROOTTE) : '', klasUit(a, REGELS)].filter(Boolean);
      uit += `<${tag}${k.length ? ` class="${k.join(' ')}"` : ''}>`;
    } else {
      uit += `<${tag}>`;
    }
    if (OPMAAK[tag]) open.push(tag);
  }
  while (open.length) uit += `</${open.pop()}>`;
  return uit;
}
const extern = (l) => (/^https?:/i.test(l || '') ? ' target="_blank" rel="noopener"' : '');
// Alleen in het live voorbeeld: zeg welk vakje dit is, zodat klikken precies dat vakje opent.
// veld('secties.3.prijs') -> ' data-pcms-field="secties.3.prijs"'. Op de echte site: niets.
// Focuspunt van een foto ("35% 25%"): dat stukje blijft in beeld als de foto wordt bijgesneden.
const focus = (v) => (/^(100|\d{1,2})% (100|\d{1,2})%$/.test(String(v || '')) ? ` style="object-position:${v}"` : '');
const veld = (pad) => (bewerk ? ` data-pcms-field="${esc(pad)}"` : '');
// Onderdelen die uit een ander bestand komen (bijvoorbeeld algemeen.json).
const bron = (naam) => (bewerk ? ` data-pcms-entry="${esc(naam)}"` : '');

/* ---------- WhatsApp, bellen, sterren (voor de knoppen en blokken hieronder) ---------- */
// WhatsApp-nummer zoals de klant het typt: 06 12345678 -> 31612345678, +49 171 2345678 -> 491712345678.
const waNummer = (n) => {
  let d = String(n == null ? '' : n).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '31' + d.slice(1);
  return /^\d{8,15}$/.test(d) ? d : '';
};
const waLink = (tekst) => { const nr = waNummer(alg.whatsapp); return nr ? `https://wa.me/${nr}${leeg(tekst) ? '' : '?text=' + encodeURIComponent(String(tekst).trim())}` : ''; };
const belLink = (n) => { const d = String(n == null ? '' : n).replace(/[^\d+]/g, ''); return d.replace(/\D/g, '').length >= 8 ? 'tel:' + d : ''; };
// 4 -> ★★★★☆ (voor schermlezers: "4 van de 5 sterren")
const sterren = (n) => {
  const s = Math.max(0, Math.min(5, Math.round(Number(String(n == null ? '' : n).replace(',', '.')) || 0)));
  return s ? `<span class="sterren" role="img" aria-label="${s} van de 5 sterren">${'★'.repeat(s)}<span class="sterren-leeg">${'☆'.repeat(5 - s)}</span></span>` : '';
};
// Agenda's die op de pagina zelf mogen staan (blok "Afspraak maken"). Andere: alleen de knop.
const AGENDAS = /^(calendly\.com|cal\.com|app\.cal\.com|cal\.eu|calendar\.google\.com|calendar\.app\.google|tidycal\.com|zcal\.co|[\w-]+\.youcanbook\.me|[\w-]+\.simplybook\.(me|it|cc)|[\w-]+\.salonized\.com|widget\.salonized\.com)$/i;
const agendaBron = (l) => { try { const u = new URL(String(l || '').trim()); return u.protocol === 'https:' && AGENDAS.test(u.hostname) ? u.href : ''; } catch (e) { return ''; } };
const ICOON = {
  whatsapp: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.5-.3Z"/></svg>',
  bellen: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z"/></svg>',
};
const SOCIAAL = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['pinterest', 'Pinterest']];
const sociaal = alg.sociaal || {};
const socialeLinks = SOCIAAL.filter(([k]) => /^https:\/\/\S+$/i.test(String(sociaal[k] || '').trim()));

// Nieuwsbrief: hetzelfde adres als het contactformulier, maar dan .../nieuwsbrief.
const nieuwsbriefAdres = !opties.formulier ? '' : String(opties.formulier).charAt(0) === '#' ? opties.formulier : String(opties.formulier).replace(/\/[^/]*$/, '/nieuwsbrief');
let zoekTeller = 0;
const zoekvak = (hint) => `<form class="zoekvak" role="search" action="zoeken/" data-zoeken="zoeken.json">
      <label for="zoek-${++zoekTeller}" class="verborgen">Zoeken</label>
      <input id="zoek-${zoekTeller}" type="search" name="q" placeholder="${esc(leeg(hint) ? 'Waar ben je naar op zoek?' : hint)}" autocomplete="off">
      <button class="knop" type="submit">Zoeken</button>
      <ol class="zoek-uitslag" aria-live="polite"></ol>
    </form>`;

/* ---------- blokken van de homepage ---------- */
// Elk blok krijgt zijn gegevens (b) en het begin van zijn veldpad (p = 'secties.3').
const blokken = {
  bovenaan(b, p) {
    return `
  <section class="bovenaan">
    ${leeg(b.foto) ? '' : `<img src="${src(b.foto)}" alt="${esc(b.alt)}"${focus(b.focus)}${veld(p + '.foto')}>`}
    <h1${veld(p + '.kop')}>${esc(b.kop)}</h1>
    ${leeg(b.tekst) ? '' : `<p${veld(p + '.tekst')}>${esc(b.tekst)}</p>`}
    ${b.knop && !leeg(b.knop.tekst) ? `<a class="knop" href="${link(b.knop.link)}"${extern(b.knop.link)}${veld(p + '.knop.tekst')}>${esc(b.knop.tekst)}</a>` : ''}
  </section>`;
  },

  prijslijst(b, p) {
    return `
  <section class="prijslijst" id="prijzen">
    <h2${veld(p + '.kop')}>${esc(b.kop)}</h2>
    <ul>
      ${lijst(b.regels).map((r, n) => `<li><span${veld(`${p}.regels.${n}.naam`)}>${esc(r.naam)}</span> <strong${veld(`${p}.regels.${n}.prijs`)}>${esc(r.prijs)}</strong></li>`).join('\n      ')}
    </ul>
  </section>`;
  },

  openingstijden(b, p) {
    // De tijden zelf staan in algemeen.json, zodat ze ook in de footer en in Google staan.
    return `
  <section class="openingstijden" id="open">
    <h2${veld(p + '.kop')}>${esc(b.kop)}</h2>
    <p class="nu-open" data-open="${esc(JSON.stringify(lijst(alg.openingstijden).map((d) => [d.dag, d.tijden || ''])))}" hidden></p>
    <dl${bron('algemeen')}>
      ${lijst(alg.openingstijden).map((d, n) => `<div><dt>${esc(d.dag)}</dt><dd${veld(`openingstijden.${n}.tijden`)}>${esc(leeg(d.tijden) ? 'Gesloten' : d.tijden)}</dd></div>`).join('\n      ')}
    </dl>
  </section>`;
  },

  nieuws(b, p) {
    const items = lijst(content.nieuws).filter((x) => !x.verbergen).slice(0, 3);
    return `
  <section class="nieuws" id="nieuws">
    <h2${veld(p + '.kop')}>${esc(b.kop)}</h2>
    ${items.map((x) => `<a class="kaart" href="nieuws/${esc(x._bestand)}/"><h3>${esc(x.titel)}</h3></a>`).join('\n    ')}
  </section>`;
  },

  /* Standaardblokken: op de homepage én op elke losse pagina te gebruiken. Geef ze de stijl van het ontwerp. */
  // Tekst met opmaak, met een kop erboven.
  tekst(b, p) {
    return `
  <section class="blok-tekst">
    ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
    <div class="tekst"${veld(p + '.tekst')}>${opgemaakt(b.tekst)}</div>
  </section>`;
  },

  // Tekst met een foto ernaast (links of rechts), eventueel met een knop.
  tekstfoto(b, p) {
    return `
  <section class="tekstfoto${b.fotoplek === 'rechts' ? ' foto-rechts-kant' : ''}">
    ${leeg(b.foto) ? '' : `<img src="${src(b.foto)}" alt="${esc(b.alt)}"${focus(b.focus)} loading="lazy"${veld(p + '.foto')}>`}
    <div>
      ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
      <div class="tekst"${veld(p + '.tekst')}>${opgemaakt(b.tekst)}</div>
      ${b.knop && !leeg(b.knop.tekst) ? `<a class="knop" href="${link(b.knop.link)}"${extern(b.knop.link)}${veld(p + '.knop.tekst')}>${esc(b.knop.tekst)}</a>` : ''}
    </div>
  </section>`;
  },

  // Eén grote foto met een onderschrift.
  grotefoto(b, p) {
    if (leeg(b.foto)) return '';
    return `
  <section class="grotefoto">
    <figure><img src="${src(b.foto)}" alt="${esc(b.alt)}"${focus(b.focus)} loading="lazy"${veld(p + '.foto')}>${leeg(b.onderschrift) ? '' : `<figcaption${veld(p + '.onderschrift')}>${esc(b.onderschrift)}</figcaption>`}</figure>
  </section>`;
  },

  // Een citaat of een reactie van een klant.
  citaat(b, p) {
    if (leeg(b.tekst)) return '';
    return `
  <section class="citaat">
    <figure><blockquote${veld(p + '.tekst')}>${esc(b.tekst)}</blockquote>${leeg(b.naam) ? '' : `<figcaption${veld(p + '.naam')}>${esc(b.naam)}</figcaption>`}</figure>
  </section>`;
  },

  // Een opvallend vlak met kop, korte tekst en knop.
  oproep(b, p) {
    return `
  <section class="oproep">
    ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
    ${leeg(b.tekst) ? '' : `<p${veld(p + '.tekst')}>${esc(b.tekst)}</p>`}
    ${b.knop && !leeg(b.knop.tekst) ? `<a class="knop" href="${link(b.knop.link)}"${extern(b.knop.link)}${veld(p + '.knop.tekst')}>${esc(b.knop.tekst)}</a>` : ''}
  </section>`;
  },

  // Kaartjes naast elkaar; een kaartje met een link is in zijn geheel klikbaar.
  kaartjes(b, p) {
    return `
  <section class="kaartjes">
    ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
    <div class="kaartjes-rij">
      ${lijst(b.items).map((k, n) => {
        const binnen = `${leeg(k.foto) ? '' : `<img src="${src(k.foto)}" alt="${esc(k.alt)}"${focus(k.focus)} loading="lazy"${veld(`${p}.items.${n}.foto`)}>`}${leeg(k.kop) ? '' : `<h3${veld(`${p}.items.${n}.kop`)}>${esc(k.kop)}</h3>`}${leeg(k.tekst) ? '' : `<p${veld(`${p}.items.${n}.tekst`)}>${esc(k.tekst)}</p>`}`;
        return leeg(k.link) ? `<div class="kaartje">${binnen}</div>` : `<a class="kaartje" href="${link(k.link)}"${extern(k.link)}>${binnen}</a>`;
      }).join('\n      ')}
    </div>
  </section>`;
  },

  // Contactformulier. Berichten komen in het beheerscherm bij "Berichten" en de klant krijgt een mail.
  // De klant kiest zelf de vragen; zonder vragen: Naam, E-mail en Bericht.
  formulier(b, p) {
    const vragen = lijst(b.velden).filter((x) => !leeg(x.label));
    const velden = vragen.length ? vragen : [
      { label: 'Naam', soort: 'kort', verplicht: true },
      { label: 'E-mail', soort: 'email', verplicht: true },
      { label: 'Bericht', soort: 'lang' },
    ];
    const invoer = velden.map((x, n) => {
      const id = `f-${p.replace(/\W/g, '-')}-${n}`;
      const naam = esc(String(x.label).trim().slice(0, 60));
      const nodig = x.verplicht ? ' required' : '';
      const sterretje = x.verplicht ? ' <span aria-hidden="true">*</span>' : '';
      const lab = `<label for="${id}"${veld(`${p}.velden.${n}.label`)}>${esc(x.label)}${sterretje}</label>`;
      if (x.soort === 'lang') return `<div class="veld heel">${lab}<textarea id="${id}" name="${naam}" rows="5"${nodig}></textarea></div>`;
      if (x.soort === 'keuze') {
        const keuzes = String(x.keuzes || '').split(',').map((k) => k.trim()).filter(Boolean);
        return `<div class="veld">${lab}<select id="${id}" name="${naam}"${nodig}><option value="">Maak een keuze</option>${keuzes.map((k) => `<option>${esc(k)}</option>`).join('')}</select></div>`;
      }
      const type = { email: 'email', telefoon: 'tel', datum: 'date' }[x.soort] || 'text';
      const auto = { email: ' autocomplete="email"', telefoon: ' autocomplete="tel"' }[x.soort] || (/naam/i.test(x.label) ? ' autocomplete="name"' : '');
      return `<div class="veld">${lab}<input id="${id}" name="${naam}" type="${type}"${auto}${nodig}></div>`;
    }).join('\n      ');
    const actie = opties.formulier ? ` action="${esc(opties.formulier)}" method="post" data-verstuur` : '';
    return `
  <section class="formulier" id="${leeg(b.anker) ? 'contact' : esc(b.anker)}">
    ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
    ${leeg(b.tekst) ? '' : `<p${veld(p + '.tekst')}>${esc(b.tekst)}</p>`}
    <form${actie}>
      <div class="hp" aria-hidden="true"><label>Website<input name="_gotcha" tabindex="-1" autocomplete="off"></label></div>
      ${invoer}
      <button class="knop" type="submit"${veld(p + '.knoptekst')}>${esc(leeg(b.knoptekst) ? 'Versturen' : b.knoptekst)}</button>
      <p class="formulier-fout" role="alert" hidden></p>
      <p class="formulier-bedankt" role="status" hidden${veld(p + '.bedankt')}>${esc(leeg(b.bedankt) ? 'Bedankt! Je bericht is verstuurd. We reageren zo snel mogelijk.' : b.bedankt)}</p>
    </form>
  </section>`;
  },

  // Kaart en route. Het adres staat bij Algemene gegevens. De kaart van Google laadt pas als de
  // bezoeker op "Kaart tonen" tikt: zo zet Google geen cookies en is er geen cookiebanner nodig.
  kaart(b, p) {
    const adres = String(alg.adres || '').trim();
    if (!adres) return '';
    const q = encodeURIComponent(adres);
    return `
  <section class="kaart" id="${leeg(b.anker) ? 'route' : esc(b.anker)}">
    ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
    ${leeg(b.tekst) ? '' : `<p${veld(p + '.tekst')}>${esc(b.tekst)}</p>`}
    <p class="kaart-adres"${bron('algemeen')}><span${veld('adres')}>${esc(adres)}</span></p>
    <div class="kaart-vak" data-laad="${esc(`https://www.google.com/maps?q=${q}&output=embed`)}" data-titel="Kaart">
      <button type="button" class="knop">Kaart tonen</button>
      <p class="klein">De kaart komt van Google Maps.</p>
    </div>
    <a class="knop" href="${esc(`https://www.google.com/maps/dir/?api=1&destination=${q}`)}" target="_blank" rel="noopener">Route plannen</a>
  </section>`;
  },

  // Producten met een bestelknop. De knop gaat naar een betaallink (Mollie, Stripe, SumUp, Tikkie),
  // of, zonder betaallink, naar WhatsApp met een bericht dat al klaarstaat. Geen hele webshop nodig.
  producten(b, p) {
    return `
  <section class="producten" id="${leeg(b.anker) ? 'bestellen' : esc(b.anker)}">
    ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
    ${leeg(b.tekst) ? '' : `<p${veld(p + '.tekst')}>${esc(b.tekst)}</p>`}
    <div class="producten-rij">
      ${lijst(b.items).map((x, n) => {
        if (leeg(x.naam) && leeg(x.foto)) return '';
        const q = `${p}.items.${n}`;
        const wa = waLink(`Hallo! Ik wil graag bestellen: ${String(x.naam || '').trim()}`);
        const knop = x.uitverkocht
          ? '<span class="uitverkocht">Uitverkocht</span>'
          : !leeg(x.link)
            ? `<a class="knop" href="${link(x.link)}"${extern(link(x.link))}>${esc(leeg(b.knoptekst) ? 'Bestellen' : b.knoptekst)}</a>`
            : wa ? `<a class="knop" href="${esc(wa)}" target="_blank" rel="noopener">Bestel via WhatsApp</a>` : '';
        return `<div class="product">${leeg(x.foto) ? '' : `<img src="${src(x.foto)}" alt="${esc(x.alt)}"${focus(x.focus)} loading="lazy"${veld(q + '.foto')}>`}
        <h3${veld(q + '.naam')}>${esc(x.naam)}</h3>
        ${leeg(x.tekst) ? '' : `<p${veld(q + '.tekst')}>${esc(x.tekst)}</p>`}
        ${leeg(x.prijs) ? '' : `<p class="prijs"${veld(q + '.prijs')}>${esc(x.prijs)}</p>`}
        ${knop}</div>`;
      }).filter(Boolean).join('\n      ')}
    </div>
  </section>`;
  },

  // Afspraak maken: een knop naar de online agenda (Calendly, Cal.com, Salonized, Google Agenda...),
  // of de agenda zelf op de pagina. Die laadt pas na een tik, net als de kaart.
  afspraak(b, p) {
    const adres = String(b.link || '').trim();
    const agenda = b.tonen === 'agenda' ? agendaBron(adres) : '';
    const knop = leeg(adres) ? '' : `<a class="knop" href="${link(adres)}"${extern(link(adres))}${veld(p + '.knoptekst')}>${esc(leeg(b.knoptekst) ? 'Afspraak maken' : b.knoptekst)}</a>`;
    return `
  <section class="afspraak" id="${leeg(b.anker) ? 'afspraak' : esc(b.anker)}">
    ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
    ${leeg(b.tekst) ? '' : `<p${veld(p + '.tekst')}>${esc(b.tekst)}</p>`}
    ${agenda ? `<div class="agenda-vak" data-laad="${esc(agenda)}" data-titel="Agenda">
      <button type="button" class="knop">${esc(leeg(b.knoptekst) ? 'Kies een tijd' : b.knoptekst)}</button>
      <p class="klein">De agenda komt van ${esc(new URL(agenda).hostname.replace(/^www\./, ''))}.</p>
    </div>` : knop}
  </section>`;
  },

  // Reviews: het cijfer, sterren en reacties van klanten, met knoppen naar Google.
  reviews(b, p) {
    const items = lijst(b.items).filter((r) => !leeg(r.tekst));
    const knoppen = [
      !leeg(b.alle) ? `<a class="knop" href="${link(b.alle)}"${extern(link(b.alle))}>Alle reviews bekijken</a>` : '',
      !leeg(b.schrijf) ? `<a class="knop knop-licht" href="${link(b.schrijf)}"${extern(link(b.schrijf))}>Schrijf een review</a>` : '',
    ].filter(Boolean).join(' ');
    return `
  <section class="reviews">
    ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
    ${leeg(b.cijfer) ? '' : `<p class="reviews-cijfer"><strong${veld(p + '.cijfer')}>${esc(b.cijfer)}</strong> ${sterren(b.cijfer)} ${leeg(b.aantal) ? '' : `<span${veld(p + '.aantal')}>${esc(b.aantal)}</span>`}</p>`}
    ${items.length ? `<div class="reviews-rij">
      ${lijst(b.items).map((r, n) => (leeg(r.tekst) ? '' : `<figure class="review">${sterren(r.sterren || 5)}<blockquote${veld(`${p}.items.${n}.tekst`)}>${esc(r.tekst)}</blockquote>${leeg(r.naam) ? '' : `<figcaption${veld(`${p}.items.${n}.naam`)}>${esc(r.naam)}</figcaption>`}</figure>`)).filter(Boolean).join('\n      ')}
    </div>` : ''}
    ${knoppen ? `<p class="reviews-knoppen">${knoppen}</p>` : ''}
  </section>`;
  },

  // Aanmelden voor de nieuwsbrief. De adressen komen in het beheerscherm (Berichten > Nieuwsbrief),
  // met een knop om de lijst te downloaden voor MailerLite, Brevo of Mailchimp.
  nieuwsbrief(b, p) {
    const actie = nieuwsbriefAdres ? ` action="${esc(nieuwsbriefAdres)}" method="post" data-verstuur` : '';
    const id = `n-${p.replace(/\W/g, '-')}`;
    return `
  <section class="nieuwsbrief" id="${leeg(b.anker) ? 'nieuwsbrief' : esc(b.anker)}">
    ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
    ${leeg(b.tekst) ? '' : `<p${veld(p + '.tekst')}>${esc(b.tekst)}</p>`}
    <form${actie}>
      <div class="hp" aria-hidden="true"><label>Website<input name="_gotcha" tabindex="-1" autocomplete="off"></label></div>
      ${b.naam ? `<div class="veld"><label for="${id}-naam">Naam</label><input id="${id}-naam" name="Naam" autocomplete="name"></div>` : ''}
      <div class="veld"><label for="${id}-mail">E-mailadres</label><input id="${id}-mail" name="E-mail" type="email" autocomplete="email" required></div>
      <button class="knop" type="submit"${veld(p + '.knoptekst')}>${esc(leeg(b.knoptekst) ? 'Aanmelden' : b.knoptekst)}</button>
      <p class="klein">Je krijgt alleen mail van ${esc(alg.naam || 'ons')}. Afmelden kan altijd.</p>
      <p class="formulier-fout" role="alert" hidden></p>
      <p class="formulier-bedankt" role="status" hidden${veld(p + '.bedankt')}>${esc(leeg(b.bedankt) ? 'Gelukt! Je staat op de lijst.' : b.bedankt)}</p>
    </form>
  </section>`;
  },

  // Zoeken op de site. build.js maakt zoeken.json met de tekst van alle pagina's; src/script.js zoekt daarin.
  zoeken(b, p) {
    return `
  <section class="zoeken" id="zoeken">
    ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
    ${zoekvak(b.hint)}
  </section>`;
  },

  // Veelgestelde vragen: klik op een vraag om het antwoord te zien.
  vragen(b, p) {
    return `
  <section class="vragen">
    ${leeg(b.kop) ? '' : `<h2${veld(p + '.kop')}>${esc(b.kop)}</h2>`}
    ${lijst(b.items).map((q, n) => (leeg(q.vraag) ? '' : `<details><summary${veld(`${p}.items.${n}.vraag`)}>${esc(q.vraag)}</summary><div class="tekst"${veld(`${p}.items.${n}.antwoord`)}>${opgemaakt(q.antwoord)}</div></details>`)).filter(Boolean).join('\n    ')}
  </section>`;
  },
};

// De HTML van een lijst blokken (de homepage, of de blokken van een losse pagina).
// De plek van elk blok in de lijst telt verborgen blokken mee, anders klopt het veldpad niet.
const maakSecties = (bron) => lijst(bron).map((b, i) => {
  if (!b || b.verbergen || !blokken[b.type]) return '';
  const html = blokken[b.type](b, `secties.${i}`);
  return bewerk ? html.replace('<section', `<section data-pcms-path="secties.${i}"`) : html;
}).join('\n');
const inhoud = maakSecties(home.secties);

/* ---------- losse pagina's (de klant maakt ze zelf aan) ---------- */
const losse = lijst(content.paginas).filter((x) => x && !x.verbergen && !leeg(x._bestand));
const menu = losse.filter((x) => x.menu);

/* ---------- Google en delen (SEO) ---------- */
// Het echte adres van de site (Algemene gegevens > Adres van de website, of SITE_URL bij de build).
// Zonder adres: geen canonical en geen sitemap, de rest werkt gewoon.
const basisUrl = (() => {
  const ruw = String(alg.website || opties.siteUrl || '').trim();
  if (!/^https?:\/\/[^\s/]+/i.test(ruw)) return '';
  return ruw.replace(/\/+$/, '') + '/';
})();
const volledig = (pad) => (basisUrl ? basisUrl + String(pad || '').replace(/^\/+/, '') : '');
const korter = (tekst, max) => { const t = String(tekst || '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t; };
const zonderHtml = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
// meta = { seo, pad, omschrijving, foto }: de klant vult bij elke pagina "Google en delen" in;
// wat leeg is, vullen we met iets zinnigs uit de pagina zelf.
const ogTags = (titel, meta) => {
  const m = meta || {};
  const seo = m.seo || {};
  const omschrijving = korter(seo.omschrijving || m.omschrijving || alg.omschrijving, 160);
  const foto = seo.foto || m.foto || (alg.seo && alg.seo.foto) || '';
  const fotoUrl = foto ? (basisUrl ? volledig(foto) : String(foto)) : '';
  const url = m.pad != null ? volledig(String(m.pad).replace(/index\.html$/, '')) : '';
  return [
    omschrijving ? `<meta name="description" content="${esc(omschrijving)}">` : '',
    url ? `<link rel="canonical" href="${esc(url)}">` : '',
    `<meta property="og:type" content="${m.soort || 'website'}">`,
    `<meta property="og:site_name" content="${esc(alg.naam)}">`,
    `<meta property="og:locale" content="nl_NL">`,
    `<meta property="og:title" content="${esc(titel)}">`,
    omschrijving ? `<meta property="og:description" content="${esc(omschrijving)}">` : '',
    url ? `<meta property="og:url" content="${esc(url)}">` : '',
    fotoUrl ? `<meta property="og:image" content="${esc(fotoUrl)}">` : '',
    `<meta name="twitter:card" content="${fotoUrl ? 'summary_large_image' : 'summary'}">`,
  ].filter(Boolean).join('\n');
};
// Bedrijfsgegevens voor Google (naam, adres, telefoon, openingstijden) op de homepage.
const DAGEN = { maandag: 'Mo', dinsdag: 'Tu', woensdag: 'We', donderdag: 'Th', vrijdag: 'Fr', zaterdag: 'Sa', zondag: 'Su' };
const bedrijfsgegevens = () => {
  const uren = lijst(alg.openingstijden).map((d) => {
    const dag = DAGEN[String(d.dag || '').trim().toLowerCase()];
    const tijd = String(d.tijden || '').match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);
    return dag && tijd ? `${dag} ${tijd[1].padStart(2, '0')}:${tijd[2]}-${tijd[3].padStart(2, '0')}:${tijd[4]}` : '';
  }).filter(Boolean);
  const data = {
    '@context': 'https://schema.org',
    '@type': alg.soortbedrijf || 'LocalBusiness',
    name: alg.naam || undefined,
    description: alg.omschrijving || undefined,
    url: basisUrl || undefined,
    telephone: alg.telefoon || undefined,
    email: alg.email || undefined,
    address: alg.adres || undefined,
    image: (alg.seo && alg.seo.foto) ? volledig(alg.seo.foto) || undefined : undefined,
    openingHours: uren.length ? uren : undefined,
    sameAs: socialeLinks.length ? socialeLinks.map(([k]) => String(sociaal[k]).trim()) : undefined,
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
};

/* ---------- op elke pagina: mededeling, zwevende knop, sociale media ---------- */
// Mededeling bovenaan (Algemene gegevens > Mededeling bovenaan de site). De eerste die nu online staat
// komt erop; met Inplannen gaat hij vanzelf online en offline (bijvoorbeeld "Kerst: 24 december tot 14:00").
const mededeling = (() => {
  const alle = lijst(alg.mededelingen);
  const n = alle.findIndex((m) => m && !m.verbergen && !leeg(m.tekst));
  if (n === -1) return '';
  const m = alle[n];
  return `<div class="mededeling"${bron('algemeen')}><p><span${veld(`mededelingen.${n}.tekst`)}>${esc(m.tekst)}</span>${leeg(m.link) ? '' : ` <a href="${link(m.link)}"${extern(link(m.link))}${veld(`mededelingen.${n}.linktekst`)}>${esc(leeg(m.linktekst) ? 'Lees meer' : m.linktekst)}</a>`}</p></div>\n`;
})();
// Zwevende knop rechtsonder: WhatsApp en/of bellen (Algemene gegevens > Knop rechtsonder).
const snelknop = (() => {
  const keuze = alg.snelknop || 'whatsapp';
  const wa = keuze === 'whatsapp' || keuze === 'beide' ? waLink(leeg(alg.whatsapptekst) ? 'Hallo! Ik heb een vraag.' : alg.whatsapptekst) : '';
  const bel = keuze === 'bellen' || keuze === 'beide' ? belLink(alg.telefoon) : '';
  if (!wa && !bel) return '';
  return `<div class="snelknoppen"${bron('algemeen')}>${bel ? `<a class="snelknop snelknop-bellen" href="${esc(bel)}" aria-label="Bel ons">${ICOON.bellen}<span>Bellen</span></a>` : ''}${wa ? `<a class="snelknop snelknop-whatsapp" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="Stuur ons een WhatsApp-bericht">${ICOON.whatsapp}<span>WhatsApp</span></a>` : ''}</div>\n`;
})();
const sociaalHtml = socialeLinks.length
  ? `<p class="sociaal">${socialeLinks.map(([k, naam]) => `<a href="${esc(String(sociaal[k]).trim())}" target="_blank" rel="noopener"${veld('sociaal.' + k)}>${naam}</a>`).join('')}</p>`
  : '';

/* ---------- pagina-omlijsting ---------- */
// Bezoekersteller (zonder cookies): alleen op de echte site, niet in het live voorbeeld of op de 404.
const teller = (meta) => (!bewerk && opties.teller && !(meta && meta.noindex) ? ` data-teller="${esc(opties.teller)}"` : '');
const pagina = (titel, main, diepte, meta) => `<!DOCTYPE html>
<html lang="nl"${teller(meta)}>
<head>
<meta charset="utf-8">
${opties.basis ? `<base href="${esc(opties.basis)}">\n` : meta && meta.basis ? `<base href="${esc(meta.basis)}">\n` : diepte ? `<base href="${'../'.repeat(diepte)}">\n` : ''}${opties.kop || ''}<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)}</title>
${ogTags(titel, meta)}${meta && meta.bedrijf ? '\n' + bedrijfsgegevens() : ''}${meta && meta.noindex ? '\n<meta name="robots" content="noindex">' : ''}
<style>
${opties.css || ''}</style>
</head>
<body>
${mededeling}<header><a href="./" class="logo"${bron('algemeen')}${veld('naam')}>${esc(alg.naam)}</a>${menu.length || alg.zoekknop ? `
<nav class="menu">${menu.map((x) => `<a href="${esc(paginaPad(x))}">${esc(x.titel)}</a>`).join('')}${alg.zoekknop ? '<a href="zoeken/" class="menu-zoeken">Zoeken</a>' : ''}</nav>` : ''}</header>
<main>
${main}
</main>
<footer${bron('algemeen')}><p${veld('adres')}>${esc(alg.adres)}</p>${sociaalHtml}</footer>
${snelknop}
<script>
${opties.js || ''}</script>
</body>
</html>
`;

/* ---------- alle pagina's ---------- */
// bron = het bestand waar de pagina uit komt ('home' of 'nieuws/eerste-bericht'),
// zodat het live voorbeeld weet welke pagina het moet laten zien.
// Titel in Google: wat de klant bij "Google en delen" invulde, anders de paginatitel met de bedrijfsnaam.
const seoTitel = (x, standaard) => (x && x.seo && !leeg(x.seo.titel) ? String(x.seo.titel).trim() : standaard);
const paginas = [{ pad: 'index.html', bron: 'home', html: pagina(seoTitel(home, alg.naam), inhoud, 0, { seo: home.seo, pad: '', bedrijf: true }) }];
for (const x of lijst(content.nieuws)) {
  if (x.verbergen) continue;
  paginas.push({
    pad: `nieuws/${x._bestand}/index.html`,
    bron: `nieuws/${x._bestand}`,
    // Op een eigen pagina is het veldpad gewoon de veldnaam (het bestand ís het item).
    html: pagina(seoTitel(x, `${x.titel} | ${alg.naam}`), `
  <article>
    <h1${veld('titel')}>${esc(x.titel)}</h1>
    ${leeg(x.foto) ? '' : `<img src="${src(x.foto)}" alt=""${focus(x.focus)}${veld('foto')}>`}
    <div class="tekst"${veld('tekst')}>${opgemaakt(x.tekst)}</div>
  </article>`, 2, { seo: x.seo, pad: `nieuws/${x._bestand}/`, omschrijving: zonderHtml(x.tekst), foto: x.foto, soort: 'article' }),
  });
}
for (const x of losse) {
  paginas.push({
    pad: `${paginaPad(x)}index.html`,
    bron: `paginas/${x._bestand}`,
    html: pagina(seoTitel(x, `${x.titel} | ${alg.naam}`), `
  <article class="pagina">
    <h1${veld('titel')}>${esc(x.titel)}</h1>
    ${leeg(x.foto) ? '' : `<img src="${src(x.foto)}" alt="${esc(x.alt)}"${focus(x.focus)}${veld('foto')}>`}
    <div class="tekst"${veld('tekst')}>${opgemaakt(x.tekst)}</div>
  </article>
${maakSecties(x.secties)}`, 1, { seo: x.seo, pad: paginaPad(x), omschrijving: zonderHtml(x.tekst), foto: x.foto }),
  });
}

// Zoekpagina voor de knop "Zoeken" in het menu (Algemene gegevens > Zoekknop in het menu).
if (alg.zoekknop) {
  paginas.push({
    pad: 'zoeken/index.html',
    bron: null,
    html: pagina(`Zoeken | ${alg.naam}`, `
  <article class="pagina">
    <h1>Zoeken</h1>
    ${zoekvak('')}
  </article>`, 1, { pad: 'zoeken/', noindex: true }),
  });
}

// Pagina die bezoekers zien bij een adres dat niet (meer) bestaat. Cloudflare Pages toont 404.html vanzelf.
if (!bewerk) {
  paginas.push({
    pad: '404.html',
    bron: null,
    html: pagina(`Pagina niet gevonden | ${alg.naam}`, `
  <article class="pagina niet-gevonden">
    <h1>Deze pagina bestaat niet (meer)</h1>
    <p>Misschien is hij verplaatst. Op de <a href="./">homepage</a> vind je alles terug.</p>
  </article>`, 0, { noindex: true, pad: null, basis: '/' }),
  });
}

return { paginas, basisUrl };
}

if (typeof module !== 'undefined' && module.exports) module.exports = render;
else wereld.renderSite = render;
})(typeof window !== 'undefined' ? window : globalThis);
