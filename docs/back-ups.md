# Back-ups van de database

Elke nacht om 03:30 (Nederlandse wintertijd) zet het beheerscherm een kopie van de database in **Cloudflare R2**. De kopieën blijven 30 dagen bewaard. R2 is gratis tot 10 GB, en een back-up is een paar honderd kB.

**Wat er in zit:** klanten en wat ze mogen, uitnodigingen, formulierberichten, nieuwsbriefadressen, bezoekerscijfers, het logboek, de instellingen per site en de (versleutelde) GitHub-koppeling.
**Wat er niet in zit:** inlogsessies en inlogcodes (die zijn geheim en verlopen toch) en caches (die bouwt het beheerscherm zelf opnieuw op). De teksten en foto's van de sites staan in GitHub, met hun volledige geschiedenis.

## Eenmalig aanzetten (± 10 minuten)

1. **Bucket maken.** dash.cloudflare.com, links **R2 Object Storage**. Zet R2 aan als dat nog niet zo is (gratis abonnement, er wordt om een betaalmethode gevraagd maar onder 10 GB kost het niets). Klik **Create bucket**, naam `beheerscherm-backups`, locatie **Automatic** (of EU), **Create bucket**.
2. **Sleutel maken.** Op de R2-overzichtspagina rechts **API** > **Manage API tokens** > **Create API token**.
   - Naam: `beheerscherm back-up`
   - Permissions: **Object Read & Write**
   - Specify bucket: alleen `beheerscherm-backups`
   - **Create API Token**. Je ziet nu een **Access Key ID** en een **Secret Access Key**. Kopieer ze meteen (de geheime sleutel zie je maar één keer) en zet ze ook in je wachtwoordbeheerder.
3. **Account ID.** Staat op de R2-overzichtspagina rechts ("Account ID").
4. **In de Worker zetten.** **Workers & Pages** > `beheerscherm` > **Settings** > **Variables and Secrets** > **Add**. Kies bij type **Secret** en voeg toe:
   - `BACKUP_R2_ACCOUNT_ID` = je Account ID
   - `BACKUP_R2_BUCKET` = `beheerscherm-backups`
   - `BACKUP_R2_ACCESS_KEY_ID` = de Access Key ID
   - `BACKUP_R2_SECRET_ACCESS_KEY` = de Secret Access Key
   Klik **Deploy**.

De volgende nacht staat de eerste back-up in de bucket, in de map `backups/`, als `cms-JAAR-MAAND-DAG.json.gz`.

**Controleren:** in de Worker onder **Observability** > **Logs** zoek je op "Back-up". Daar staat per nacht hoeveel rijen per tabel erin zitten, of de fout als het misging.

## Terugzetten

Laat dit liefst samen met Claude doen. Zo gaat het:

1. Download de back-up uit R2 (bucket openen, bestand aanklikken, **Download**).
2. Gaat het om een nieuwe, lege database? Maak eerst de tabellen: `DATABASE_URL=... npx drizzle-kit migrate`
3. Zet hem terug:
   ```sh
   DATABASE_URL="postgres://..." node scripts/restore-backup.mjs cms-2026-11-24.json.gz
   ```
   Alleen bijvoorbeeld de formulierberichten terugzetten:
   ```sh
   DATABASE_URL="postgres://..." node scripts/restore-backup.mjs cms-2026-11-24.json.gz --only form_submission
   ```
   Het terugzetten gaat in één keer: lukt iets niet, dan verandert er niets.
4. Iedereen logt daarna opnieuw in met een code.

Let op: de GitHub-koppeling in de back-up is versleuteld met `CRYPTO_KEY`. Zet je hem terug in een nieuw beheerscherm, gebruik dan dezelfde `CRYPTO_KEY`, of koppel GitHub daar opnieuw via /setup.
