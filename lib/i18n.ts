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
