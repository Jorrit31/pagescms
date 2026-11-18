# Live voorbeeld

Naast het invulscherm toont het beheerscherm de website zoals hij eruit gaat zien. Elke letter die de klant typt, staat meteen in het voorbeeld. Er wordt niets opgeslagen tot de klant op Opslaan drukt.

Dit werkt voor elke site, zolang de site een voorbeeldpagina heeft die het onderstaande berichtje begrijpt.

## 1. Zet het voorbeeld aan in `.pages.yml`

Zet `preview` bij elk onderdeel dat een voorbeeld moet krijgen:

```yaml
content:
  - name: home
    label: Startpagina
    type: file
    path: content/home.json
    preview: https://mijnklant.pages.dev/preview
```

Of met een eigen knoptekst:

```yaml
    preview:
      url: https://mijnklant.pages.dev/preview
      label: Voorbeeld startpagina
```

Alleen adressen met `https://` (of `http://localhost` tijdens het testen) worden geaccepteerd.

## 2. Wat het beheerscherm stuurt

De voorbeeldpagina wordt in een iframe geladen. Het beheerscherm en de pagina praten met `window.postMessage`.

| Van | Naar | Bericht |
|---|---|---|
| Voorbeeldpagina | Beheerscherm | `{ type: "pagescms:ready" }` zodra de pagina klaar is |
| Beheerscherm | Voorbeeldpagina | `{ type: "pagescms:hello" }` als het beheerscherm later klaar is. Antwoord dan opnieuw met `ready`. |
| Beheerscherm | Voorbeeldpagina | `{ type: "pagescms:preview", version: 1, entry, data, media }` bij elke wijziging |
| Voorbeeldpagina | Beheerscherm | `{ type: "pagescms:select", field?, path?, entry?, text?, image? }` als de klant iets in het voorbeeld aanklikt |
| Voorbeeldpagina | Beheerscherm | `pagescms:edit` en `pagescms:block` bij direct bewerken (zie 5) |

Inhoud van het `preview` bericht:

- `entry`: `{ name, path }` van het onderdeel, bijvoorbeeld `{ name: "home", path: "content/home.json" }`.
- `data`: de inhoud precies zoals hij in het bestand komt na opslaan. Bij een lijst (`list: true`) is dat `{ list: [...] }`.
- `media`: `[{ name, input, output, rawBase }]`. Een foto die net is geüpload staat nog niet op de site. Is een foto niet te laden, gebruik dan `rawBase + input + pad`, dat is het bestand op GitHub.

## 3. Wat de site moet doen

Een minimale voorbeeldpagina:

```html
<!doctype html>
<meta charset="utf-8">
<div id="site"></div>
<script>
  const CMS = ['https://cms.jouwdomein.nl'];
  function teken(data) {
    // Bouw hier de pagina met dezelfde code als de echte site.
    document.getElementById('site').innerHTML = '<h1>' + (data.titel || '') + '</h1>';
  }
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || !CMS.includes(e.origin)) return;
    if (e.data?.type === 'pagescms:hello') parent.postMessage({ type: 'pagescms:ready' }, e.origin);
    if (e.data?.type === 'pagescms:preview') teken(e.data.data);
  });
  parent.postMessage({ type: 'pagescms:ready' }, '*');
</script>
```

De beste aanpak is dat de site zijn HTML met één functie bouwt die zowel in de bouwstap als in de browser draait. Zo ziet het voorbeeld er altijd precies hetzelfde uit als de echte site. Kreativ mit Blumen doet dit met `src/render.js` en `src/preview.html`; kopieer die als startpunt.

## 4. Klikken om aan te passen

Klikt de klant in het voorbeeld op een tekst of foto, dan opent het beheerscherm het juiste veld, scrollt ernaartoe en zet de cursor erin. Op de telefoon gaat het voorbeeld dicht en springt het scherm naar het veld.

De voorbeeldpagina stuurt daarvoor `pagescms:select` met:

