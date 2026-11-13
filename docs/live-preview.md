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

## 4. Laat de pagina in een iframe toe

Standaard weigeren veel hosts dat hun pagina in een iframe op een ander domein staat. Voor Cloudflare Pages zet je in `_headers`:

```
/preview
  ! X-Frame-Options
  Content-Security-Policy: frame-ancestors 'self' https://cms.jouwdomein.nl
  X-Robots-Tag: noindex
```

`X-Robots-Tag: noindex` houdt de voorbeeldpagina uit Google.
