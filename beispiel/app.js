// Imagicruise – Reisebericht (Abspieler). Zeigt eine Reise Tag für Tag: Titelseite mit Karte und Übersicht,
// je Tag eine Seite mit Zeitstrahl der Ereignisse und Fotos.
//
// Daten: In der veröffentlichten Seite liegt reise.js daneben (window.IMAGICRUISE_REISE), die Fotos unter medien/.
// In der Vorschau des Studios läuft diese Seite in einem eingebetteten Rahmen; Reise und Fotos kommen dann vom
// Studio (window.parent.ImagicruiseVorschau). Adressen: #/ = Titelseite, #/tag/3 = dritter Tag.
(function () {
  "use strict";
  var Arten = window.ImagicruiseArten, Karte = window.ImagicruiseKarte;
  var WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  var MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  var app = document.getElementById("app"), reise = null, vorschau = null, lupeListe = [], lupeNr = 0;

  // ---------- kleine Helfer ----------
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  // Text mit Leerzeilen → Absätze, einfache Zeilenwechsel bleiben
  function absaetze(text) {
    return String(text || "").trim().split(/\n\s*\n/).filter(Boolean).map(function (a) { return "<p>" + esc(a.trim()).replace(/\n/g, "<br>") + "</p>"; }).join("");
  }
  function teile(d) { return { t: +d.slice(8, 10), m: +d.slice(5, 7), j: d.slice(0, 4), w: new Date(d + "T00:00:00Z").getUTCDay() }; }
  function datumLang(d) { var x = teile(d); return WOCHENTAGE[x.w] + ", " + x.t + ". " + MONATE[x.m - 1] + " " + x.j; }
  function datumKurz(d) { var x = teile(d); return WOCHENTAGE[x.w].slice(0, 2) + " " + x.t + "." + x.m + "."; }
  function zeitraum(von, bis) {
    if (!von) return "";
    var a = teile(von), b = teile(bis || von);
    if (von === bis || !bis) return a.t + ". " + MONATE[a.m - 1] + " " + a.j;
    if (a.j !== b.j) return a.t + ". " + MONATE[a.m - 1] + " " + a.j + " – " + b.t + ". " + MONATE[b.m - 1] + " " + b.j;
    if (a.m !== b.m) return a.t + ". " + MONATE[a.m - 1] + " – " + b.t + ". " + MONATE[b.m - 1] + " " + b.j;
    return a.t + ". – " + b.t + ". " + MONATE[b.m - 1] + " " + b.j;
  }
  function hatOrt(o) { return !!o && typeof o.lat === "number" && typeof o.lon === "number"; }
  function tagHatInhalt(t) { return !!(t.titel || t.text || (t.ort && t.ort.name) || t.ereignisse.length); }
  function tagTitel(t, i) { return t.titel || (t.ort && t.ort.name) || Arten.tagesart(t.art).name || "Tag " + (i + 1); }
  function erstesFoto(t) {
    for (var i = 0; i < t.ereignisse.length; i++) if (t.ereignisse[i].fotos.length) return t.ereignisse[i].fotos[0];
    return null;
  }
  function bild(foto, klasse, lazy) {
    return '<img data-datei="' + esc(foto.datei) + '" alt="' + esc(foto.text || "") + '"' + (klasse ? ' class="' + klasse + '"' : "") +
      (foto.breite && foto.hoehe ? ' width="' + foto.breite + '" height="' + foto.hoehe + '"' : "") + (lazy === false ? "" : ' loading="lazy"') + ' src="data:,">';
  }
  // Adressen der Fotos einsetzen: veröffentlicht direkt aus medien/, in der Vorschau vom Studio (Blob-Adressen)
  function bilderLaden(wurzel) {
    Array.prototype.forEach.call((wurzel || document).querySelectorAll("img[data-datei]"), function (im) {
      var datei = im.dataset.datei;
      im.removeAttribute("data-datei");
      if (!vorschau) { im.src = "medien/" + datei; return; }
      Promise.resolve(vorschau.medienUrl(datei)).then(function (u) { if (u) im.src = u; });
    });
  }

  // Stationen wie im Studio (studio/modell.js, stationen): Tagesorte und Ereignisorte in Reihenfolge der Reise
  function stationen() {
    var liste = [];
    reise.tage.forEach(function (t, ti) {
      var p = [];
      if (hatOrt(t.ort)) p.push({ lat: t.ort.lat, lon: t.ort.lon, name: t.ort.name || t.titel, tag: ti, anreise: t.anreise || "" });
      t.ereignisse.forEach(function (e) { if (hatOrt(e.ort)) p.push({ lat: e.ort.lat, lon: e.ort.lon, name: e.ort.name || e.titel, tag: ti, anreise: e.anreise || "" }); });
      p.forEach(function (q) {
        var l = liste[liste.length - 1];
        if (l && Math.abs(l.lat - q.lat) < 0.0005 && Math.abs(l.lon - q.lon) < 0.0005) { if (!l.name && q.name) l.name = q.name; return; }
        liste.push(q);
      });
    });
    return liste;
  }
  // Auf der Übersichtskarte je Tag nur eine Marke (die erste Station des Tages), sonst wird es bei vielen Ereignissen voll
  function tagesStationen() {
    var gesehen = {};
    return stationen().filter(function (s) { if (gesehen[s.tag]) return false; gesehen[s.tag] = true; return true; })
      .map(function (s) { var t = reise.tage[s.tag]; return { lat: s.lat, lon: s.lon, tag: s.tag, name: (t.ort && t.ort.name) || s.name, anreise: s.anreise }; });
  }

  // ---------- Bausteine ----------
  function kopf() {
    return '<header class="kopf"><div class="breite">' +
      '<a class="kopf-titel" href="#/">' + esc(reise.titel || "Reisebericht") + "</a>" +
      '<button type="button" class="knopf-rund" id="modus-knopf" aria-label="Hell oder dunkel">' +
      '<svg class="sonne" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
      '<svg class="mond" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.500z"/></svg>' +
      "</button></div>" + tagesleiste() + "</header>";
  }
  function tagesleiste(aktiv) {
    if (!reise.tage.length) return "";
    return '<nav class="tagesleiste" id="tagesleiste" aria-label="Tage der Reise">' + reise.tage.map(function (t, i) {
      return '<a href="#/tag/' + (i + 1) + '"' + (tagHatInhalt(t) ? "" : ' class="leer"') + ' data-tag="' + i + '"><b>' + (i + 1) + "</b>" + esc(datumKurz(t.datum)) +
        (t.ort && t.ort.name ? " · " + esc(t.ort.name) : "") + "</a>";
    }).join("") + "</nav>";
  }
  function fuss() {
    return '<footer class="fuss"><div class="breite"><span>' + esc(reise.titel) + (reise.reisende ? " · " + esc(reise.reisende) : "") + "</span>" +
      "<span>Erstellt mit Imagicruise" + (reise.stand ? " · Stand " + esc(reise.stand.slice(8, 10) + "." + reise.stand.slice(5, 7) + "." + reise.stand.slice(0, 4)) : "") + "</span></div></footer>";
  }
  // Die Karte wird in der Größe gezeichnet, in der sie etwa erscheint – sonst wären die Ortsnamen auf dem Handy winzig.
  // wo: "start" (Übersicht, volle Breite) oder "tag" (auf breiten Bildschirmen schmale Spalte neben den Ereignissen)
  function karte(st, aktiverTag, wo) {
    if (st.length < 1) return "";
    var w = window.innerWidth, mass = w < 700 ? [440, 360] : wo === "tag" && w >= 900 ? [480, 430] : wo === "tag" ? [760, 440] : [1000, 520];
    var o = { stationen: st, breite: mass[0], hoehe: mass[1], aktiverTag: aktiverTag, reiseart: reise.art, titel: "Karte der Reise mit " + st.length + " Stationen" };
    kartenOptionen.push(o);
    return '<div class="karte" data-karte="' + (kartenOptionen.length - 1) + '">' + Karte.svg(o) + "</div>";
  }
  // Karten zum Zoomen und Verschieben (karte.js: bedienen); die Optionen merkt sich karte() beim Zeichnen der Seite
  var kartenOptionen = [];
  function kartenBedienen() {
    Array.prototype.forEach.call(app.querySelectorAll(".karte[data-karte]"), function (el) { Karte.bedienen(el, kartenOptionen[+el.dataset.karte]); });
    kartenOptionen = [];
  }
  // Knopf unter der Übersichtskarte: lässt die Route wachsen (karte.js: abspielen). Nicht bei „Bewegung reduzieren“.
  var ruhig = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches, route = null;
  function routeKnopf() {
    return ruhig ? "" : '<p class="route-knoepfe"><button type="button" class="route-knopf" id="route-knopf" aria-live="polite">▶ Route abspielen</button></p>';
  }
  function routeBedienen() {
    var knopf = document.getElementById("route-knopf");
    if (route) { route.stopp(); route = null; }
    if (!knopf) return;
    knopf.onclick = function () {
      if (route && route.laeuft()) { route.pause(); knopf.textContent = "▶ Weiter"; return; }
      if (route) { route.weiter(); knopf.textContent = "⏸ Anhalten"; return; }
      route = Karte.abspielen(app.querySelector(".abschnitt .karte .ik-karte"), { fertig: function () { route = null; knopf.textContent = "↻ Noch einmal"; } });
      if (route) knopf.textContent = "⏸ Anhalten";
    };
  }
  function schluss() {
    return reise.schluss ? '<section class="abschnitt"><div class="breite"><h2>Zum Schluss</h2><div class="schluss fliess">' + absaetze(reise.schluss) + "</div></div></section>" : "";
  }

  // ---------- Titelseite ----------
  function start() {
    var e = 0, f = 0, orte = {};
    reise.tage.forEach(function (t) {
      e += t.ereignisse.length;
      t.ereignisse.forEach(function (x) { f += x.fotos.length; });
      if (t.ort && t.ort.name) orte[t.ort.name.toLowerCase()] = 1;
    });
    var st = tagesStationen(), art = Arten.reiseart(reise.art);
    var h = kopf() + '<main id="inhalt"><section class="held">' + (reise.titelbild ? bild({ datei: reise.titelbild, text: "" }, "", false) : "") +
      '<div class="breite"><p class="vorzeile">' + esc(art.id === "andere" ? "Reisebericht" : art.name) + "</p><h1>" + esc(reise.titel || "Reisebericht") + "</h1>" +
      (reise.untertitel ? '<p class="unter">' + esc(reise.untertitel) + "</p>" : "") + '<ul class="angaben">' +
      (reise.von ? "<li>" + esc(zeitraum(reise.von, reise.bis)) + "</li>" : "") + (reise.reisende ? "<li>" + esc(reise.reisende) + "</li>" : "") +
      "</ul></div></section>";

    h += '<section class="abschnitt"><div class="breite">' + (reise.einleitung ? '<div class="einleitung fliess">' + absaetze(reise.einleitung) + "</div>" : "") +
      '<ul class="zahlen"><li><b>' + reise.tage.length + "</b><span>" + (reise.tage.length === 1 ? "Tag" : "Tage") + "</span></li>" +
      (Object.keys(orte).length ? "<li><b>" + Object.keys(orte).length + "</b><span>" + (Object.keys(orte).length === 1 ? "Ort" : "Orte") + "</span></li>" : "") +
      "<li><b>" + e + "</b><span>" + (e === 1 ? "Ereignis" : "Ereignisse") + "</span></li>" +
      (f ? "<li><b>" + f + "</b><span>" + (f === 1 ? "Foto" : "Fotos") + "</span></li>" : "") + "</ul></div></section>";

    if (st.length > 1) h += '<section class="abschnitt"><div class="breite"><h2>Die Route</h2>' + karte(st, null, "start") +
      '<p class="karte-hinweis">Die Zahlen sind die Tage der Reise. Eine Marke antippen öffnet den Tag. Mit + und − näher heran; am PC nach einem Klick in die Karte auch mit dem Mausrad, auf dem Handy nach einem Tippen mit zwei Fingern.</p>' + routeKnopf() + "</div></section>";

    h += '<section class="abschnitt"><div class="breite"><h2>Tag für Tag</h2><div class="tage">' + reise.tage.map(function (t, i) {
      var foto = erstesFoto(t), ta = Arten.tagesart(t.art), n = t.ereignisse.length;
      return '<a class="tagkarte' + (tagHatInhalt(t) ? "" : " leer") + '" href="#/tag/' + (i + 1) + '"><div class="bild">' + (foto ? bild(foto) : "<span aria-hidden=\"true\">" + ta.zeichen + "</span>") + "</div>" +
        '<div class="inhalt"><span class="nr">Tag ' + (i + 1) + " · " + esc(datumKurz(t.datum)) + "</span><h3>" + esc(tagTitel(t, i)) + "</h3>" +
        '<span class="mehr">' + (t.ort && t.ort.name && t.titel ? esc(t.ort.name) + " · " : "") + (n ? n + (n === 1 ? " Ereignis" : " Ereignisse") : "noch kein Eintrag") + "</span></div></a>";
    }).join("") + "</div></div></section>";

    return h + schluss() + "</main>" + fuss();
  }

  // ---------- Tagesseite ----------
  function sterne(n) {
    if (!n) return "";
    var s = "";
    for (var i = 1; i <= 5; i++) s += i <= n ? "★" : "<span>★</span>";
    return '<p class="sterne" aria-label="' + n + ' von 5 Sternen">' + s + "</p>";
  }
  function ereignis(e) {
    var a = Arten.ereignisart(e.art), n = e.fotos.length;
    var zeit = e.zeit ? esc(e.zeit) + (e.ende ? " – " + esc(e.ende) : "") + " Uhr" : "";
    return '<li class="ereignis"><div class="zeichen" aria-hidden="true">' + a.zeichen + '</div><div class="karte-e">' +
      '<p class="zeit">' + (zeit ? "<span>" + zeit + "</span>" : "") + '<span class="art">' + esc(a.name) + "</span></p>" +
      "<h3>" + esc(e.titel || a.name) + "</h3>" + (e.ort && e.ort.name ? '<p class="ort">📍 ' + esc(e.ort.name) + "</p>" : "") +
      (e.text ? '<div class="fliess">' + absaetze(e.text) + "</div>" : "") + sterne(e.bewertung) +
      (n ? '<div class="fotos' + (n === 1 ? " eins" : n === 2 ? " zwei" : "") + '">' + e.fotos.map(function (f) {
        return '<button type="button" data-foto="' + esc(f.datei) + '"' + (f.video ? ' class="video" aria-label="Video abspielen' : ' aria-label="Foto vergrößern') + (f.text ? ": " + esc(f.text) : "") + '">' + bild(f) +
          (f.video ? '<span class="spielen" aria-hidden="true">▶' + (f.dauer ? " " + dauerText(f.dauer) : "") + "</span>" : "") + "</button>";
      }).join("") + "</div>" + (n === 1 && e.fotos[0].text ? '<p class="bildtext">' + esc(e.fotos[0].text) + "</p>" : "") : "") +
      "</div></li>";
  }
  function tag(i) {
    var t = reise.tage[i], ta = Arten.tagesart(t.art), st = stationen(), heute = st.filter(function (s) { return s.tag === i; });
    var vor = reise.tage[i - 1], nach = reise.tage[i + 1];
    var h = kopf() + '<main id="inhalt"><div class="breite"><div class="tagkopf"><p class="nr">Tag ' + (i + 1) + " von " + reise.tage.length + " · " + esc(datumLang(t.datum)) +
      (t.art && t.art !== "normal" ? ' <span class="abzeichen"><span aria-hidden="true">' + ta.zeichen + "</span>" + esc(ta.name) + "</span>" : "") + "</p>" +
      "<h1>" + esc(tagTitel(t, i)) + "</h1>" + (t.ort && t.ort.name && t.titel ? '<p class="ort">📍 ' + esc(t.ort.name) + "</p>" : "") + "</div>" +
      (t.text ? '<div class="tagtext fliess">' + absaetze(t.text) + "</div>" : "");

    var mitKarte = heute.length > 0 && st.length > 1;
    h += '<div class="zweispaltig' + (mitKarte ? " mit-karte" : "") + '">' +
      (mitKarte ? '<div class="karte-spalte">' + karte(heute.length > 1 ? stationenUm(st, i) : st, i, "tag") + "</div>" : "") + "<div>" +
      (t.ereignisse.length ? '<ol class="zeitstrahl">' + t.ereignisse.map(ereignis).join("") + "</ol>"
        : '<p class="nichts">' + (t.text ? "Für diesen Tag gibt es keine einzelnen Ereignisse." : "Für diesen Tag gibt es noch keinen Eintrag.") + "</p>") +
      "</div></div>";

    h += '<nav class="blaettern" aria-label="Blättern">' +
      (vor ? '<a href="#/tag/' + i + '" rel="prev"><span>← Tag ' + i + "</span><b>" + esc(tagTitel(vor, i - 1)) + "</b></a>" : '<a href="#/"><span>←</span><b>Zur Übersicht</b></a>') +
      (nach ? '<a class="weiter" href="#/tag/' + (i + 2) + '" rel="next"><span>Tag ' + (i + 2) + " →</span><b>" + esc(tagTitel(nach, i + 1)) + "</b></a>" : '<a class="weiter" href="#/"><span>→</span><b>Zur Übersicht</b></a>') +
      "</nav></div>" + (nach ? "" : schluss()) + "</main>" + fuss();
    return h;
  }
  // Hat ein Tag mehrere Stationen, zeigt seine Karte nur diesen Tag samt der Station davor und danach (näher heran).
  function stationenUm(st, i) {
    var erste = -1, letzte = -1;
    st.forEach(function (s, n) { if (s.tag === i) { if (erste < 0) erste = n; letzte = n; } });
    return st.slice(Math.max(0, erste - 1), letzte + 2);
  }

  // ---------- Zeichnen und Bedienen ----------
  function zeichnen() {
    var m = location.hash.match(/^#\/tag\/(\d+)$/), nr = m ? +m[1] - 1 : -1;
    if (nr >= reise.tage.length) nr = -1;
    app.innerHTML = nr >= 0 ? tag(nr) : start();
    document.title = (nr >= 0 ? "Tag " + (nr + 1) + ": " + tagTitel(reise.tage[nr], nr) + " – " : "") + (reise.titel || "Reisebericht");
    bilderLaden(app);
    kartenBedienen();
    routeBedienen();
    var leiste = document.getElementById("tagesleiste");
    if (leiste && nr >= 0) {
      var a = leiste.querySelector('[data-tag="' + nr + '"]');
      if (a) { a.setAttribute("aria-current", "page"); leiste.scrollLeft = a.offsetLeft - leiste.clientWidth / 2 + a.clientWidth / 2; }
    }
    lupeListe = [];
    if (nr >= 0) reise.tage[nr].ereignisse.forEach(function (e) { e.fotos.forEach(function (f) { lupeListe.push(f); }); });
    window.scrollTo(0, 0);
  }

  function dauerText(s) { s = Math.round(s); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  // Video der Lupe anhalten und loslassen (beim Blättern und Schließen)
  function videoAus() {
    var v = document.getElementById("lupe-video");
    if (!v) return;
    try { v.pause(); } catch (e) { /* lief nicht */ }
    v.removeAttribute("src"); v.removeAttribute("poster"); v.hidden = true;
    try { v.load(); } catch (e) { /* egal */ }
  }
  function lupeZeigen(n) {
    lupeNr = (n + lupeListe.length) % lupeListe.length;
    var f = lupeListe[lupeNr], im = document.getElementById("lupe-bild"), v = document.getElementById("lupe-video");
    videoAus();
    im.hidden = !!(f.video && v);
    if (f.video && v) {
      // kurzes Video: mit Bedienleiste, das Standbild als Vorschau; in der Vorschau des Studios kommen die Adressen von dort
      var nr = lupeNr;
      Promise.all(vorschau ? [vorschau.medienUrl(f.video), vorschau.medienUrl(f.datei)] : ["medien/" + f.video, "medien/" + f.datei]).then(function (u) {
        if (nr !== lupeNr || !u[0]) return;
        if (u[1]) v.poster = u[1];
        v.src = u[0]; v.hidden = false;
      });
    }
    im.alt = f.text || ""; im.src = "data:,"; im.dataset.datei = f.datei;
    bilderLaden(document.getElementById("lupe"));
    document.getElementById("lupe-text").textContent = (f.text ? f.text + "  ·  " : "") + (lupeNr + 1) + " / " + lupeListe.length;
    document.getElementById("lupe-vor").hidden = document.getElementById("lupe-weiter").hidden = lupeListe.length < 2;
  }

  document.getElementById("lupe").addEventListener("close", videoAus);   // auch bei Esc
  document.addEventListener("click", function (ev) {
    var foto = ev.target.closest("[data-foto]"), punkt = ev.target.closest(".ik-punkt[data-tag]"), lupe = document.getElementById("lupe");
    if (foto) {
      var n = 0;
      lupeListe.forEach(function (f, i) { if (f.datei === foto.dataset.foto) n = i; });
      lupeZeigen(n);
      if (lupe.showModal) lupe.showModal(); else lupe.setAttribute("open", "");
    } else if (punkt) {
      location.hash = "#/tag/" + (+punkt.dataset.tag + 1);
    } else if (ev.target.closest("#modus-knopf")) {
      var m = document.documentElement.dataset.modus === "dunkel" ? "hell" : "dunkel";
      document.documentElement.dataset.modus = m;
      try { localStorage.setItem("imagicruise-bericht-modus", m); } catch (e) { /* ohne Speicher gilt die Wahl bis zum Schließen */ }
    } else if (ev.target.closest("#lupe-zu") || ev.target === lupe) { videoAus(); lupe.close ? lupe.close() : lupe.removeAttribute("open"); }
    else if (ev.target.closest("#lupe-vor")) lupeZeigen(lupeNr - 1);
    else if (ev.target.closest("#lupe-weiter") || ev.target.id === "lupe-bild") lupeZeigen(lupeNr + 1);
  });

  document.addEventListener("keydown", function (ev) {
    var lupe = document.getElementById("lupe"), offen = lupe.open;
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
    var vor = ev.key === "ArrowLeft";
    if (offen) { lupeZeigen(lupeNr + (vor ? -1 : 1)); return; }
    var m = location.hash.match(/^#\/tag\/(\d+)$/), nr = m ? +m[1] : 0, ziel = nr + (vor ? -1 : 1);
    if (ziel >= 1 && ziel <= reise.tage.length) location.hash = "#/tag/" + ziel;
    else if (ziel === 0) location.hash = "#/";
  });

  // Wischen im vergrößerten Foto
  var wischX = null;
  document.addEventListener("touchstart", function (ev) { wischX = document.getElementById("lupe").open ? ev.touches[0].clientX : null; }, { passive: true });
  document.addEventListener("touchend", function (ev) {
    if (wischX == null) return;
    var d = ev.changedTouches[0].clientX - wischX; wischX = null;
    if (Math.abs(d) > 50) lupeZeigen(lupeNr + (d > 0 ? -1 : 1));
  }, { passive: true });

  window.addEventListener("hashchange", function () { if (reise) zeichnen(); });

  // ---------- Start ----------
  function beginnen(daten) {
    if (!daten || !Array.isArray(daten.tage)) { app.innerHTML = '<p class="lade">Dieser Reisebericht enthält keine Daten.</p>'; return; }
    daten.tage.forEach(function (t) {
      t.ereignisse = Array.isArray(t.ereignisse) ? t.ereignisse : [];
      t.ereignisse.forEach(function (e) { e.fotos = Array.isArray(e.fotos) ? e.fotos : []; });
    });
    reise = daten;
    zeichnen();
  }
  try { if (window.parent !== window && window.parent.ImagicruiseVorschau) vorschau = window.parent.ImagicruiseVorschau; } catch (e) { vorschau = null; }
  if (vorschau) {
    beginnen(vorschau.reise());
    window.ImagicruiseAbspieler = { neu: function () { beginnen(vorschau.reise()); } };   // das Studio ruft das nach Änderungen
  } else {
    var s = document.createElement("script");
    s.src = "reise.js";
    s.onload = function () { beginnen(window.IMAGICRUISE_REISE); };
    s.onerror = function () { app.innerHTML = '<p class="lade">Die Datei reise.js fehlt. Bitte den ganzen Ordner des Reiseberichts hochladen.</p>'; };
    document.head.appendChild(s);
  }
})();
