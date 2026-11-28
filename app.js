/* Imagicruise – Webseite: Hell/Dunkel, Laufband, Einblenden, Bilder vergrößern.
   Einfaches JavaScript ohne Bibliotheken. Der Modus wird schon im <head> gesetzt (kein Aufblitzen). */
(function () {
  "use strict";
  var html = document.documentElement;
  var SPEICHER = "imagicruise-webseite-modus";

  // ---------- Hell/Dunkel ----------
  var knopf = document.getElementById("modus-knopf");
  function knopfBeschriften() {
    var hell = html.dataset.modus !== "dunkel";
    knopf.setAttribute("aria-label", hell ? "Zu dunklem Design wechseln" : "Zu hellem Design wechseln");
    knopf.title = hell ? "Dunkel" : "Hell";
  }
  if (knopf) {
    knopf.addEventListener("click", function () {
      var neu = html.dataset.modus === "dunkel" ? "hell" : "dunkel";
      html.dataset.modus = neu;
      try { localStorage.setItem(SPEICHER, neu); } catch (e) {}
      knopfBeschriften();
    });
    knopfBeschriften();
  }

  // ---------- Laufband mit den Namen der Vorlagen (doppelt, damit es nahtlos läuft) ----------
  var band = document.getElementById("laufband");
  if (band) {
    var teile0 = band.getAttribute("data-woerter").split("|").map(function (w) { return "<span>" + w + "</span><span>✦</span>"; }).join("");
    band.innerHTML = teile0 + teile0;
  }

  // ---------- Überschrift: wechselnde Wörter (data-woerter) ----------
  // Wer Bewegung abgeschaltet hat, sieht fest den Text aus data-ruhig.
  var wechsel = document.getElementById("wechsel");
  if (wechsel) {
    var woerter = wechsel.getAttribute("data-woerter").split("|");
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      wechsel.textContent = wechsel.getAttribute("data-ruhig");
    } else {
      var nr = 0;
      setInterval(function () {
        if (document.hidden) return;
        wechsel.classList.add("weg");
        setTimeout(function () {
          nr = (nr + 1) % woerter.length;
          wechsel.textContent = woerter[nr];
          wechsel.classList.remove("weg");
        }, 450);
      }, 2800);
    }
  }

  // ---------- Einblenden beim Scrollen ----------
  var teile = document.querySelectorAll(".zeigen");
  if (html.classList.contains("js") && "IntersectionObserver" in window) {
    var beob = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("sichtbar"); beob.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    teile.forEach(function (t) { beob.observe(t); });
  } else {
    teile.forEach(function (t) { t.classList.add("sichtbar"); });
  }

  // ---------- Bilder vergrößern (ohne JavaScript öffnet der Link einfach das Bild) ----------
  var lupe = document.getElementById("lupe");
  if (lupe && typeof lupe.showModal === "function") {
    var lupeBild = document.getElementById("lupe-bild"), lupeText = document.getElementById("lupe-text");
    document.querySelectorAll(".bild-link").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var img = a.querySelector("img"), cap = a.parentNode.querySelector("figcaption");
        lupeBild.src = a.getAttribute("href");
        lupeBild.alt = img ? img.alt : "";
        lupeText.textContent = cap ? cap.textContent : "";
        lupe.showModal();
      });
    });
    document.getElementById("lupe-zu").addEventListener("click", function () { lupe.close(); });
    lupe.addEventListener("click", function (e) { if (e.target === lupe) lupe.close(); });
  }

})();