- `field` (mag weg, maar is het beste): het precieze veld, bijvoorbeeld `secties.3.kaarten.1.prijs`. Zet daarvoor `data-pcms-field="secties.3.kaarten.1.prijs"` op die tekst of foto in de HTML van het voorbeeld. Het beheerscherm opent dan precies dat veld, ook als dezelfde tekst vaker voorkomt (zeven keer "17:30" bij openingstijden, tien keer dezelfde prijs). Bij een tekst in twee talen mag je de taal erachter zetten (`secties.0.kop.de`); zonder taal opent de eerste. Vindt het beheerscherm het veld niet, dan zoekt het met `text` en `image` zoals hieronder.
- `text`: de tekst van wat is aangeklikt. Het beheerscherm zoekt het veld met dezelfde inhoud.
- `image`: het pad van een aangeklikte foto. Het beheerscherm zoekt het fotoveld met dezelfde bestandsnaam.
- `path` (mag weg): het blok, bijvoorbeeld `secties.3`. Zet daarvoor `data-pcms-path="secties.3"` op het blok in de HTML van het voorbeeld. Dan zoekt het beheerscherm eerst in dat blok, wat helpt als dezelfde tekst vaker voorkomt.
- `entry` (mag weg): het onderdeel waar het bij hoort, bijvoorbeeld `instellingen`. Zet daarvoor `data-pcms-entry="instellingen"` op bijvoorbeeld het menu en de onderkant. Klikt de klant daarop terwijl ze een ander onderdeel bewerkt, dan zegt het beheerscherm waar ze het wel kan aanpassen.

Zet deze attributen alleen in het voorbeeld, niet op de echte site. Kreativ mit Blumen doet dat met de optie `bewerk: true` in `src/render.js`.

## 5. Direct bewerken in het voorbeeld

De klant kan ook direct in het voorbeeld typen, en blokken toevoegen, verplaatsen, kopiëren en weghalen. Het beheerscherm blijft de enige plek waar de waarden staan: het voorbeeld zegt alleen wat er veranderde, en Opslaan werkt zoals altijd.

Bij elk `pagescms:preview` bericht stuurt het beheerscherm `edit` mee (zie `lib/preview-edit.ts`):

- `texts`: `{ "secties.0.kop": { kind: "line", value }, "secties.2.tekst": { kind: "rich", leaves } }`. `line` is één regel (`type: string`), `lines` een langere tekst (`type: text`), `rich` een opgemaakte tekst (`type: rich-text` met `format: html`). Bij `rich` staan in `leaves` de stukjes tekst van elke alinea, kop of lijstregel.
- `items`: elk blok of item van een lijst, `{ "secties.3": { label, list: "secties", index: 3 } }`.
- `lists`: `{ "secties": { count, canAdd, canRemove, blocks, label } }`, met `min` en `max` van de lijst verwerkt.

Alleen velden die niet `readonly` of `hidden` zijn, staan erin.

Een blok met `once: true` in `.pages.yml` (zoals een hero) mag maar één keer in de lijst staan. Het heeft dan geen kopieerknop, en zolang het er is, staat het niet bij de blokken die je kunt toevoegen, ook niet in het formulier zelf.

De voorbeeldpagina stuurt terug:

| Bericht | Wat het beheerscherm doet |
|---|---|
| `{ type: "pagescms:edit", field, value }` | Zet de tekst in dat veld. |
| `{ type: "pagescms:edit", field, leaf, texts }` | Zet nieuwe woorden in alinea `leaf` van een opgemaakte tekst. Het aantal stukjes moet gelijk blijven, dus vet, links en de rest blijven staan. |
| `{ type: "pagescms:block", action: "move", path, to }` | Zet het blok op de plek van `to`. |
| `{ type: "pagescms:block", action: "copy" \| "remove", path }` | Kopieert het blok eronder, of haalt het weg (met "Ongedaan maken"). |
| `{ type: "pagescms:block", action: "add", path }` | Vraagt welk blok, en zet een nieuw leeg blok onder `path`. Daarna opent het in het formulier om in te vullen. |
| `{ type: "pagescms:select", inline: true, field }` | Op een breed scherm licht het veld op, zonder de cursor uit het voorbeeld te halen. |

Het beheerscherm stuurt ook `{ type: "pagescms:view", scale }`: hoe klein het voorbeeld op het scherm staat, zodat de knoppen in het voorbeeld een gewone maat houden.

Lijsten binnen een blok (kaarten, prijsregels) staan ook in `items` en `lists`. De vaste `src/preview.html` vindt het element van zo'n item zelf aan de `data-pcms-field` paden erin, dus de site hoeft daar niets extra's voor te markeren.

Het startpakket en Kreativ mit Blumen doen dit allemaal in de vaste `src/preview.html`. Die maakt alleen teksten bewerkbaar die precies de waarde van het veld tonen, maakt van plakken platte tekst en laat geen eigen opmaak toe. Zo kan de klant het ontwerp niet kapotmaken.

## 6. Laat de pagina in een iframe toe

Standaard weigeren veel hosts dat hun pagina in een iframe op een ander domein staat. Voor Cloudflare Pages zet je in `_headers`:

```
/preview
  ! X-Frame-Options
  Content-Security-Policy: frame-ancestors 'self' https://cms.jouwdomein.nl
  X-Robots-Tag: noindex
```

`X-Robots-Tag: noindex` houdt de voorbeeldpagina uit Google.
