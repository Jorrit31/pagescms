// Inplannen: een blok, onderdeel of pagina met een veld "planning" staat alleen op de site
// tussen "Online vanaf" en "Offline na". NIET AANPASSEN per klant.
//   .pages.yml:  - { name: planning, label: Inplannen, type: planning }
//   content:     "planning": { "vanaf": "2026-12-05T09:00+01:00", "tot": "2026-12-26T23:59+01:00" }
// build.js laat weg wat op dat moment niet online is; het beheerscherm bouwt de site
// vanzelf opnieuw op elk ingepland tijdstip. Het live voorbeeld toont alles, met een label.
// Tijden zonder +01:00 (met de hand getypt) gelden als Nederlandse tijd.
(function (wereld) {
  'use strict';
  var ZONE = 'Europe/Amsterdam';

  function isPlanning(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    var k = Object.keys(v);
    return k.length > 0 && k.every(function (x) { return (x === 'vanaf' || x === 'tot') && (v[x] == null || typeof v[x] === 'string'); });
  }

  function verschil(datum) {
    var d = {};
    new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(datum).forEach(function (p) { d[p.type] = Number(p.value); });
    return Date.UTC(d.year, d.month - 1, d.day, d.hour, d.minute) - Math.floor(datum.getTime() / 60000) * 60000;
  }

  // '2026-12-05T09:00+01:00' -> dat moment. '2026-12-05' -> begin van de dag (bij "Offline na": eind van de dag).
  function tijd(waarde, eind) {
    if (typeof waarde !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(waarde.trim());
    if (!m) return null;
    if (m[7]) { var t = Date.parse(waarde.trim().replace(' ', 'T')); return isNaN(t) ? null : new Date(t); }
    var gok = Date.UTC(+m[1], +m[2] - 1, +m[3] + (m[4] === undefined && eind ? 1 : 0), +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    var uit = gok - verschil(new Date(gok));
    var beter = gok - verschil(new Date(uit));
    return new Date(beter);
  }

  // 'altijd' | 'wacht' | 'online' | 'voorbij'
  function stand(planning, nu) {
    if (!isPlanning(planning)) return { stand: 'altijd' };
    var van = tijd(planning.vanaf), tot = tijd(planning.tot, true);
    var n = (nu || new Date()).getTime();
    if (!van && !tot) return { stand: 'altijd' };
    if (tot && n >= tot.getTime()) return { stand: 'voorbij', van: van, tot: tot };
    if (van && n < van.getTime()) return { stand: 'wacht', van: van, tot: tot };
    return { stand: 'online', van: van, tot: tot };
  }

  function nietOnline(item, nu) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    return Object.keys(item).some(function (k) { var s = stand(item[k], nu).stand; return s === 'wacht' || s === 'voorbij'; });
  }

  // Kopie van de content zonder wat nu niet online hoort. Losse bestanden (home, een pagina) krijgen verbergen: true.
  function filter(content, nu) {
    function loop(v, diepte) {
      if (!v || typeof v !== 'object' || diepte > 30) return v;
      if (Array.isArray(v)) return v.filter(function (x) { return !nietOnline(x, nu); }).map(function (x) { return loop(x, diepte + 1); });
      var uit = {};
      Object.keys(v).forEach(function (k) { uit[k] = loop(v[k], diepte + 1); });
      return uit;
    }
    var uit = {};
    Object.keys(content || {}).forEach(function (k) {
      var v = loop(content[k], 0);
      if (!Array.isArray(v) && nietOnline(content[k], nu)) v = Object.assign({}, v, { verbergen: true });
      uit[k] = v;
    });
    return uit;
  }

  // Alle plekken met een planning: [{ pad: 'secties.2', planning: {...} }] ('' = het bestand zelf).
  function plekken(data) {
    var uit = [];
    (function loop(v, pad, diepte) {
      if (!v || typeof v !== 'object' || diepte > 30) return;
      Object.keys(v).forEach(function (k) {
        if (isPlanning(v[k])) uit.push({ pad: pad, planning: v[k] });
        else loop(v[k], pad ? pad + '.' + k : k, diepte + 1);
      });
    })(data, '', 0);
    return uit;
  }

  function mooi(d) {
    var nu = new Date();
    return d.toLocaleString('nl-NL', { timeZone: ZONE, weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() !== nu.getFullYear() ? 'numeric' : undefined, hour: '2-digit', minute: '2-digit' });
  }

  // Tekst voor het label in het voorbeeld, of '' als het gewoon online staat.
  function label(planning, nu) {
    var s = stand(planning, nu);
    if (s.stand === 'wacht') return 'Nog niet online · vanaf ' + mooi(s.van) + (s.tot ? ' tot ' + mooi(s.tot) : '');
    if (s.stand === 'voorbij') return 'Offline sinds ' + mooi(s.tot);
    if (s.stand === 'online' && s.tot) return 'Online tot ' + mooi(s.tot);
    return '';
  }

  // Volgende tijdstippen waarop de site verandert (alleen voor de melding in de build).
  function momenten(content, nu) {
    var n = (nu || new Date()).getTime(), uit = [];
    Object.keys(content || {}).forEach(function (k) {
      plekken({ x: content[k] }).forEach(function (p) {
        [tijd(p.planning.vanaf), tijd(p.planning.tot, true)].forEach(function (t) { if (t && t.getTime() > n) uit.push(t); });
      });
    });
    return uit.sort(function (a, b) { return a - b; });
  }

  var api = { tijd: tijd, stand: stand, filter: filter, plekken: plekken, label: label, momenten: momenten, mooi: mooi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else wereld.inplannen = api;
})(typeof window !== 'undefined' ? window : this);
