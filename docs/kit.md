# Webstudio kit: vaste bestanden voor alle klantsites

De bestanden die op elke klantsite hetzelfde zijn, staan hier in `public/kit/v1/`. Het beheerscherm serveert ze op `https://<beheerscherm>/kit/v1/<bestand>`. Elke klantsite haalt ze vóór elke bouw op (`tools/kit.js`, `"build": "node tools/kit.js && node build.js"`). Een verbetering hier geldt dus bij de volgende bouw voor alle sites, zonder per site een PR.

| Bestand | Op de site | Wat |
|---|---|---|
| `build.js` | `build.js` | Bouwt de site uit content/ (alleen sites op het startpakket) |
| `preview.html` | `src/preview.html` | Live voorbeeld in het beheerscherm (praat met `lib/preview-edit.ts` en de entry-pagina) |
| `inplannen.js` | `src/inplannen.js` | Online vanaf / offline na |
| `teksttest.js` | `tools/teksttest.js` | Test: teksten van elke lengte |
| `kit.js` | `tools/kit.js` | Het ophalen zelf |

Welke bestanden een site ophaalt, staat in de package.json van de site onder `"webstudioKit"`. Een site met een eigen versie van een bestand (Kreativ mit Blumen heeft een eigen `build.js` en `preview.html`) laat dat bestand uit die lijst.

## Regels

- **Alleen achterwaarts verenigbaar in v1.** Een site die vandaag werkt, moet na een wijziging hier nog steeds werken, met zijn eigen `render.js`, `.pages.yml` en content. Moet er iets breken, maak dan `public/kit/v2/` en zet sites één voor één over (`VERSIE` in kit.js).
- **Pas het startpakket mee aan** (`/mnt/project-files/webstudio/startpakket` en de zip), zodat een nieuwe site met dezelfde versie begint.
- Lukt het ophalen niet (beheerscherm plat, fout bestand), dan bouwt de site met de kopie in zijn eigen repo. Een kapot JS-bestand wordt niet overgenomen (syntaxcontrole), net als een preview.html zonder `</html>` of zonder `renderSite`.
- Een site kan het tijdelijk uitzetten met `KIT=uit` in Cloudflare Pages.
- Lokaal de kopie in een site bijwerken: `node tools/kit.js` (of `npm run kit`) en committen.
