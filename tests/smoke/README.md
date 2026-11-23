# Rooktest

Test die bij elke pull request op GitHub draait (`.github/workflows/smoke.yml`).
Hij doet wat een klant elke dag doet, en wordt rood als dat stuk is:

1. Startscherm opent, zonder de woorden GitHub of Pages CMS
2. Tekst aanpassen en opslaan komt echt in het bestand
3. Een foto die nog op de site staat geeft een waarschuwing bij verwijderen
4. Een losse foto verwijderen werkt
5. Telefoon: startscherm met de dagelijkse klussen, past op het scherm
6. Telefoon: bewerken met de balk Bewerken / Voorbeeld / Opslaan
7. De bezoekersteller van de websites antwoordt
8. Geen JavaScript-fouten in de pagina's

Daarnaast controleert de workflow dat **elke tabel Row Level Security aan heeft**
(anders leest de Supabase-API hem uit), en dat TypeScript en de bouw slagen.

## Hoe het werkt

- `github-mock.cjs` vervangt GitHub: alles wat het beheerscherm aan api.github.com
  vraagt, wordt beantwoord uit een kopie van `site/` (een klein startpakket).
  Opslaan schrijft in die kopie, zodat de test het bestand kan nakijken.
- `seed.mjs` zet een ingelogde klant in een lege database en geeft de cookie.
- `smoke.cjs` loopt de stappen door met Playwright (computer en iPhone-formaat).

## Zelf draaien

Met een lokale Postgres:

```sh
export DATABASE_URL=postgres://cms:cms@localhost/smoke BETTER_AUTH_SECRET=lang-geheim-van-minstens-32-tekens
export CRYPTO_KEY=$(openssl rand -base64 32) BASE_URL=http://localhost:3000
export GITHUB_APP_ID=1 GITHUB_APP_CLIENT_ID=x GITHUB_APP_PRIVATE_KEY="$(openssl genrsa 2048 2>/dev/null)"
export SMOKE_SITE_DIR=/tmp/smoke-site SMOKE_COOKIE_FILE=/tmp/smoke-cookie
npx drizzle-kit migrate && npx next build
rm -rf $SMOKE_SITE_DIR && cp -r tests/smoke/site $SMOKE_SITE_DIR && node tests/smoke/seed.mjs > $SMOKE_COOKIE_FILE
NODE_OPTIONS="--require ./tests/smoke/github-mock.cjs" npx next start &
node tests/smoke/smoke.cjs
```

Nieuwe functie die klanten elke dag gebruiken? Voeg er een stap voor toe in `smoke.cjs`.
