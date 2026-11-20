/* Baustein „zauberstab“ – Logo-Animation der Webseiten: Das I wird zum Zauberstab, kreist über „magic“, tippt auf das g –
   „magic“ färbt sich, die Farbe wandert zum farbigen Teil des Namens (chron, coll, clique, cruise, cosmos) und bleibt dort.
   Spielt einmal beim Laden und erneut, wenn man mit der Maus auf das Logo zeigt.
   Bei „Bewegung reduzieren“ (Systemeinstellung) bleibt das Logo still.

   Einstellen muss man fast nichts: Das Wort steht im Logo (.kopf .logo .logo-wort mit dem farbigen Teil als <span> darin),
   die Farben kommen aus dem fertigen Schriftzug in style.css (auch im Dunkelmodus). Nur die beiden Leuchtfarben
   stehen beim Einbinden:  <script src="bausteine/zauberstab.js" data-stern="#06b6d4" data-band="#67e8f9" defer></script>

   Zusammengeführt am 18.11.2026 aus den fünf gleichen Fassungen der Webseiten (Imagichron, Imagicoll, Imagiclique,
   Imagicruise, Imagicosmos; Grundlage: Imagicosmos mit Farbverlauf über mehrere Farben). Entwurf:
   imagicosmos/docs/entwuerfe/schriftzug-animation.html. Unter Node (Tests) gehen nur die Rechenteile. */
