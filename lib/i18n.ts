/**
 * Interface language.
 *
 * Strings stay in English in the code (so upstream Pages CMS changes keep merging
 * cleanly) and are looked up here. Set NEXT_PUBLIC_UI_LANGUAGE=en for English.
 * The default for this version is Dutch.
 *
 * Use `t("Save")`, or `t("Remove {name}?", { name })` with placeholders.
 */

type Dictionary = Record<string, string>;

const nl: Dictionary = {
  // Saving
  "Save": "Opslaan",
  "Saving your file": "Bezig met opslaan...",
  "Saving...": "Bezig met opslaan...",
  "Saved": "Opgeslagen",
  "Saved. Your website updates in about a minute.": "Opgeslagen. Over ongeveer een minuut staat het op je website.",
  "Failed to save file.": "Opslaan is niet gelukt. Probeer het nog een keer.",
  "Please fix the errors before saving.": "Er klopt nog iets niet. Kijk bij de rode velden.",
  "Unsaved changes": "Nog niet opgeslagen",
  "You have unsaved changes. Leave anyway?": "Je hebt iets veranderd maar nog niet opgeslagen. Toch weggaan?",

  // Editor
  "Edit": "Bewerken",
  "Editing \"{name}\"": "\"{name}\" bewerken",
  "Content": "Inhoud",
  "Filename": "Bestandsnaam",
  "Lock filename": "Bestandsnaam vastzetten",
  "Unlock filename": "Bestandsnaam aanpassen",
  "Unlock to edit": "Klik om aan te passen",
  "Required": "Verplicht",
  "Readonly": "Vast",
  "History": "Eerdere versies",
  "Item": "Onderdeel",
  "Item #{number}": "Onderdeel {number}",
  "Add": "Toevoegen",
  "Add an item": "Toevoegen",
  "Add {label}": "{label} toevoegen",
  "Add block": "Blok toevoegen",
  "Remove": "Verwijderen",
  "Remove item": "Verwijderen",
  "Remove this item?": "Dit onderdeel verwijderen?",
  "Remove block": "Blok verwijderen",
  "Remove this block?": "Dit blok verwijderen?",
  "This action cannot be undone.": "Na het opslaan is het van je site verdwenen.",
  "Cancel": "Annuleren",
  "Collapse all": "Alles dichtklappen",
  "Expand all": "Alles openklappen",
  "Move up": "Omhoog",
  "Move down": "Omlaag",
  "Drag to reorder": "Sleep om te verplaatsen",

  // Live preview
  "Live preview": "Live voorbeeld",
  "Connected": "Verbonden",
  "Loading": "Laden",
  "As on a computer": "Zoals op een computer",
  "As on a phone": "Zoals op een telefoon",
  "Computer": "Computer",
  "Phone": "Telefoon",
  "Reload": "Opnieuw laden",
  "Open in a new tab": "Openen in nieuw tabblad",
  "Live preview of the website": "Live voorbeeld van de website",
  "Show preview": "Bekijk voorbeeld",
  "Back to editing": "Terug naar bewerken",

  // Errors and empty states
  "Something went wrong": "Er ging iets mis",
  "File not found": "Niet gevonden",
  "Configuration not found": "Instellingen niet gevonden",
  "Create file": "Aanmaken",
  "Create configuration file": "Instellingenbestand aanmaken",
  "Creating entries is disabled": "Toevoegen staat uit",
  "New entries are not allowed for this collection.": "Hier kun je niets nieuws toevoegen.",
  "Back to collection": "Terug naar het overzicht",
  "Go to configuration": "Naar de instellingen",

  // Media
  "Media": "Foto's",
  "Upload": "Uploaden",
  "Upload file": "Bestand uploaden",
  "Upload image": "Foto uploaden",
  "Uploading": "Bezig met uploaden...",
  "Uploading files": "Bezig met uploaden...",
  "Select": "Kiezen",
  "Select image": "Foto kiezen",
  "Select file": "Bestand kiezen",
  "Select images": "Foto's kiezen",
  "Insert": "Kiezen",
  "Remove image": "Foto weghalen",
  "Change image": "Andere foto",
  "No images": "Nog geen foto's",
  "No files": "Nog geen bestanden",
  "Delete": "Verwijderen",
  "Rename": "Naam wijzigen",
  "Download": "Downloaden",

  // Collections
  "Add an entry": "Nieuw toevoegen",
  "Add entry": "Nieuw toevoegen",
  "Search": "Zoeken",
  "No entries": "Nog niets toegevoegd",

  // Navigation and account
  "Sign out": "Uitloggen",
  "Settings": "Instellingen",
  "Configuration": "Instellingen (technisch)",
  "Collaborators": "Klanten en medewerkers",
  "Actions": "Acties",
  "Cache": "Cache",

  // Sign in
  "Sign in": "Inloggen",
  "Sign in with email": "Inloggen met e-mail",
  "Email": "E-mailadres",
  "Send sign-in code": "Stuur mij een inlogcode",
  "Enter the code we sent to your email": "Vul de code in die we je hebben gemailt",
  "Verify": "Inloggen",
  // Fields and media (more)
  "View on GitHub": "Bekijken op GitHub",
  "View image on GitHub": "Foto bekijken op GitHub",
  "Check your settings": "Vraag je websitebouwer om dit na te kijken",
  "Drop files here to upload": "Laat de foto hier los om hem te uploaden",
  "Upload failed": "Uploaden is niet gelukt",
  "Theme": "Weergave",
  "Light": "Licht",
  "Dark": "Donker",
  "System": "Zoals mijn apparaat",
  "Manage branches": "Versies beheren",
  "All projects": "Al mijn websites",
  "Recently visited": "Laatst bekeken",
  "Branches": "Versies",

  // Sign in and invitations (more)
  "Verify code": "Inloggen",
  "Verify your login": "Vul je inlogcode in",
  "Enter the 6-digit code sent to {email}.": "We hebben een code van 6 cijfers gestuurd naar {email}.",
  "Resend code": "Stuur een nieuwe code",
  "Sign in another way": "Op een andere manier inloggen",
  "Unable to send sign-in code.": "De inlogcode kon niet worden verstuurd. Probeer het nog een keer.",
  "Enter the 6-digit code.": "Vul de code van 6 cijfers in.",
  "Unable to claim this invitation.": "Deze uitnodiging kon niet worden geopend.",
  "Unable to verify code.": "Deze code klopt niet. Probeer het nog een keer.",
  "Invite unavailable": "Uitnodiging werkt niet meer",
  "This invitation is no longer available.": "Deze uitnodiging is verlopen of al gebruikt. Vraag je websitebouwer om een nieuwe.",
  "This invitation link is invalid.": "Deze link klopt niet. Vraag je websitebouwer om een nieuwe uitnodiging.",
  "Wrong account": "Verkeerd account",
  "This invitation was sent to another account.": "Deze uitnodiging is naar een ander e-mailadres gestuurd.",
  "Go home": "Naar het begin",
  "Invalid email": "Dit e-mailadres klopt niet",
  "We sent you a sign-in code.": "We hebben je een inlogcode gemaild.",
  "Continue with email": "Inloggen met e-mail",
  "Sign in with GitHub": "Inloggen met GitHub (voor websitebouwers)",
  "Sign in to Pages CMS": "Inloggen",
  "Terms of Service": "Voorwaarden",
  "Privacy Policy": "Privacy",
  "Connecting to GitHub...": "Verbinden met GitHub...",
  "Continue": "Doorgaan",
  "Website editor": "Beheerscherm",
  "GitHub is connected": "GitHub is gekoppeld",
  "Choose which websites this editor may change, then sign in.": "Kies op GitHub welke websites dit beheerscherm mag aanpassen. Log daarna in.",
  "Choose websites on GitHub": "Websites kiezen op GitHub",
  "Set up your editor": "Beheerscherm instellen",
  "One last step: connect GitHub. GitHub creates the connection for you, you don't need to copy any keys.": "Nog één stap: GitHub koppelen. GitHub maakt de koppeling zelf aan, je hoeft geen sleutels over te typen.",
  "Secret key": "Geheime sleutel",
  "The value of BETTER_AUTH_SECRET. This proves you are the one who installed this editor.": "De waarde van BETTER_AUTH_SECRET. Daarmee bewijs je dat jij dit beheerscherm hebt geïnstalleerd.",
  "Name of the connection": "Naam van de koppeling",
  "Must be unique on GitHub. Your clients don't see it.": "Moet uniek zijn op GitHub. Je klanten zien deze naam niet.",
  "GitHub organization (optional)": "GitHub organisatie (mag leeg)",
  "Leave empty if the websites are on your own GitHub account.": "Laat leeg als de websites op je eigen GitHub account staan.",
  "Connect GitHub": "Koppel GitHub",
  "That secret key is not right. Copy BETTER_AUTH_SECRET exactly as you entered it in your hosting settings.": "Die geheime sleutel klopt niet. Kopieer BETTER_AUTH_SECRET precies zoals je hem bij Cloudflare hebt ingevuld.",
  "Fill in a name.": "Vul een naam in.",
  "That organization name is not right. Use the part after github.com/, or leave it empty.": "Die organisatienaam klopt niet. Gebruik het stuk na github.com/, of laat het leeg.",
  "This took too long. Start again.": "Dit duurde te lang. Begin opnieuw.",
  "GitHub did not finish creating the app. Start again.": "GitHub heeft de koppeling niet afgemaakt. Begin opnieuw.",
  "This editor is not connected to GitHub yet.": "Dit beheerscherm is nog niet gekoppeld aan GitHub.",
  "Set up now": "Nu instellen",
  "Sign in to {name}": "Inloggen bij {name}",
  "About {name}": "Over {name}",
  "Questions about your website? Contact {name}.": "Vragen over je website? Neem contact op met {name}.",
  "By continuing, you agree to:": "Door verder te gaan, ga je akkoord met:",
  "This email was sent to {email}.": "Deze mail is verstuurd naar {email}.",
  "Didn't try to sign in? Then you can ignore this email.": "Probeerde je niet in te loggen? Dan kun je deze mail negeren.",
  "Type this code on the sign-in page:": "Typ deze code op de inlogpagina:",
  "The code works for 5 minutes.": "De code werkt 5 minuten.",
  "{person} invited you to edit your website.": "{person} nodigt je uit om je website aan te passen.",
  "You can now edit your website": "Je kunt nu je website aanpassen",
  "Not expecting this? Then you can ignore this email.": "Verwachtte je deze mail niet? Dan kun je hem negeren.",
  "{person} invited you to edit the website \"{site}\". You don't need an account or a password.": "{person} heeft je uitgenodigd om de website \"{site}\" aan te passen. Je hebt geen account of wachtwoord nodig.",
  "Start editing": "Beginnen met aanpassen",
  "Button not working? Copy this link into your browser:": "Werkt de knop niet? Kopieer dan deze link in je browser:",
  "You can now edit \"{site}\".": "Je kunt nu \"{site}\" aanpassen.",
  "You can now edit \"{site}\"": "Je kunt nu \"{site}\" aanpassen",
  "{person} gave you access to the website \"{site}\". You don't need to do anything else.": "{person} heeft je toegang gegeven tot de website \"{site}\". Je hoeft verder niets te doen.",
  "Open my website": "Mijn website openen",
  "You can now edit your website \"{site}\"": "Je kunt nu je website \"{site}\" aanpassen",
  "Your sign-in code for {name}: {otp}": "Je inlogcode voor {name}: {otp}",
  "Website builder? Sign in with GitHub": "Websitebouwer? Inloggen met GitHub",
  "or": "of",
  "Fill in your email address. We will email you a code.": "Vul je e-mailadres in. Je krijgt dan een code per mail.",
};

const dictionaries: Record<string, Dictionary> = { nl };

const language = (process.env.NEXT_PUBLIC_UI_LANGUAGE || "nl").toLowerCase();
const dictionary: Dictionary | undefined = dictionaries[language];

export const uiLanguage = dictionary ? language : "en";

export function t(text: string, values?: Record<string, string | number>): string {
  let result = dictionary?.[text] ?? text;
  if (values) {
    for (const [key, value] of Object.entries(values)) {
      result = result.split(`{${key}}`).join(String(value));
    }
  }
  return result;
}
