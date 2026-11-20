/* Imagicruise – Reisebericht: Hell/Dunkel schon vor dem Zeichnen setzen (kein Aufblitzen). Eigene Datei statt Skript
   im Seitenkopf, damit die Seite nur Skripte aus eigenen Dateien erlaubt (Content-Security-Policy im <head>).
   Hell ist voreingestellt; dunkel nach eigener Wahl oder wenn das Gerät auf dunkel steht. */
(function () {
  var m = null, h = document.documentElement;
  try { m = localStorage.getItem("imagicruise-bericht-modus"); } catch (e) { /* z. B. als Datei geöffnet */ }
  if (m !== "hell" && m !== "dunkel") m = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dunkel" : "hell";
  h.dataset.modus = m;
})();