(function (wurzel) {
  "use strict";
  var VERSION = "1.0.0";
  const GROESSE = 150, GRUND = 236, RAND = 40, ENDE = 6.0;
  const klemm = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const weich = x => { x = klemm(x); return x * x * (3 - 2 * x); };
  const ausrollen = x => { x = klemm(x); return 1 - Math.pow(1 - x, 3); };
  const misch = (a, b, t) => a + (b - a) * t;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const farbe = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(misch(v, y[i], t))).join(",")})`; };
  const phase = (t, von, bis) => klemm((t - von) / (bis - von));
  const zuHex = (r, g, b) => "#" + [r, g, b].map(v => Math.round(+v).toString(16).padStart(2, "0")).join("");

  // Farben aus einem CSS-Wert lesen („linear-gradient(90deg, rgb(14, 116, 144), rgb(8, 145, 178))“, „rgb(…)“, „#0e7490“)
  function farbenLesen(css) {
    const aus = [], s = String(css || "");
    const re = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)[^)]*\)|#([0-9a-f]{6})\b/gi;
    let m;
    while ((m = re.exec(s))) aus.push(m[4] ? "#" + m[4].toLowerCase() : zuHex(m[1], m[2], m[3]));
    return aus;
  }
  // Stelle eines Buchstabens im Farbverlauf (0…1): „magi“ (Buchstaben 1 bis c-1) und der farbige Teil (c bis ende)
  // durchlaufen je den ganzen Verlauf – wie der fertige Schriftzug in style.css
  function stelle(i, c, ende) { return klemm(i < c ? (i - 1) / Math.max(1, c - 2) : (i - c) / Math.max(1, ende - c)); }
  // Farbe an einer Stelle des Verlaufs (beliebig viele Farben)
  function verlauf(farben, p) {
    if (farben.length < 2) return farbe(farben[0], farben[0], 0);
    const lage = klemm(p) * (farben.length - 1), stufe = Math.min(Math.floor(lage), farben.length - 2);
    return farbe(farben[stufe], farben[stufe + 1], lage - stufe);
  }

  // Ein Bild der Animation zum Zeitpunkt t (Sekunden).
  // a = { text: "Imagicoll", teil: [5, 8] (erster und letzter farbiger Buchstabe), farben: ["#…", "#…"], stern, band, tinte }
  function zeichne(ctx, a, t) {
    const w = a, text = w.text, letzter = text.length - 1, [c, ende] = w.teil, TINTE = w.tinte || "#1f2430";
    ctx.font = `700 ${GROESSE}px "Josefin Sans"`; ctx.textBaseline = "alphabetic";
    const x0 = RAND;
    const xs = [...text].map((_, i) => x0 + ctx.measureText(text.slice(0, i)).width);
    const bs = [...text].map((_, i) => ctx.measureText(text.slice(0, i + 1)).width - ctx.measureText(text.slice(0, i)).width);
    const kappe = GRUND - GROESSE * .72, mitte = i => xs[i] + bs[i] / 2;

    /* Ablauf (Sekunden) */
    const tStab = phase(t, .35, .95), TIPP = 2.65;
    const tWandern = phase(t, 3.4, 4.6), tZurueck = phase(t, 4.65, 5.35), tI = phase(t, 5.3, 5.7), tReset = phase(t, 7.6, 8.1);

    /* Farbanteil je Buchstabe */
    const anteil = [], huepf = [];
    const ziel = mitte(3), gOben = GRUND - GROESSE * .5 - 3, front1 = misch(.5, c, weich(tWandern)), front2 = misch(c + .5, ende + 1, weich(tWandern));
    for (let i = 0; i <= letzter; i++) {
      let a = 0, h = 0;
      if (i >= 1 && i <= c) {
        const p = phase(t, TIPP + Math.abs(i - 3) * .07, TIPP + Math.abs(i - 3) * .07 + .3);
        a = weich(p); h = Math.sin(Math.PI * p) * (p > 0 && p < 1 ? 1 : 0);
        if (i < c) a *= 1 - weich(front1 - i);
      } else if (i > c) {
        const q = klemm(front2 - i); a = weich(q); h = Math.sin(Math.PI * q) * .7;
      }
      anteil.push(a * (1 - weich(tReset))); huepf.push(h);
    }

    /* Buchstaben: kein Hüpfen, beim Verzaubern nur ein weiches Leuchten */
    for (let i = 0; i <= letzter; i++) {
      let alpha = 1;
      if (i === 0) {
        alpha = 1 - (weich(tStab) * (1 - weich(tI)));
        /* Das I bleibt als Umriss (Rahmen) stehen, solange es Zauberstab ist */
        if (alpha < 1) {
          ctx.save(); ctx.globalAlpha = (1 - alpha) * .8; ctx.strokeStyle = TINTE; ctx.lineWidth = 3; ctx.lineJoin = "round";
          ctx.textAlign = "center"; ctx.strokeText(text[0], mitte(0), GRUND); ctx.restore();
        }
      }
      if (alpha <= 0) continue;
      ctx.save(); ctx.globalAlpha = alpha;
      const marke = verlauf(w.farben, stelle(i, c, ende));
      ctx.fillStyle = anteil[i] > 0 ? farbe(TINTE, "#" + marke.match(/\d+/g).map(v => (+v).toString(16).padStart(2, "0")).join(""), anteil[i]) : TINTE;
      if (huepf[i] > 0) { ctx.shadowColor = w.band; ctx.shadowBlur = 26 * huepf[i]; }
      ctx.textAlign = "center"; ctx.fillText(text[i], mitte(i), GRUND);
      ctx.restore();
    }

    /* Leuchtpunkt (weicher Lichtfleck statt Comic-Stern) */
    const licht = (x, y, r, farbe1, staerke) => {
      if (r <= 0 || staerke <= 0) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${staerke})`);
      g.addColorStop(.25, farbe1 + Math.round(staerke * 200).toString(16).padStart(2, "0"));
      g.addColorStop(1, farbe1 + "00");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };

    /* Zauberstab-Haltung zu jeder Zeit: Griff (x, y), Winkel w (0 = senkrecht nach oben), Länge L */
    const L0 = GROESSE * .72, L1 = 150, sanft = x => { x = klemm(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    const ausSpitze = (px, py, w, L) => ({ x: px - Math.sin(w) * L, y: py + Math.cos(w) * L, w, L });
    /* Gehaltener Stab: Der Griff bleibt ruhig in der Hand, nur die Spitze kreist (Drehen aus dem Handgelenk).
       Kreis im Raum → in der Ansicht schwingt der Winkel, und der Stab wirkt vorn/hinten etwas kürzer (Verkürzung). */
    const GRIFF = ausSpitze(ziel, gOben, 2.1, L1), K0 = 1.1, K1 = 2.4, WK = 1.8;
    /* Eine durchgehende Bewegung: Kreisen beginnt schon beim Anheben, gleichmäßiges Tempo, aus dem Kreis heraus aufs g tippen */
    const T0 = .38, KB = .75, OMEGA = 2.5 * Math.PI / (K1 - KB);          // Winkel läuft gleichmäßig; bei K1 bewegt sich die Spitze gerade abwärts
    const kreisHaltung = t => {
      const a = OMEGA * (t - KB);
      const amp = weich(phase(t, KB, KB + .55)) * (1 - sanft(phase(t, K1, TIPP)));
      const tw = phase(t, K1, TIPP), basisW = misch(WK, 2.1, tw * tw);                // zum g hin schneller werden
      return { x: GRIFF.x - 7 * amp * Math.sin(a), y: GRIFF.y - 5 * amp * (Math.cos(a) - 1),
               w: basisW + .27 * amp * Math.sin(a), L: L1 * (1 - .1 * amp + .1 * amp * Math.cos(a)) };
    };
    const ruhe = { x: mitte(0), y: GRUND, w: 0, L: L0 };
    const tippH = { ...GRIFF, w: 2.1 };
    /* Weg zwischen „I“ und Kreis in hohem Bogen (Griff steigt, Stab kippt früh – nicht über das m) */
    const bogen = (a, b, p) => ({ x: misch(a.x, b.x, p), y: misch(a.y, b.y, p) - 60 * Math.sin(Math.PI * p),
                                   w: misch(a.w, b.w, sanft(klemm(p / .6))), L: misch(a.L, b.L, p) });
    const haltung = t => {
      if (t < TIPP) {
        const ziel = kreisHaltung(t), p = weich(phase(t, T0, 1.65));
        return p < 1 ? bogen(ruhe, ziel, p) : ziel;
      }
      if (t < 4.65) { const g = { ...tippH }, n = t - TIPP; if (n < .5) g.w -= Math.sin(n / .5 * Math.PI) * .05; return g; }
      return bogen(ruhe, tippH, 1 - sanft(tZurueck));
    };
    const spitzeVon = g => ({ x: g.x + Math.sin(g.w) * (g.L + 2), y: g.y - Math.cos(g.w) * (g.L + 2) });

    /* Lichtspur der kreisenden Spitze */
    if (t > K0 && t < TIPP + .3) {
      for (let k = 1; k <= 18; k++) {
        const tk = t - k * .022; if (tk < KB + .3 || tk > TIPP) continue;
        const sp = spitzeVon(haltung(tk));
        licht(sp.x, sp.y, 9 - k * .35, w.band, (1 - k / 18) * .55);
      }
    }

    /* Zauberstab zeichnen: gerader dunkler Stab mit farbiger Spitze, Leuchten an der Spitze */
    const stabSichtbar = weich(tStab) * (1 - weich(tI));
    if (stabSichtbar > 0) {
      const g = haltung(t), stab = 17;
      ctx.save(); ctx.globalAlpha = stabSichtbar; ctx.translate(g.x, g.y); ctx.rotate(g.w);
      ctx.fillStyle = TINTE; ctx.beginPath(); ctx.roundRect(-stab / 2, -g.L, stab, g.L, 4); ctx.fill();
      const bandL = g.L * .2 * weich(tStab);
      ctx.fillStyle = w.band; ctx.beginPath(); ctx.roundRect(-stab / 2 + 2, -g.L + 2, stab - 4, bandL, 3); ctx.fill();
      ctx.restore();
      const sp = spitzeVon(g);
      const glimmen = weich(phase(t, .8, 1.2)) * (1 - weich(tZurueck)) * stabSichtbar;
      const blitz = Math.max(0, 1 - Math.abs(t - TIPP) / .25);
      licht(sp.x, sp.y, 15 + 24 * blitz + 2 * Math.sin(t * 6), w.band, Math.min(1, glimmen * (.6 + .4 * blitz)));
    }

    /* Beim Tippen: ein Lichtring breitet sich aus, feiner Staub schwebt nach oben */
    const nach = t - TIPP;
    if (nach > 0 && nach < .7) {
      const p = nach / .7;
      ctx.save(); ctx.globalAlpha = (1 - p) * .55; ctx.strokeStyle = w.band; ctx.lineWidth = 3 * (1 - p) + .5;
      ctx.beginPath(); ctx.ellipse(ziel, gOben, 20 + 120 * ausrollen(p), (20 + 120 * ausrollen(p)) * .45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    const staub = (x0, y0, t0, anzahl, dauer, streu) => {
      for (let k = 0; k < anzahl; k++) {
        const p = (t - t0 - k * .04) / dauer;
        if (p <= 0 || p >= 1) continue;
        const x = x0 + Math.sin(k * 2.39) * streu * ausrollen(p) + Math.sin(p * 6 + k) * 4, y = y0 - 70 * ausrollen(p) * (.6 + (k % 5) / 8);
        licht(x, y, 5 + (k % 3) * 2, k % 2 ? w.band : w.stern, (1 - p) * .9);
      }
    };
    staub(ziel, gOben, TIPP, 16, 1.1, 70);
    /* Schimmer, der mit der Farbe nach rechts zieht */
    if (tWandern > 0 && tWandern < 1.05) {
      const fx = misch(mitte(3), mitte(ende), weich(tWandern));
      for (let k = 0; k < 8; k++) {
        const p = (t * 1.6 + k / 8) % 1;
        licht(fx + Math.sin(k * 2.1) * 46 - p * 30, kappe + 20 - p * 70 + Math.cos(k) * 10, 6 * (1 - p) + 3, k % 2 ? w.band : w.stern, (1 - p) * .8 * Math.sin(Math.PI * klemm(tWandern * 1.1)));
      }
    }
  }

  // ---------- Auf der Webseite: Logo finden, Farben lesen, abspielen ----------
  function starten(skript) {
    const doc = wurzel.document;
    const logo = doc.querySelector(".kopf .logo"), wortEl = logo && logo.querySelector(".logo-wort");
    const teilEl = wortEl && wortEl.querySelector("span");
    if (!teilEl || !doc.createElement("canvas").getContext || wurzel.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    const daten = (skript && skript.dataset) || {};
    const text = wortEl.textContent.trim(), c = text.length - teilEl.textContent.trim().length;
    // Farben des fertigen Schriftzugs (style.css) – kurz ohne die Zauber-Klassen lesen, damit der Verlauf sichtbar ist
    const farbenJetzt = () => {
      const vorher = wortEl.className;
      wortEl.classList.remove("zauber-vorher", "zaubert");
      let f = farbenLesen(wurzel.getComputedStyle(teilEl).backgroundImage);
      if (!f.length) f = farbenLesen(wurzel.getComputedStyle(teilEl).color);
      wortEl.className = vorher;
      return f.length ? f : ["#1f2430"];
    };
    const ersteFarben = farbenJetzt();
    const angaben = { text, teil: [c, text.length - 1], farben: ersteFarben,
                      stern: daten.stern || ersteFarben[ersteFarben.length - 1], band: daten.band || ersteFarben[ersteFarben.length - 1] };
    wortEl.classList.add("zauber-vorher");             // der farbige Teil zunächst in Schriftfarbe – die Farbe kommt erst durch den Zauber
    const alsHex = f => { const m = f.match(/\d+(\.\d+)?/g) || [31, 36, 48]; return zuHex(m[0], m[1], m[2]); };
    let laeuft = false;

    function abspielen() {
      if (laeuft) return; laeuft = true;
      angaben.farben = farbenJetzt();                  // Hell oder Dunkel kann inzwischen umgeschaltet sein
      const fs = parseFloat(wurzel.getComputedStyle(wortEl).fontSize), s = fs / GROESSE, dpr = Math.min(wurzel.devicePixelRatio || 1, 3);
      const mess = doc.createElement("canvas").getContext("2d");
      mess.font = `700 ${GROESSE}px "Josefin Sans"`;
      const breite = mess.measureText(text).width, W = breite + 2 * RAND, H = 300;
      const marke = doc.createElement("span"); marke.style.cssText = "display:inline-block;width:0;height:0";
      wortEl.prepend(marke);
      const grundlinie = marke.getBoundingClientRect().top - wortEl.getBoundingClientRect().top; marke.remove();
      const cv = doc.createElement("canvas");
      cv.width = Math.ceil(W * s * dpr); cv.height = Math.ceil(H * s * dpr);
      cv.setAttribute("aria-hidden", "true"); cv.className = "zauber-flaeche";
      cv.style.cssText = `width:${W * s}px;height:${H * s}px;left:${-RAND * s}px;top:${grundlinie - GRUND * s}px`;
      wortEl.append(cv); wortEl.classList.add("zaubert");
      angaben.tinte = alsHex(wurzel.getComputedStyle(logo).color);
      const ctx = cv.getContext("2d"), t0 = wurzel.performance.now();
      const bild = jetzt => {
        const t = (jetzt - t0) / 1000;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
        zeichne(ctx, angaben, Math.min(t, ENDE));
        if (t < ENDE) return wurzel.requestAnimationFrame(bild);
        wortEl.classList.remove("zaubert", "zauber-vorher"); cv.remove(); laeuft = false;
      };
      wurzel.requestAnimationFrame(bild);
    }

    doc.fonts.load(`700 ${GROESSE}px "Josefin Sans"`).then(() => {
      setTimeout(abspielen, 500);
      logo.addEventListener("mouseenter", () => { if (!laeuft) { wortEl.classList.add("zauber-vorher"); abspielen(); } });
    }).catch(() => wortEl.classList.remove("zauber-vorher"));
    return angaben;
  }

  const api = { VERSION, ENDE, farbenLesen, stelle, verlauf, zeichne, starten };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  wurzel.ImagicosmosZauberstab = api;
  if (wurzel.document && wurzel.document.currentScript) api.angaben = starten(wurzel.document.currentScript);
})(typeof globalThis !== "undefined" ? globalThis : this);
