// Prüft die eingebauten Bausteine in einem Projekt. Wird beim Einbauen mitkopiert (Quelle: Repo imagicosmos/bausteine).
// NICHT VON HAND ÄNDERN.
//
// Aufruf:  node pruefen.js [ordner] [pfad-zum-repo-bausteine]
//   ordner: der Ordner mit bausteine.json (Standard: der Ordner dieser Datei)
//   repo:   optional; wenn vorhanden, wird auch gemeldet, ob es eine neuere Version gibt
// Ergebnis: Exit-Code 1, wenn eine Datei fehlt oder von Hand geändert wurde; neuere Versionen sind nur ein Hinweis.
// In Tests:  const { pruefen } = require(".../bausteine/pruefen.js"); const r = pruefen(ordner); // { fehler: [], hinweise: [] }
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function pruefsumme(datei) {
  // Zeilenenden vereinheitlichen: Git kann unter Windows LF in CRLF umwandeln
  const text = fs.readFileSync(datei, "utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function versionAus(datei) {
  const m = /VERSION\s*=\s*"(\d+\.\d+\.\d+)"/.exec(fs.readFileSync(datei, "utf8"));
  return m ? m[1] : null;
}

function neuer(a, b) {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

function pruefen(ordner, repo) {
  const aus = { fehler: [], hinweise: [] };
  const liste = path.join(ordner, "bausteine.json");
  if (!fs.existsSync(liste)) { aus.fehler.push("bausteine.json fehlt in " + ordner); return aus; }
  const eingebaut = JSON.parse(fs.readFileSync(liste, "utf8"));
  for (const [name, b] of Object.entries(eingebaut.bausteine || {})) {
    for (const [datei, summe] of Object.entries(b.dateien || {})) {
      const voll = path.join(ordner, datei);
      if (!fs.existsSync(voll)) aus.fehler.push(name + ": " + datei + " fehlt");
      else if (pruefsumme(voll) !== summe) aus.fehler.push(name + ": " + datei + " wurde von Hand geändert. Fehler bitte im Repo bausteine beheben und neu einbauen.");
    }
    if (repo) {
      const quelle = path.join(repo, name, b.hauptdatei || "");
      if (b.hauptdatei && fs.existsSync(quelle)) {
        const v = versionAus(quelle);
        if (v && b.version && neuer(v, b.version)) aus.hinweise.push(name + ": Version " + v + " ist verfügbar (eingebaut: " + b.version + ")");
      }
    }
  }
  return aus;
}

module.exports = { pruefen, pruefsumme, versionAus };

if (require.main === module) {
  const ordner = path.resolve(process.argv[2] || __dirname);
  const repo = process.argv[3] ? path.resolve(process.argv[3]) : null;
  const r = pruefen(ordner, repo);
  r.hinweise.forEach(h => console.log("Hinweis: " + h));
  r.fehler.forEach(f => console.error("Fehler: " + f));
  if (!r.fehler.length) console.log("Bausteine in Ordnung.");
  process.exit(r.fehler.length ? 1 : 0);
}
