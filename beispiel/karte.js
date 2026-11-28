// Imagicruise – gezeichnete Karte mit Route (Reisebericht und Studio, Browser und Node).
//
// Zeichnet die Stationen einer Reise als Linie mit Ortsmarken vor den Küstenlinien aus weltkarte.js.
// Es wird nichts von fremden Servern geladen: keine Kartenbilder, kein Kartendienst.
// Ergebnis ist ein SVG als Text; Farben kommen aus dem Stylesheet (Klassen ik-…).
// Kartendaten seit 20.11.2026: Natural Earth 1:10 Mio. mit Land, Seen, Flüssen, Ländergrenzen und Orten (weltkarte.js).
// Grenzen: keine Straßen und Stadtpläne, und Reisen über die Datumsgrenze (180° Länge) werden nicht geteilt.
// Seit 20.11.2026: jede Strecke im Stil ihres Verkehrsmittels (Feld `anreise`, sonst geschätzt), mit kleinem Bild in der Mitte,
// und abspielen() lässt die Route im Browser Strecke für Strecke wachsen.
(function (wurzel) {
  "use strict";

  var entschluesselt = {};
  var Arten = wurzel.ImagicruiseArten || (typeof require === "function" ? require("./arten.js") : null);
  var NS = "http://www.w3.org/2000/svg", zaehler = 0;
  var MAX_MASSSTAB = 420;   // Pixel je Grad Breite, höchstens für die selbst gewählte Ansicht (etwa 1 km je 4 Pixel)
  var MAX_ZOOM = 3000;      // von Hand höchstens (etwa 37 m je Pixel); ab MAX_MASSSTAB weist die Karte auf die Ungenauigkeit hin

  // Gegenstück zu werkzeuge/weltkarte_bauen.py: Text → [x0, y0, x1, y1, …] in Hundertstel Grad
  function entschluesseln(s) {
    var aus = [], i = 0, x = 0, y = 0, n = s.length;
    while (i < n) {
      for (var k = 0; k < 2; k++) {
        var wert = 0, schub = 0, b;
        do { b = s.charCodeAt(i++) - 63; wert |= (b & 0x1f) << schub; schub += 5; } while (b >= 0x20 && i < n);
        var d = wert & 1 ? ~(wert >> 1) : wert >> 1;
        if (k === 0) x += d; else y += d;
      }
      aus.push(x, y);
    }
    return aus;
  }

  // Ausschnitt so wählen, dass alle Stationen mit Rand hineinpassen. Ohne Stationen: die ganze Welt.
  // optionen.ansicht = { lon, lat, m } (Mitte und Pixel je Grad Breite) legt den Ausschnitt fest, z. B. nach dem Zoomen.
  function ausschnitt(stationen, breite, hoehe, optionen) {
    var o = optionen || {}, rand = o.rand != null ? o.rand : 0.16, mindest = o.mindest || 0.06;
    if (o.ansicht && isFinite(o.ansicht.m) && isFinite(o.ansicht.lon) && isFinite(o.ansicht.lat)) {
      var v = o.ansicht, kv = Math.max(0.2, Math.cos(v.lat * Math.PI / 180));
      return machen(breite, hoehe, v.lon - breite / (v.m * kv) / 2, v.lat + hoehe / v.m / 2, kv, v.m);
    }
    var west, ost, sued, nord;
    if (!stationen || !stationen.length) { west = -168; ost = 180; sued = -56; nord = 78; rand = 0; }
    else {
      west = ost = stationen[0].lon; sued = nord = stationen[0].lat;
      stationen.forEach(function (p) {
        west = Math.min(west, p.lon); ost = Math.max(ost, p.lon); sued = Math.min(sued, p.lat); nord = Math.max(nord, p.lat);
      });
    }
    var mitteLat = (sued + nord) / 2, mitteLon = (west + ost) / 2;
    var k = Math.max(0.2, Math.cos(mitteLat * Math.PI / 180));   // Längengrade werden zu den Polen hin schmaler
    var dLon = Math.max(ost - west, mindest / k) * (1 + 2 * rand), dLat = Math.max(nord - sued, mindest) * (1 + 2 * rand);
    var m = Math.min(breite / (dLon * k), hoehe / dLat);          // Pixel je Grad Breite
    // nicht näher heran, als die Kartendaten (1:10 Mio.) genau sind: sonst wirken Küsten eckig und Orte verrutscht
    m = Math.min(m, o.maxMassstab || MAX_MASSSTAB);
    dLon = breite / (m * k); dLat = hoehe / m;                     // Ausschnitt auf das Seitenverhältnis erweitern
    west = mitteLon - dLon / 2; nord = Math.min(89.5, mitteLat + dLat / 2);
    if (nord - dLat < -89.5) nord = -89.5 + dLat;
    return machen(breite, hoehe, west, nord, k, m);
  }
  function machen(breite, hoehe, west, nord, k, m) {
    var dLon = breite / (m * k), dLat = hoehe / m;
    return {
      breite: breite, hoehe: hoehe, west: west, ost: west + dLon, nord: nord, sued: nord - dLat, massstab: m, k: k,
      mitte: { lon: west + dLon / 2, lat: nord - dLat / 2, m: m },
      x: function (lon) { return (lon - west) * k * m; },
      y: function (lat) { return (nord - lat) * m; },
      lon: function (x) { return west + x / (k * m); },
      lat: function (y) { return nord - y / m; }
    };
  }

  // Vieleck an einem Rechteck abschneiden (Sutherland-Hodgman). p: [x0,y0,…]
  function beschneiden(p, x0, y0, x1, y1) {
    var kanten = [
      function (x, y) { return x >= x0; }, function (x, y) { return x <= x1; },
      function (x, y) { return y >= y0; }, function (x, y) { return y <= y1; }
    ];
    var schnitt = [
      function (ax, ay, bx, by) { return [x0, ay + (by - ay) * (x0 - ax) / (bx - ax)]; },
      function (ax, ay, bx, by) { return [x1, ay + (by - ay) * (x1 - ax) / (bx - ax)]; },
      function (ax, ay, bx, by) { return [ax + (bx - ax) * (y0 - ay) / (by - ay), y0]; },
      function (ax, ay, bx, by) { return [ax + (bx - ax) * (y1 - ay) / (by - ay), y1]; }
    ];
    for (var k = 0; k < 4 && p.length; k++) {
      var aus = [], innen = kanten[k], n = p.length;
      var ax = p[n - 2], ay = p[n - 1], aIn = innen(ax, ay);
      for (var i = 0; i < n; i += 2) {
        var bx = p[i], by = p[i + 1], bIn = innen(bx, by);
        if (bIn !== aIn) { var s = schnitt[k](ax, ay, bx, by); aus.push(s[0], s[1]); }
        if (bIn) aus.push(bx, by);
        ax = bx; ay = by; aIn = bIn;
      }
      p = aus;
    }
    return p;
  }

  // ---------- Kartendaten (weltkarte.js, Fassung 2: Natural Earth 1:10 Mio.) ----------
  // Ebenen: land und seen sind Flächen, fluesse und grenzen Linien; je Eintrag [west, sued, ost, nord, "Punkte", rang]
  // in 1/genau Grad. Fassung 1 (nur „umrisse“, 1:50 Mio.) wird weiter gelesen.
  var cache = typeof Map === "function" ? new Map() : null;
  function punkteVon(e) {
    if (!cache) return entschluesseln(e[4]);
    var p = cache.get(e);
    if (!p) { p = entschluesseln(e[4]); cache.set(e, p); }
    return p;
  }
  function ebene(welt, name) {
    if (!welt) return [];
    if (name === "land") return welt.land || welt.umrisse || [];
    return welt[name] || [];
  }

  // Linie an einem Rechteck abschneiden (Liang-Barsky je Strecke) → Liste von Teilstücken [x0,y0,x1,y1,…]
  function linieSchneiden(p, x0, y0, x1, y1) {
    var teile = [], teil = [];
    var dazu = function (x, y) { var n = teil.length; if (n < 2 || teil[n - 2] !== x || teil[n - 1] !== y) teil.push(x, y); };
    for (var i = 0; i + 3 < p.length; i += 2) {
      var ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3], dx = bx - ax, dy = by - ay, t0 = 0, t1 = 1, ok = true;
      [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]].forEach(function (q) {
        if (!ok) return;
        if (q[0] === 0) { if (q[1] < 0) ok = false; return; }
        var r = q[1] / q[0];
        if (q[0] < 0) { if (r > t1) ok = false; else if (r > t0) t0 = r; }
        else { if (r < t0) ok = false; else if (r < t1) t1 = r; }
      });
      if (!ok) { if (teil.length > 2) teile.push(teil); teil = []; continue; }
      if (t0 > 0 && teil.length) { if (teil.length > 2) teile.push(teil); teil = []; }
      dazu(Math.round(ax + t0 * dx), Math.round(ay + t0 * dy));
      dazu(Math.round(ax + t1 * dx), Math.round(ay + t1 * dy));
      if (t1 < 1) { if (teil.length > 2) teile.push(teil); teil = []; }
    }
    if (teil.length > 2) teile.push(teil);
    return teile;
  }

  // Eine Ebene als SVG-Pfad im Ausschnitt a. flaeche: geschlossene Umrisse (Z); maxRang: unwichtigere Einträge entfallen.
  // Punkte, die weniger als einen halben Pixel vom vorigen entfernt sind, entfallen (bei der ganzen Welt sonst sehr viele).
  function ebenePfad(welt, name, a, flaeche, maxRang) {
    var liste = ebene(welt, name);
    if (!liste.length) return "";
    var g = welt.genau, d = "", randX = (a.ost - a.west) * 0.05, randY = (a.nord - a.sued) * 0.05;
    var x0 = (a.west - randX) * g, x1 = (a.ost + randX) * g, y0 = (a.sued - randY) * g, y1 = (a.nord + randY) * g;
    var tol = a.massstab < 10 ? 1.3 : 0.5, kleinste = tol / a.massstab * g;   // ganze Welt: gröber, sonst zu viele Punkte
    var zeichnen = function (p, zu) {
      var lx = null, ly = null, teil = "", n = 0;
      for (var i = 0; i < p.length; i += 2) {
        var x = Math.round(a.x(p[i] / g) * 10) / 10, y = Math.round(a.y(p[i + 1] / g) * 10) / 10;
        if (lx != null && Math.abs(x - lx) < tol && Math.abs(y - ly) < tol && i + 2 < p.length) continue;
        teil += (teil ? "L" : "M") + x + " " + y; n++;
        lx = x; ly = y;
      }
      if (n >= (zu ? 3 : 2)) d += teil + (zu ? "Z" : "");
    };
    liste.forEach(function (u) {
      if (u[2] < x0 || u[0] > x1 || u[3] < y0 || u[1] > y1) return;
      if (maxRang != null && (u[5] || 0) > maxRang) return;
      if (flaeche && u[2] - u[0] < kleinste && u[3] - u[1] < kleinste) return;
      var p = punkteVon(u), innen = u[0] >= x0 && u[2] <= x1 && u[1] >= y0 && u[3] <= y1;
      if (flaeche) { if (!innen) p = beschneiden(p, x0, y0, x1, y1); if (p.length >= 6) zeichnen(p, true); }
      else (innen ? [p] : linieSchneiden(p, x0, y0, x1, y1)).forEach(function (t) { zeichnen(t, false); });
    });
    return d;
  }

  // Gegenstück zu entschluesseln (für den Ausschnitt der Daten im Reisebericht)
  function verschluesseln(p) {
    var aus = "", vx = 0, vy = 0;
    for (var i = 0; i < p.length; i += 2) {
      [p[i] - vx, p[i + 1] - vy].forEach(function (d) {
        var n = d < 0 ? ~(d << 1) : d << 1;
        while (n >= 0x20) { aus += String.fromCharCode((0x20 | (n & 0x1f)) + 63); n >>= 5; }
        aus += String.fromCharCode(n + 63);
      });
      vx = p[i]; vy = p[i + 1];
    }
    return aus;
  }
  function grenzenVon(p) {
    var w = Infinity, s = Infinity, o = -Infinity, n = -Infinity;
    for (var i = 0; i < p.length; i += 2) { w = Math.min(w, p[i]); o = Math.max(o, p[i]); s = Math.min(s, p[i + 1]); n = Math.max(n, p[i + 1]); }
    return [w, s, o, n];
  }
  // Nur der Teil der Kartendaten in r = { west, sued, ost, nord } (Grad), Flächen und Linien am Rand abgeschnitten.
  // Für den Reisebericht: Er braucht nur die Gegend der Reise (statt 3 MB meist wenige hundert KB).
  function datenAusschnitt(welt, r) {
    var g = welt.genau, x0 = Math.round(r.west * g), x1 = Math.round(r.ost * g), y0 = Math.round(r.sued * g), y1 = Math.round(r.nord * g);
    var aus = { version: 2, genau: g, quelle: welt.quelle || "Natural Earth (gemeinfrei)", ausschnitt: { west: r.west, sued: r.sued, ost: r.ost, nord: r.nord } };
    ["land", "seen", "fluesse", "grenzen"].forEach(function (name) {
      var flaeche = name === "land" || name === "seen", liste = [];
      ebene(welt, name).forEach(function (u) {
        if (u[2] < x0 || u[0] > x1 || u[3] < y0 || u[1] > y1) return;
        if (u[0] >= x0 && u[2] <= x1 && u[1] >= y0 && u[3] <= y1) { liste.push(u); return; }
        var p = punkteVon(u);
        (flaeche ? [beschneiden(p, x0, y0, x1, y1)] : linieSchneiden(p, x0, y0, x1, y1)).forEach(function (t) {
          if (t.length < (flaeche ? 6 : 4)) return;
          t = t.map(Math.round);   // Schnittpunkte sind Kommazahlen; gespeichert werden ganze Tausendstel Grad
          liste.push(grenzenVon(t).concat([verschluesseln(t), u[5] || 0]));
        });
      });
      aus[name] = liste;
    });
    aus.orte = (welt.orte || []).filter(function (o) { return o[0] >= x0 && o[0] <= x1 && o[1] >= y0 && o[1] <= y1; });
    return aus;
  }
  // Kartendaten als Inhalt von weltkarte.js
  function datenJs(welt) {
    return "// Kartendaten für diesen Reisebericht (Ausschnitt). Quelle: " + (welt.quelle || "Natural Earth (gemeinfrei)") + ".\n" +
      "(function (w) { w.IMAGICRUISE_WELT = " + JSON.stringify(welt) + ";\n" +
      "  if (typeof module !== \"undefined\" && module.exports) module.exports = w.IMAGICRUISE_WELT;\n" +
      "})(typeof globalThis !== \"undefined\" ? globalThis : this);\n";
  }

  // Wie viel Einzelheiten der Maßstab verträgt (m = Pixel je Grad): ganze Welt etwa 2, Europa 25, eine Region 150
  function stufe(m) { return Math.log(Math.max(1, m)) / Math.LN2; }

  // ---------- Verkehrsmittel ----------
  // Entfernung in km (Großkreis)
  function km(a, b) {
    var r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  // Verkehrsmittel der Strecke von a nach b: eingetragen (b.anreise) oder geschätzt → { id, geschaetzt }
  // Schätzung: Kreuzfahrt von Tag zu Tag Schiff, über 600 km Flugzeug, unter 3 km zu Fuß, Kreuzfahrt am selben Tag Bus, sonst Auto.
  function verkehrsmittel(a, b, reiseart) {
    var v = b && Arten ? Arten.verkehrsmittel(b.anreise) : null;
    if (v) return { id: v.id, geschaetzt: false };
    var d = km(a, b), gleicherTag = a.tag === b.tag, kreuz = reiseart === "kreuzfahrt";
    return { id: kreuz && !gleicherTag ? "schiff" : d > 600 ? "flugzeug" : d < 3 ? "zufuss" : kreuz ? "bus" : "auto", geschaetzt: true };
  }
  function linieVon(id) { var v = Arten && Arten.verkehrsmittel(id); return v || { id: id, linie: "strasse" }; }

  // Kleine Bilder der Verkehrsmittel (eigene Zeichnung, Mitte bei 0/0, etwa −10 bis 10; Löcher über evenodd)
  function ring(x, y, r, innen) {
    var k = function (rr) { return "M" + (x - rr) + " " + y + "a" + rr + " " + rr + " 0 1 0 " + 2 * rr + " 0a" + rr + " " + rr + " 0 1 0 " + -2 * rr + " 0z"; };
    return k(r) + (innen ? k(innen) : "");
  }
  var BILDER = {
    schiff: "M-10 3h20l-3.5 5h-13zM-7 -1h13v3h-13zM-3 -5h6v3.2h-6zM1 -9h2.5v3.6h-2.5z",
    faehre: "M-10 2h20l-2.5 5h-15zM-8 -5h16v6h-16zM-6 -3.5h3v2.5h-3zM-1.5 -3.5h3v2.5h-3zM3 -3.5h3v2.5h-3z",
    flugzeug: "M0 -10c1.1 0 1.7 1.3 1.7 2.8v4.4l8.3 4.6v2.2l-8.3-2.6v4.9l2.6 2v1.7l-4.3-1.1-4.3 1.1v-1.7l2.6-2v-4.9l-8.3 2.6v-2.2l8.3-4.6v-4.4c0-1.5.6-2.8 1.7-2.8z",
    bahn: "M-6 -10h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-12a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3zM-6 -7v5h12v-5zM-5 1.5v2h2.5v-2zM2.5 1.5v2h2.5v-2zM-6 7l-3 4h2.6l2.4-4zM6 7l3 4h-2.6l-2.4-4z",
    bus: "M-8 -9h16a2 2 0 0 1 2 2v12h-20v-12a2 2 0 0 1 2-2zM-7 -6v5h14v-5zM-8 5h4v3h-4zM4 5h4v3h-4z",
    auto: "M-10 1.5l2.2-5.5c.3-.8 1-1.3 1.9-1.3h11.8c.9 0 1.6.5 1.9 1.3l2.2 5.5v4.5h-20zM-6.5 -3l-1.4 3.5h15.8l-1.4-3.5zM-9 6h5v3h-5zM4 6h5v3h-5z",
    wohnmobil: "M-10 -8h12v14h-12zM-8 -6v3h4v-3zM-2 -6v3h3v-3zM2 -3h4.5l3.5 4v5h-8zM-8 6h4v3h-4zM4 6h4v3h-4z",
    motorrad: ring(-6, 4, 3.6, 1.8) + ring(6, 4, 3.6, 1.8) + "M-4 2l3-5h5l2 2h3l-2 3h-5zM3 -6.5h3.5v1.6h-3.5z",
    fahrrad: ring(-6, 3, 4, 3) + ring(6, 3, 4, 3) + "M-6.6 3.5l3.6-7.5h7.6l2.4 7h-1.7l-1.8-5.3-4.9 5.8h-1.6l4.9-5.8h-3.9l-3 6zM-4 -6h3.5v1.4h-3.5z",
    zufuss: ring(1, -8, 2.3) + "M-1 -5h3l2 5 3 1.5-.7 1.5-3.6-1.8-1-2-1.2 4.5 3 3v5h-2v-4l-3-2.8-1.8 6.8h-2.1l3-12-2.4 1.6v3.4h-1.8v-4.5z",
    seilbahn: "M-11 -8l22-4v1.4l-22 4zM-.6 -9h1.2v4h-1.2zM-6 -5h12l1.5 10h-15zM-4.5 -3v4h9v-4z"
  };
  function bildSvg(id, r) {
    return '<circle r="' + r + '"/><path fill-rule="evenodd" transform="scale(' + (r / 13).toFixed(3) + ')" d="' + (BILDER[id] || BILDER.auto) + '"/>';
  }
  // Pfad einer Strecke: gerade, beim Flugzeug als Bogen nach oben → { d, mitte: [x, y], laenge }
  function strecke(p, q, bogen) {
    var dx = q.x - p.x, dy = q.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
    if (!bogen) return { d: "M" + p.x + " " + p.y + "L" + q.x + " " + q.y, mitte: [(p.x + q.x) / 2, (p.y + q.y) / 2], laenge: l };
    var nx = -dy / l, ny = dx / l;
    if (ny > 0) { nx = -nx; ny = -ny; }
    var h = l * 0.2, cx = Math.round(((p.x + q.x) / 2 + nx * h) * 10) / 10, cy = Math.round(((p.y + q.y) / 2 + ny * h) * 10) / 10;
    return { d: "M" + p.x + " " + p.y + "Q" + cx + " " + cy + " " + q.x + " " + q.y, mitte: [0.25 * p.x + 0.5 * cx + 0.25 * q.x, 0.25 * p.y + 0.5 * cy + 0.25 * q.y], laenge: l * 1.1 };
  }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // Schöne Länge für den Maßstab: 1, 2, 5, 10, 20, 50 … km
  function massstab(a) {
    var kmJeGrad = 111.2, ziel = a.breite / 5 / a.massstab * kmJeGrad, stufen = [1, 2, 5], km = 1, z = 1;
    for (var i = 0; i < 40; i++) {
      var w = stufen[i % 3] * Math.pow(10, Math.floor(i / 3) - 1);
      if (w > ziel) break;
      km = w; z = i;
    }
    return { km: km, px: km / kmJeGrad * a.massstab };
  }

  // optionen: { stationen: [{lat, lon, name, tag, anreise}], breite, hoehe, welt, aktiverTag (Nummer ab 0 oder null),
  //             namen (true: Ortsnamen zeigen), titel (für Vorleseprogramme), reiseart (für die Schätzung der Verkehrsmittel),
  //             ansicht ({ lon, lat, m }, siehe ausschnitt), orte (false: keine Orte aus den Kartendaten), ziehbar (Marken zum Verschieben, Studio) }
  function svg(optionen) {
    var o = optionen || {}, st = (o.stationen || []).filter(function (p) { return typeof p.lat === "number" && typeof p.lon === "number"; });
    var b = o.breite || 800, h = o.hoehe || 480, a = ausschnitt(st, b, h, o), r = Math.max(9, Math.min(13, b / 60));
    var aktiv = typeof o.aktiverTag === "number" ? o.aktiverTag : null;
    var aus = '<svg class="ik-karte" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + b + " " + h + '" role="img" aria-label="' + esc(o.titel || "Karte der Reise") + '">';
    aus += '<rect class="ik-meer" width="' + b + '" height="' + h + '"/>';
    var welt = o.welt || wurzel.IMAGICRUISE_WELT, st0 = stufe(a.massstab);
    var land = ebenePfad(welt, "land", a, true);
    if (land) aus += '<path class="ik-land" d="' + land + '"/>';
    var seen = ebenePfad(welt, "seen", a, true, st0 + 2);
    if (seen) aus += '<path class="ik-see" d="' + seen + '"/>';
    var fluesse = ebenePfad(welt, "fluesse", a, false, st0 + 1);
    if (fluesse) aus += '<path class="ik-fluss" fill="none" d="' + fluesse + '"/>';
    var grenzen = ebenePfad(welt, "grenzen", a, false, null);
    if (grenzen) aus += '<path class="ik-grenze" fill="none" d="' + grenzen + '"/>';
    var vorne = aus; aus = "";   // Hintergrund; Orte kommen erst nach den Namen der Stationen dazu (die haben Vorrang)

    var pkt = st.map(function (p) { return { x: Math.round(a.x(p.lon) * 10) / 10, y: Math.round(a.y(p.lat) * 10) / 10, p: p }; });
    var belegt = pkt.map(function (q) { return [q.x - r, q.y - r, q.x + r, q.y + r]; }), namen = "", rs = Math.max(7, r * 0.72);
    // Strecken: je Strecke eine Gruppe im Stil ihres Verkehrsmittels; die zu einer Station des gewählten Tages hervorgehoben
    for (var n = 1; n < pkt.length; n++) {
      var p0 = pkt[n - 1], p1 = pkt[n], vm = verkehrsmittel(p0.p, p1.p, o.reiseart), art = linieVon(vm.id), s = strecke(p0, p1, art.bogen);
      var heute = aktiv != null && p1.p.tag === aktiv;
      var kl = "ik-route ik-l-" + art.linie + (heute ? " ik-heute" : aktiv != null ? " ik-leise" : "") + (vm.geschaetzt ? " ik-geschaetzt" : "");
      aus += '<g class="ik-strecke" data-n="' + (n - 1) + '" data-v="' + vm.id + '"><path class="' + kl + '" fill="none" d="' + s.d + '"/>' +
        (art.linie === "schiene" ? '<path class="ik-schwellen" fill="none" d="' + s.d + '"/>' : "");
      // kleines Bild in der Mitte, wenn die Strecke lang genug ist und nichts verdeckt
      var m = s.mitte, kasten = [m[0] - rs, m[1] - rs, m[0] + rs, m[1] + rs];
      if (s.laenge > rs * 6 && !belegt.some(function (v) { return kasten[0] < v[2] && kasten[2] > v[0] && kasten[1] < v[3] && kasten[3] > v[1]; })) {
        belegt.push(kasten);
        aus += '<g class="ik-symbol' + (aktiv != null && !heute ? " ik-leise" : "") + '" transform="translate(' + m[0].toFixed(1) + " " + m[1].toFixed(1) + ')"><title>' + esc(art.name || vm.id) + "</title>" + bildSvg(vm.id, rs) + "</g>";
      }
      aus += "</g>";
    }

    // Ortsnamen: je Marke die erste Stelle (rechts, links, oben, unten), die nichts verdeckt
    if (o.namen !== false) {
      var gezeigt = {};
      pkt.forEach(function (q, qi) {
        var name = String(q.p.name || "").trim();
        if (!name || gezeigt[name.toLowerCase()]) return;
        if (name.length > 24) name = name.slice(0, 23) + "…";
        var w = name.length * 7.2 + 6, hh = 16;
        var stellen = [[q.x + r + 4, q.y - hh / 2, "start"], [q.x - r - 4 - w, q.y - hh / 2, "start"], [q.x - w / 2, q.y - r - 4 - hh, "start"], [q.x - w / 2, q.y + r + 4, "start"]];
        for (var i = 0; i < stellen.length; i++) {
          var s = stellen[i], k = [s[0], s[1], s[0] + w, s[1] + hh];
          if (k[0] < 2 || k[2] > b - 2 || k[1] < 2 || k[3] > h - 2) continue;
          if (belegt.some(function (v) { return k[0] < v[2] && k[2] > v[0] && k[1] < v[3] && k[3] > v[1]; })) continue;
          belegt.push(k); gezeigt[name.toLowerCase()] = true;
          var leise = aktiv != null && q.p.tag !== aktiv ? " ik-leise" : "";
          namen += '<text class="ik-name' + leise + '" data-i="' + qi + '" x="' + (s[0] + 3) + '" y="' + (s[1] + 12) + '">' + esc(name) + "</text>";
          break;
        }
      });
    }

    // Orte aus den Kartendaten: wichtige zuerst, nur so viele, wie Platz haben, und nicht doppelt zu einer Station
    var orte = "", zahl = 0, maxRang = st0 + 0.5, g = welt && welt.genau, stationsNamen = {};
    pkt.forEach(function (q) { stationsNamen[String(q.p.name || "").trim().toLowerCase()] = true; });
    if (o.orte !== false && welt && welt.orte) for (var oi = 0; oi < welt.orte.length && zahl < 45; oi++) {
      var ort = welt.orte[oi];
      if (ort[3] > maxRang) break;                       // nach Wichtigkeit sortiert: ab hier nur noch unwichtigere
      var ox = a.x(ort[0] / g), oy = a.y(ort[1] / g);
      if (ox < 4 || ox > b - 4 || oy < 4 || oy > h - 4 || stationsNamen[ort[2].toLowerCase()]) continue;
      var ow = ort[2].length * 6.4 + 4, punkt = [ox - 3, oy - 3, ox + 3, oy + 3], frei = null;
      var stellen = [[ox + 5, oy - 7], [ox - 5 - ow, oy - 7], [ox - ow / 2, oy - 18], [ox - ow / 2, oy + 4]];
      if (belegt.some(function (v) { return punkt[0] < v[2] && punkt[2] > v[0] && punkt[1] < v[3] && punkt[3] > v[1]; })) continue;
      for (var si = 0; si < stellen.length && !frei; si++) {
        var k = [stellen[si][0], stellen[si][1], stellen[si][0] + ow, stellen[si][1] + 14];
        if (k[0] < 2 || k[2] > b - 2 || k[1] < 2 || k[3] > h - 2) continue;
        if (!belegt.some(function (v) { return k[0] < v[2] && k[2] > v[0] && k[1] < v[3] && k[3] > v[1]; })) frei = k;
      }
      if (!frei) continue;
      belegt.push(punkt, frei); zahl++;
      orte += '<g class="ik-ort' + (ort[3] <= 2 ? " ik-gross" : "") + '"><circle cx="' + ox.toFixed(1) + '" cy="' + oy.toFixed(1) + '" r="2.4"/><text x="' + (frei[0] + 2).toFixed(1) + '" y="' + (frei[1] + 11).toFixed(1) + '">' + esc(ort[2]) + "</text></g>";
    }

    // Marken zuletzt, die des gewählten Tages obenauf
    var marken = pkt.map(function (q, i) {
      var istAktiv = aktiv != null && q.p.tag === aktiv, nr = typeof q.p.tag === "number" ? q.p.tag + 1 : i + 1;
      return { aktiv: istAktiv, text: '<g class="ik-punkt' + (istAktiv ? " ik-aktiv" : aktiv != null ? " ik-leise" : "") + (o.ziehbar ? " ik-ziehbar" : "") + '" data-i="' + i + '"' +
        (typeof q.p.tag === "number" ? ' data-tag="' + q.p.tag + '"' : "") + ' transform="translate(' + q.x + " " + q.y + ')">' +
        "<title>" + esc((typeof q.p.tag === "number" ? "Tag " + nr + ": " : "") + (q.p.name || "")) + "</title>" +
        '<circle r="' + r + '"/><text y="' + (r * 0.36).toFixed(1) + '" font-size="' + (r * (nr > 99 ? 0.8 : 1.02)).toFixed(1) + '">' + nr + "</text></g>" };
    });
    aus = vorne + orte + aus;
    aus += namen + marken.filter(function (m) { return !m.aktiv; }).concat(marken.filter(function (m) { return m.aktiv; })).map(function (m) { return m.text; }).join("");

    if (a.massstab > MAX_MASSSTAB * 1.05) aus += '<text class="ik-ungenau" x="' + (b - 10) + '" y="' + (h - 10) + '" text-anchor="end">Küsten und Orte hier nur ungefähr</text>';
    if (st.length) {
      var ms = massstab(a), mx = 14, my = h - 14;
      aus += '<g class="ik-massstab"><path d="M' + mx + " " + (my - 5) + "V" + my + "H" + (mx + ms.px).toFixed(1) + "V" + (my - 5) + '" fill="none"/>' +
        '<text x="' + (mx + ms.px / 2).toFixed(1) + '" y="' + (my - 7) + '">' + String(ms.km).replace(".", ",") + " km</text></g>";
    }
    return aus + "</svg>";
  }

  // ---------- Route abspielen (nur im Browser) ----------
  // Lässt die Route einer mit svg() gezeichneten Karte Strecke für Strecke wachsen: Das Bild des Verkehrsmittels fährt mit,
  // Marke und Name eines Ortes erscheinen, wenn er erreicht ist. svgEl = das <svg>-Element.
  // o = { gesamt: ms (Richtwert für alles, 24000), fertig: function () }
  // → Steuerung { pause(), weiter(), stopp(), laeuft() } oder null (keine Strecke oder kein Browser)
  function abspielen(svgEl, o) {
    o = o || {};
    if (!svgEl || typeof document === "undefined" || !svgEl.querySelectorAll) return null;
    var gruppen = Array.prototype.slice.call(svgEl.querySelectorAll(".ik-strecke"));
    if (!gruppen.length) return null;
    var defs = svgEl.querySelector("defs") || svgEl.insertBefore(document.createElementNS(NS, "defs"), svgEl.firstChild);
    var kennung = "ikm" + (++zaehler) + "-";
    var teile = gruppen.map(function (g, n) {
      var pfad = g.querySelector(".ik-route"), maske = document.createElementNS(NS, "mask"), m = document.createElementNS(NS, "path");
      maske.id = kennung + n; maske.setAttribute("maskUnits", "userSpaceOnUse");
      [["d", pfad.getAttribute("d")], ["fill", "none"], ["stroke", "#fff"], ["stroke-width", "18"], ["pathLength", "1"], ["stroke-dasharray", "1 1"], ["stroke-dashoffset", "1"]]
        .forEach(function (x) { m.setAttribute(x[0], x[1]); });
      maske.appendChild(m); defs.appendChild(maske); g.setAttribute("mask", "url(#" + maske.id + ")");
      return { g: g, m: m, pfad: pfad, laenge: pfad.getTotalLength(), v: g.getAttribute("data-v") };
    });
    var marken = Array.prototype.slice.call(svgEl.querySelectorAll(".ik-punkt[data-i], .ik-name[data-i]"));
    var zeigen = function (i) { marken.forEach(function (el) { if (+el.getAttribute("data-i") === i) el.classList.remove("ik-verborgen"); }); };
    marken.forEach(function (el) { el.classList.add("ik-verborgen"); });
    svgEl.classList.add("ik-spielt");
    zeigen(0);
    var r = Math.max(9, Math.min(13, (svgEl.viewBox && svgEl.viewBox.baseVal ? svgEl.viewBox.baseVal.width : 800) / 60));
    var fahrzeug = document.createElementNS(NS, "g");
    fahrzeug.setAttribute("class", "ik-fahrzeug");
    svgEl.appendChild(fahrzeug);
    var jeStrecke = Math.max(600, Math.min(1600, (o.gesamt || 24000) / teile.length)), halt = 250;
    var nr = 0, zeit = 0, letzte = null, angehalten = false, aus = false, bildVon = null;
    function sanft(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function setzeFahrzeug(t) {
      var tl = teile[nr];
      if (bildVon !== tl.v) { fahrzeug.innerHTML = bildSvg(tl.v, r * 0.95); bildVon = tl.v; }
      var p = tl.pfad.getPointAtLength(tl.laenge * t), q = tl.pfad.getPointAtLength(Math.min(tl.laenge, tl.laenge * t + 1));
      var winkel = tl.v === "flugzeug" ? Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI + 90 : 0;
      fahrzeug.setAttribute("transform", "translate(" + p.x.toFixed(1) + " " + p.y.toFixed(1) + ")" + (winkel ? " rotate(" + winkel.toFixed(0) + ")" : ""));
    }
    function aufraeumen() {
      teile.forEach(function (tl) { tl.g.removeAttribute("mask"); });
      Array.prototype.slice.call(defs.querySelectorAll('mask[id^="' + kennung + '"]')).forEach(function (m) { m.remove(); });
      marken.forEach(function (el) { el.classList.remove("ik-verborgen"); });
      svgEl.classList.remove("ik-spielt");
      fahrzeug.remove();
    }
    function schritt(jetzt) {
      if (aus || angehalten) { letzte = null; return; }
      if (letzte != null) zeit += jetzt - letzte;
      letzte = jetzt;
      var t = Math.min(1, zeit / jeStrecke);
      teile[nr].m.setAttribute("stroke-dashoffset", String(1 - sanft(t)));
      setzeFahrzeug(sanft(t));
      if (t >= 1) zeigen(nr + 1);
      if (zeit >= jeStrecke + halt || (t >= 1 && nr === teile.length - 1)) {
        teile[nr].m.setAttribute("stroke-dashoffset", "0");
        nr++; zeit = 0;
        if (nr >= teile.length) { aus = true; aufraeumen(); if (o.fertig) o.fertig(); return; }
      }
      requestAnimationFrame(schritt);
    }
    requestAnimationFrame(schritt);
    return {
      pause: function () { angehalten = true; },
      weiter: function () { if (angehalten && !aus) { angehalten = false; requestAnimationFrame(schritt); } },
      stopp: function () { if (!aus) { aus = true; aufraeumen(); } },
      laeuft: function () { return !aus && !angehalten; }
    };
  }

  // ---------- Zoomen und Verschieben (nur im Browser) ----------
  // Macht die Karte in huelle (Element mit einer von svg() gezeichneten Karte) beweglich: Mausrad (nach einem Klick in die
  // Karte oder mit Strg), zwei Finger, Ziehen mit Maus oder Finger (auf dem Handy erst nach einem Tippen, sonst ließe sich
  // die Seite nicht mehr blättern), Knöpfe + / − / „Ganze Route“. Während der Geste wird das Bild nur verschoben und
  // vergrößert; danach zeichnet die Karte neu, mit den Einzelheiten des neuen Maßstabs.
  // o = dieselben Optionen wie für svg(), dazu ansicht (Anfang), beiAnsicht(ansicht oder null) zum Merken,
  // sofort (true: ein Finger verschiebt ohne vorheriges Antippen – im Studio; im Reisebericht soll der Finger die Seite blättern).
  // Wer es ohne Antippen bzw. Klick versucht, bekommt einen kurzen Hinweis in der Karte.
  // Grenzen: höchstens MAX_ZOOM; hat die Kartendatei nur einen Ausschnitt (Reisebericht), bleibt man darin.
  function bedienen(huelle, o) {
    if (!huelle || typeof document === "undefined" || !huelle.querySelector) return null;
    o = Object.assign({}, o);
    var b = o.breite || 800, h = o.hoehe || 480, ansicht = o.ansicht || null, a = null, aktiv = false, zeiger = {}, geste = null;
    var stationenVon = function () { return (o.stationen || []).filter(function (p) { return typeof p.lat === "number" && typeof p.lon === "number"; }); };
    huelle.classList.add("ik-beweglich");
    if (o.sofort) huelle.classList.add("ik-sofort");
    var knoepfe = document.createElement("div");
    knoepfe.className = "ik-zoom";
    knoepfe.innerHTML = '<button type="button" data-zoom="rein" aria-label="Näher heran" title="Näher heran">+</button>' +
      '<button type="button" data-zoom="raus" aria-label="Weiter weg" title="Weiter weg">−</button>' +
      '<button type="button" data-zoom="ganz" aria-label="Ganze Route zeigen" title="Ganze Route zeigen">⤢</button>';
    huelle.appendChild(knoepfe);
    var tipp = document.createElement("div"), tippUhr = null;
    tipp.className = "ik-tipp"; tipp.setAttribute("role", "status"); tipp.hidden = true;
    huelle.appendChild(tipp);
    function hinweis(text) {
      tipp.textContent = text; tipp.hidden = false;
      clearTimeout(tippUhr); tippUhr = setTimeout(function () { tipp.hidden = true; }, 2200);
    }
    function bild() { return huelle.querySelector("svg.ik-karte"); }
    function faktor() { var el = bild(); return el && el.clientWidth ? el.clientWidth / b : 1; }   // Bildschirm-Pixel je Kartenpunkt
    function grenzen(v) {
      var r = (o.welt || wurzel.IMAGICRUISE_WELT || {}).ausschnitt || { west: -180, ost: 180, sued: -85, nord: 85 };
      var k = Math.max(0.2, Math.cos(v.lat * Math.PI / 180));
      var mMin = Math.max(b / ((r.ost - r.west) * k), h / (r.nord - r.sued)) * (r.ost - r.west >= 359 ? 0.6 : 1);
      var m = Math.max(mMin, Math.min(o.maxZoom || MAX_ZOOM, v.m));
      var hx = b / (2 * k * m), hy = h / (2 * m);
      var lon = r.ost - r.west < 2 * hx ? (r.west + r.ost) / 2 : Math.max(r.west + hx, Math.min(r.ost - hx, v.lon));
      var lat = r.nord - r.sued < 2 * hy ? (r.sued + r.nord) / 2 : Math.max(r.sued + hy, Math.min(r.nord - hy, v.lat));
      return { lon: lon, lat: lat, m: m };
    }
    function zeichnen() {
      var alt = bild(), d = document.createElement("div");
      if (alt && alt.classList.contains("ik-spielt")) return;          // Route läuft gerade: nicht dazwischen
      d.innerHTML = svg(Object.assign({}, o, { ansicht: ansicht }));
      var neu = d.firstChild;
      if (alt) alt.parentNode.replaceChild(neu, alt); else huelle.insertBefore(neu, huelle.firstChild);
      a = ausschnitt(stationenVon(), b, h, Object.assign({}, o, { ansicht: ansicht }));
      if (o.beiAnsicht) o.beiAnsicht(ansicht);
    }
    // Ansicht so, dass der Ort p (lon/lat) an der Bildschirmstelle (sx, sy) liegt, mit Maßstab m
    function ansichtMit(p, sx, sy, m) {
      var f = faktor(), k = Math.max(0.2, Math.cos(p.lat * Math.PI / 180));
      return grenzen({ lon: p.lon - (sx / f - b / 2) / (k * m), lat: p.lat + (sy / f - h / 2) / m, m: m });
    }
    function ortBei(sx, sy) { var f = faktor(); return { lon: a.lon(sx / f), lat: a.lat(sy / f) }; }
    function zoomen(mal, sx, sy) {
      if (!a) a = ausschnitt(stationenVon(), b, h, Object.assign({}, o, { ansicht: ansicht }));
      var el = bild(), w = el ? el.clientWidth : b, hh = el ? el.clientHeight : h;
      if (sx == null) { sx = w / 2; sy = hh / 2; }
      ansicht = ansichtMit(ortBei(sx, sy), sx, sy, a.massstab * mal);
      zeichnen();
    }
    // Stelle relativ zum Bild, wie es vor der Geste lag (während der Geste ist es verschoben und vergrößert)
    var ursprung = null;
    function stelle(ev) { var r = ursprung || bild().getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
    function aktivieren(an) {
      aktiv = an;
      huelle.classList.toggle("ik-aktiv-karte", an);
    }
    knoepfe.addEventListener("click", function (ev) {
      var z = ev.target.closest("[data-zoom]");
      if (!z) return;
      ev.stopPropagation();
      if (z.dataset.zoom === "ganz") { ansicht = null; zeichnen(); return; }
      zoomen(z.dataset.zoom === "rein" ? 2 : 0.5);
    });
    huelle.addEventListener("wheel", function (ev) {
      if (!aktiv && !ev.ctrlKey) {                                     // sonst blättert das Mausrad wie gewohnt die Seite
        if (!ev.target.closest(".ik-zoom")) hinweis("Zum Zoomen in die Karte klicken – oder Strg und Mausrad");
        return;
      }
      if (!bild() || ev.target.closest(".ik-zoom")) return;
      ev.preventDefault();
      var p = stelle(ev);
      zoomen(Math.pow(1.0018, -ev.deltaY * (ev.deltaMode === 1 ? 33 : 1)), p.x, p.y);
    }, { passive: false });
    document.addEventListener("pointerdown", function (ev) { if (aktiv && !o.sofort && !huelle.contains(ev.target)) aktivieren(false); });
    // Finger ohne vorheriges Antippen: der Browser blättert die Seite und bricht den Zeiger ab – dann kurz erklären
    var fremd = null;
    huelle.addEventListener("pointercancel", function (ev) {
      if (fremd === ev.pointerId && !aktiv) hinweis("Zum Verschieben und Zoomen erst auf die Karte tippen");
      fremd = null;
    });
    huelle.addEventListener("pointerdown", function (ev) {
      if (!bild() || ev.target.closest(".ik-zoom") || ev.target.closest(".ik-ziehbar")) return;
      if (ev.pointerType === "touch" && !aktiv) { fremd = ev.pointerId; return; }   // erst antippen (siehe click)
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      if (bild().classList.contains("ik-spielt")) return;
      if (!Object.keys(zeiger).length) ursprung = bild().getBoundingClientRect();
      zeiger[ev.pointerId] = stelle(ev);
      if (!a) a = ausschnitt(stationenVon(), b, h, Object.assign({}, o, { ansicht: ansicht }));
      var ids = Object.keys(zeiger);
      if (ids.length > 2) return;
      var p1 = zeiger[ids[0]], p2 = zeiger[ids[1]] || p1;
      geste = { mitte0: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, abstand0: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1, zwei: ids.length === 2,
        bewegt: geste ? geste.bewegt : false, mal: 1, mitte: null };
      geste.mitte = geste.mitte0;
      try { huelle.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
    });
    huelle.addEventListener("pointermove", function (ev) {
      if (!geste || !zeiger[ev.pointerId]) return;
      zeiger[ev.pointerId] = stelle(ev);
      var ids = Object.keys(zeiger), p1 = zeiger[ids[0]], p2 = zeiger[ids[1]] || p1;
      var mitte = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, mal = geste.zwei && ids.length === 2 ? Math.hypot(p2.x - p1.x, p2.y - p1.y) / geste.abstand0 : 1;
      if (!geste.bewegt && Math.hypot(mitte.x - geste.mitte0.x, mitte.y - geste.mitte0.y) < 6 && Math.abs(mal - 1) < 0.04) return;
      geste.bewegt = true; geste.mal = mal; geste.mitte = mitte;
      var el = bild();
      el.style.transformOrigin = "0 0";
      el.style.transform = "translate(" + (mitte.x - mal * geste.mitte0.x).toFixed(1) + "px," + (mitte.y - mal * geste.mitte0.y).toFixed(1) + "px) scale(" + mal.toFixed(4) + ")";
    });
    function ende(ev) {
      if (!zeiger[ev.pointerId]) return;
      delete zeiger[ev.pointerId];
      if (!geste) return;
      var g = geste;
      geste = null;
      if (Object.keys(zeiger).length) {                                  // ein Finger bleibt liegen: mit ihm weiter verschieben
        var rest = zeiger[Object.keys(zeiger)[0]];
        if (g.bewegt) { ansicht = ansichtMit(ortBei(g.mitte0.x, g.mitte0.y), g.mitte.x, g.mitte.y, a.massstab * g.mal); zeichnen(); }
        ursprung = bild().getBoundingClientRect();
        rest = zeiger[Object.keys(zeiger)[0]];
        geste = { mitte0: rest, mitte: rest, abstand0: 1, zwei: false, bewegt: g.bewegt, mal: 1 };
        return;
      }
      ursprung = null;
      if (!g.bewegt) return;
      ansicht = ansichtMit(ortBei(g.mitte0.x, g.mitte0.y), g.mitte.x, g.mitte.y, a.massstab * g.mal);
      zeichnen();
      // der Klick am Ende einer Geste soll keine Marke öffnen
      var weg = function (e) { e.stopPropagation(); e.preventDefault(); huelle.removeEventListener("click", weg, true); };
      huelle.addEventListener("click", weg, true);
      setTimeout(function () { huelle.removeEventListener("click", weg, true); }, 400);
    }
    huelle.addEventListener("pointerup", ende);
    huelle.addEventListener("pointercancel", ende);
    huelle.addEventListener("click", function (ev) {
      if (ev.target.closest(".ik-zoom")) return;
      if (!aktiv) aktivieren(true);
    });
    if (o.sofort) aktivieren(true);
    zeichnen();
    return {
      zeichnen: function (neueOptionen) { if (neueOptionen) Object.assign(o, neueOptionen); zeichnen(); },
      zoomen: zoomen,
      ansicht: function () { return ansicht; },
      ausschnitt: function () { return a; },
      aktiv: function () { return aktiv; }
    };
  }

  var api = { MAX_MASSSTAB: MAX_MASSSTAB, MAX_ZOOM: MAX_ZOOM, bedienen: bedienen, svg: svg, ausschnitt: ausschnitt, entschluesseln: entschluesseln, beschneiden: beschneiden, massstab: massstab,
    verkehrsmittel: verkehrsmittel, km: km, BILDER: BILDER, abspielen: abspielen,
    linieSchneiden: linieSchneiden, verschluesseln: verschluesseln, datenAusschnitt: datenAusschnitt, datenJs: datenJs };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  wurzel.ImagicruiseKarte = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
