// Imagicruise – Arten von Reisen, Tagen und Ereignissen (Studio und Reisebericht, Browser und Node).
// Hier stehen nur Namen und Zeichen. Neue Art: hier eintragen, mehr ist nicht nötig.
(function (wurzel) {
  "use strict";

  var REISEARTEN = [
    { id: "kreuzfahrt", name: "Kreuzfahrt" },
    { id: "rundreise", name: "Rundreise" },
    { id: "staedtereise", name: "Städtereise" },
    { id: "strand", name: "Strandurlaub" },
    { id: "aktiv", name: "Wander- oder Aktivreise" },
    { id: "andere", name: "Andere Reise" }
  ];

  var TAGESARTEN = [
    { id: "normal", name: "Reisetag", zeichen: "☀" },
    { id: "anreise", name: "Anreise", zeichen: "🧳" },
    { id: "hafen", name: "Hafentag", zeichen: "⚓" },
    { id: "see", name: "Seetag", zeichen: "🌊" },
    { id: "ausflug", name: "Ausflug", zeichen: "🚌" },
    { id: "ruhe", name: "Ruhetag", zeichen: "🏖" },
    { id: "abreise", name: "Abreise", zeichen: "🏠" }
  ];

  var EREIGNISARTEN = [
    { id: "sehenswuerdigkeit", name: "Sehenswürdigkeit", zeichen: "🏛" },
    { id: "veranstaltung", name: "Veranstaltung", zeichen: "🎭" },
    { id: "ausflug", name: "Ausflug", zeichen: "🚌" },
    { id: "natur", name: "Natur", zeichen: "🌿" },
    { id: "essen", name: "Essen & Trinken", zeichen: "🍽" },
    { id: "fahrt", name: "Fahrt", zeichen: "🚢" },
    { id: "unterkunft", name: "Unterkunft", zeichen: "🛏" },
    { id: "einkauf", name: "Einkaufen", zeichen: "🛍" },
    { id: "begegnung", name: "Begegnung", zeichen: "🤝" },
    { id: "sonstiges", name: "Sonstiges", zeichen: "📍" }
  ];

  // Verkehrsmittel für die Strecke zu einem Ort (Feld `anreise` an Tag oder Ereignis, seit 20.11.2026).
  // linie: wie die Strecke auf der Karte aussieht (Klasse ik-l-…); bogen: als Bogen statt gerade gezeichnet.
  // Das Bild für die Karte steht in karte.js (BILDER), das Zeichen hier nur für Listen im Studio.
  var VERKEHRSMITTEL = [
    { id: "schiff", name: "Schiff", zeichen: "🚢", linie: "wasser" },
    { id: "faehre", name: "Fähre", zeichen: "⛴", linie: "wasser" },
    { id: "flugzeug", name: "Flugzeug", zeichen: "✈", linie: "luft", bogen: true },
    { id: "bahn", name: "Bahn", zeichen: "🚆", linie: "schiene" },
    { id: "bus", name: "Bus", zeichen: "🚌", linie: "strasse" },
    { id: "auto", name: "Auto", zeichen: "🚗", linie: "strasse" },
    { id: "wohnmobil", name: "Wohnmobil", zeichen: "🚐", linie: "strasse" },
    { id: "motorrad", name: "Motorrad", zeichen: "🏍", linie: "strasse" },
    { id: "fahrrad", name: "Fahrrad", zeichen: "🚲", linie: "rad" },
    { id: "zufuss", name: "zu Fuß", zeichen: "🚶", linie: "fuss" },
    { id: "seilbahn", name: "Seilbahn", zeichen: "🚡", linie: "seil" }
  ];

  function finden(liste, id, ersatz) {
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return ersatz == null ? null : finden(liste, ersatz);
  }

  var api = {
    REISEARTEN: REISEARTEN, TAGESARTEN: TAGESARTEN, EREIGNISARTEN: EREIGNISARTEN, VERKEHRSMITTEL: VERKEHRSMITTEL,
    verkehrsmittel: function (id) { return finden(VERKEHRSMITTEL, id); },   // null, wenn unbekannt
    reiseart: function (id) { return finden(REISEARTEN, id, "andere"); },
    tagesart: function (id) { return finden(TAGESARTEN, id, "normal"); },
    ereignisart: function (id) { return finden(EREIGNISARTEN, id, "sonstiges"); }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  wurzel.ImagicruiseArten = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
