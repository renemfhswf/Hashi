# Hashi – Hashiwokakero-Rätselgenerator & Spieler

Eine minimalistische Webapp zum **Lösen von Hashiwokakero** (auch „Hashi" oder
„Brücken-Inseln"). Die App erzeugt Rätsel, prüft sie mit einem eigenen Solver
und lässt dich lösen – komplett im Browser, ohne Backend und ohne
Abhängigkeiten.

<!-- Optional: Screenshot hier einbinden -->
<!-- ![Vorschau](docs/preview.png) -->

---

## ✨ Funktionen

| | |
|---|---|
| **Rätselgenerator** | Erzeugt dichte Rätsel in vier Schwierigkeitsgraden (12 – 56 Inseln) |
| **Eindeutig lösbar** | Jedes Rätsel wird per Solver geprüft – es gibt immer **genau eine** Lösung |
| **Seed & Teilen** | Gleicher Seed + Schwierigkeit = gleiches Rätsel. Per Link teilbar |
| **Spielkomfort** | Undo/Redo, Hinweis, Lösung prüfen, Lösung einblenden, Timer |
| **Drucken** | Einzelnes Rätsel als sauberes A4-Blatt ausgeben |
| **Rätselheft** | Bis zu 100 Rätsel im DIN-A6-Format (1–2 pro Seite, gemischte Grade) |
| **Ohne Build** | Reines JavaScript (ES-Module) – läuft direkt aus dem Repository |
| **Ohne Dependencies** | Kein npm-Paket, kein Framework, kein Bundler |
| **Hell/Dunkel** | Folgt der Systemeinstellung, manuell umschaltbar |
| **Responsive** | Nutzt auf Handy, Tablet und Desktop |
| **Tastaturkürzel** | `N` neu · `U` zurück · `H` Hinweis · `C` prüfen · `S` Lösung · `P` drucken |

### Spielregeln

1. Verbinde alle Inseln mit Brücken – zwischen zwei Inseln sind maximal **zwei**
   Brücken erlaubt.
2. Jede Insel trägt so viele Brücken, wie ihre Zahl angibt.
3. Brücken dürfen sich **nicht kreuzen** und nicht über Inseln führen.
4. Am Ende muss alles ein **zusammenhängendes** Netz sein.

### Bedienhinweise

* **Fertige Inseln** werden automatisch diagonal von links unten nach rechts oben
  durchgestrichen – sobald ihre Brücken vollständig sind, lässt sich dort nichts
  mehr ergänzen. Die Zahl bleibt durch einen weißen Halo lesbar.
* **Hilfslinien**: Das gepunktete Raster läuft durch die Inseln; der Rahmen
  markiert das Spielfeld.
* Klicke auf die Lücke zwischen zwei Inseln, um eine Brücke zu setzen, oder ziehe
  von Insel zu Insel. Erneutes Klicken macht aus einer Brücke eine Doppelbrücke,
  ein drittes entfernt sie.

---

## 🖨 Drucken & Rätselheft

### Einzelnes Rätsel drucken

Im Spiel genügt ein Klick auf **Drucken** (oder Taste `P`). Es öffnet sich der
Druckdialog mit einem sauberen A4-Bogen: Titel, Aufgabengitter mit
Hilfslinien und Rahmen sowie Platz für Name und Datum. Die Brücken des
Spielers werden dabei **nicht** gedruckt – das Blatt ist eine frische
Kopie des Rätsels.

### Rätselheft (DIN A6)

Die Seite [`puzzlebook.html`](puzzlebook.html) erzeugt ein ganzes Heft:

* **Erzeugung auf Knopfdruck**: Beim Aufruf der Seite wird **nichts**
  erzeugt. Erst der Knopf *„Heft erzeugen"* startet die Erzeugung; alle
  anderen Schalter verändern nur die Einstellungen. Die Vorschau meldet,
  wenn die Einstellungen veraltet sind.
* **1 oder 2 Rätsel pro Seite** – nie mehr als zwei, damit die Zahlen
  lesbar bleiben.
* **Automatische Anpassung**: sind die Raster zu gross, wird automatisch nur
  **ein** Rätsel pro Seite gesetzt. Die Anordnung (untereinander oder
  nebeneinander) richtet sich nach der Form des Rasters.
* **Inseln pro Rätsel** frei wählbar (40/60/80/**100**). Etwa 100 Inseln
  füllen eine DIN-A6-Seite genau aus.
* **Mehrere Schwierigkeitsgrade**: Leicht, Mittel, Schwer und Experte lassen
  sich kombinieren – die Rätsel werden dann abwechselnd gemischt.
* **Bis zu 100 Rätsel** pro Heft (frei wählbar, oder über die Presets
  8/20/50/100). Die Erzeugung läuft in Etappen, damit die Seite bedienbar
  bleibt. Ein Heft mit 100 Rätseln zu 100 Inseln braucht rund **6–10
  Minuten** – bei laufendem Fortschrittsbalken.
* **Optionale Lösungsseiten** am Ende des Hefts.
* **Einheitliche Optik**: Die Rätsel werden in echten Millimetern gezeichnet.
  Inseln, Zahlen und Brücken sind dadurch auf **jeder Seite gleich gross** –
  unabhängig von der Grösse des Rasters.
* **Seed**: gleicher Seed ⇒ gleiches Heft, per Link teilbar.
* Unter jedem Rätsel stehen **Nummer, Schwierigkeitsgrad und Seed**. Die
  Nummer läuft durchlaufend über das ganze Heft (1, 2, 3 …) und passt zur
  gleich nummerierten Lösungsseite.

Beim Drucken bitte im Druckdialog **DIN A6** und **100 % Skalierung** wählen
(das Seitenformat steckt bereits im CSS, manche Browser übernehmen es aber
nicht).

> **Hinweis zur Reihenfolge der Stylesheets:** `booklet.css` wird nach
> `styles.css` geladen. Nur so gewinnt die `@page`-Regel für DIN A6 gegen die
> A4-Regel des Spiels. Die Druckregel des Spiels ist zusätzlich auf
> `.app--game` eingegrenzt, damit das Heft (gleiche Grundklasse `.app`)
> beim Drucken nicht verschwindet.

Die Aufteilung rechnet das Modul [`js/layout.js`](js/layout.js) aus – es
prüft für jedes Rätsel, wie gross eine Rasterzelle in Millimetern würde, und
verhindert so unleserlich kleine Ausgaben.

---

## 🚀 Hosting auf GitHub Pages

Das Projekt braucht **keinen Build-Schritt** – die Dateien im Repository sind
bereits die Website. Es gibt zwei Wege; **Variante A** ist die empfohlene.

### Variante A – GitHub Actions (empfohlen)

Der mitgelieferte Workflow `.github/workflows/pages.yml` veröffentlicht die
Seite bei jedem Push auf `main` automatisch und führt vorher die Tests aus.

**Schritt 1 – Repository anlegen**

1. Auf [github.com/new](https://github.com/new) ein neues Repository erstellen.
2. Name z. B. `hashi`, Sichtbarkeit *Public* (nötig für den kostenlosen Pages-Tarif).
3. **„Add a README file"** etc. abwählen – das Repository soll leer sein.

**Schritt 2 – Code hochladen**

Im Projektordner:

```bash
git init
git add .
git commit -m "Hashi: Hashiwokakero-App"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/hashi.git
git push -u origin main
```

Oder ohne Git-Kenntnisse: auf GitHub **„uploading an existing file"** klicken
und alle Dateien samt `.github`-Ordner hochladen (der versteckte Ordner
`.github` muss dabei sichtbar/aktiviert sein).

**Schritt 3 – Pages aktivieren**

1. Repository → **Settings** → **Pages**.
2. Unter *Build and deployment* bei **Source** auf **„GitHub Actions"** stellen.
3. Speichern. Der erste Lauf startet automatisch mit dem Push aus Schritt 2.

**Schritt 4 – fertig**

Nach ca. 1–2 Minuten ist die App online:

```
https://DEIN-NAME.github.io/hashi/
```

Der Fortschritt ist unter **Actions** → *CI & Deploy* einzusehen. Wird die
Seite nach Änderungen nicht aktualisiert, hilft ein erneuter Push oder ein
manueller Lauf über *Actions* → *CI & Deploy* → *Run workflow*.

> **Eigene Domain?** Unter *Settings* → *Pages* → *Custom domain* eintragen.
> Für eine Apex-Domain (`example.com`) muss zusätzlich bei dem Domain-Anbieter
> ein DNS-Eintrag `A` auf die IP-Adressen von GitHub Pages gesetzt werden.

### Variante B – Direkt aus dem Branch (ohne Actions)

1. Repository → **Settings** → **Pages**.
2. *Source* auf **„Deploy from a branch"** stellen.
3. Branch **main**, Ordner **/(root)** wählen → **Save**.

Die Seite ist danach unter `https://DEIN-NAME.github.io/hashi/` erreichbar.
Jeder Push auf `main` veröffentlicht sofort neu.

> **Hinweis:** Die Testsuite läuft bei dieser Variante nicht automatisch.
> Du kannst sie lokal mit `npm test` ausführen.

### Variante C – Ohne GitHub, lokal testen

```bash
# Python (vorinstalliert auf macOS/Linux)
python3 -m http.server 8000
# oder mit Node
npx --yes serve .
```

Dann `http://localhost:8000` öffnen.

> ⚠️ **Wichtig:** Die Datei `index.html` **nicht** per Doppelklick (`file://`)
> öffnen – Browser blockieren ES-Module auf `file://`. Ein lokaler
> Webserver ist Pflicht.

---

## 🧪 Tests

Die Testsuite prüft die erzeugten Rätsel formal auf Gültigkeit.

```bash
npm test          # einmalig
npm run test:watch  # während der Entwicklung
```

Getestet werden:

* **Regelkonformität** – keine Brücke über einer Insel, keine Kreuzungen,
  Inselzahlen 1–8, alle Inseln verbunden, Brückensumme passt zu den Zahlen.
* **Eindeutigkeit** – der Solver findet für jedes generierte Rätsel
  **genau eine** Lösung, und zwar genau die vom Generator angegebene.
* **Reproduzierbarkeit** – gleicher Seed ⇒ exakt gleiches Rätsel.
* **Solver** – korrekte Lösung, Erkennen von Mehrdeutigkeit und von
  unlösbaren Brettern.
* **Spielzustand** – Brücken setzen, Undo/Redo, Hinweise, Prüfung, Sieg.
* **Heft-Aufteilung** – höchstens zwei Rätsel pro Seite, automatische
  Reduktion auf eines bei zu grossen Rastern.
* **Zufallsgenerator** – Determinismus, Wertebereiche, Verteilungen.

Aktueller Stand: **132 Tests, alle grün.** Erzeugung eines Rätsels: ~10–40 ms.

### Schwierigkeitsgrade

| Grad | Inseln | Raster | Doppelbrücken |
|---|---|---|---|
| Leicht | 12 – 16 | 9 × 9 | ~22 % |
| Mittel | 20 – 26 | 11 × 11 | ~16 % |
| Schwer | 30 – 38 | 12 × 12 | ~10 % |
| Experte | 44 – 56 | 14 × 14 | ~6 % |
| Rätselheft (DIN A6) | 40 / 60 / 80 / **100** | 18 × 18 | ~5 % |

**Warum sinkt der Doppelbrücken-Anteil?** Je dichter das Brett, desto mehr
zufällige Ausrichtungen entstehen („Ablenk-Kanten"). Nur sie sind die Quelle
von Mehrdeutigkeit – und eine Doppelbrücke verschärft sie zusätzlich. Bei
100 Inseln liegt die Grenze bei etwa 5 %: darüber fällt die Quote
eindeutiger Rätsel von 100 % auf 20 %.

---

## 🧠 Wie der Generator funktioniert

Der Kern steckt in [`js/generator.js`](js/generator.js) – er arbeitet in vier
Schritten:

1. **Lösung wachsen lassen**
   Ausgehend von einer Zufallsinsel werden neue Inseln angehängt. Jede neue
   Insel erhält maximal eine zusätzliche „Ablenk-Kante" (eine Insel, die nur
   zufällig auf derselben Linie liegt). Kreuzungen und Brücken über Inseln
   werden von Anfang an verhindert. Ein Faktor sorgt dafür, dass sich die
   Inseln gleichmäßig über das Brett verteilen statt in einem Klumpen zu
   landen. Am Ende entsteht ein **Baum** aus Brücken – daraus ergeben sich
   die Inselzahlen.

2. **Eindeutigkeit herstellen**
   Ein zufällig gewachsenes Rätsel ist fast immer mehrdeutig. Ein
   Hill-Climbing-Verfahren verändert die Lösung so lange, bis der
   Constraint-Propagierer das Brett **allein durch Logik** auflösen kann.
   Das ist das entscheidende Kriterium: *Propagation entfernt nur Werte, die in
   keiner Lösung vorkommen können* – wer das Brett allein auflösen kann, hat
   damit garantiert **genau eine** Lösung.

3. **Nachprüfen**
   Unabhängig davon läuft der volle Solver über das fertige Brett. Findet er
   nicht genau eine Lösung, wird das Rätsel verworfen und neu erzeugt.

4. **Qualität auswählen**
   Aus mehreren gültigen Kandidaten gewinnt der interessanteste (mehr
   Inseln, mehr Doppelbrücken, abwechslungsreiche Zahlen). Zum Schluss wird
   das Brett auf den kleinsten umschliessenden Rechteck beschnitten.

Der Solver in [`js/solver.js`](js/solver.js) arbeitet mit Domänen pro Kante
(`0`, `1` oder `2` Brücken) und den drei Propagationsregeln
**Insel-Summe**, **Kreuzungsverbot** und **Konnektivität**.

### Schwierigkeitsgrade anpassen

In [`js/generator.js`](js/generator.js) unter `DIFFICULTIES`:

```js
hard: {
  id: 'hard',
  label: 'Schwer',
  min: 30,        // minimale Inselzahl
  max: 38,        // maximale Inselzahl
  cols: 12, rows: 12,   // Rastergrösse
  double: 0.06,   // Wahrscheinlichkeit für Doppelbrücken
  maxExtra: 2,    // erlaubte "Ablenk-Kanten" je Insel
  tries: 60,      // Generierungsversuche
  maxRepair: 70,  // Iterationen der Reparaturschleife
  repairLimit: 32, // Reparaturschleife nur bis zu dieser Inselzahl
  keep: 2,        // Anzahl Kandidaten für die Qualitätsauswahl
},
```

**Hinweis zu großen Rätseln:** Je dichter das Brett, desto mehr „Ablenk-Kanten"
entstehen – also Kanten, die in der Lösung ohne Brücke bleiben. Sie sind die
einzige Quelle von Mehrdeutigkeit, und eine Doppelbrücke verschärft sie
zusätzlich. Deshalb sinkt der Doppelbrücken-Anteil mit wachsender
Inselzahl (siehe Tabelle oben) – und bei 100 Inseln bleibt er bei 5 %, weil
darüber die Quote eindeutiger Rätsel einbricht.

---

## 📁 Projektstruktur

```
hashi/
├── index.html                 # App-Oberfläche (Spiel)
├── puzzlebook.html            # Rätselheft-Generator (DIN A6)
├── favicon.svg
├── css/
│   ├── styles.css             # Design, Hell/Dunkel, Responsive, Druck
│   └── booklet.css             # Layout der A6-Druckbögen
├── js/
│   ├── app.js                 # Spiellogik, Verlauf, Timer, Speichern, Drucken
│   ├── board.js               # Brettmodell: Kanten, Kreuzungen, Nachbarschaft
│   ├── game.js                # Spielzustand: Brücken, Undo/Redo, Hinweise
│   ├── generator.js           # Rätselgenerator
│   ├── layout.js              # Seitenaufteilung des Rätselhefts
│   ├── render.js              # Canvas-Renderer + Trefferprüfung
│   ├── svg.js                 # SVG-Renderer (Druck & Heft)
│   ├── rng.js                 # deterministischer Zufallsgenerator (xmur3 + mulberry32)
│   ├── solver.js              # Constraint-Solver
│   └── booklet.js             # Logik der Heft-Erzeugung
├── tests/                     # Testsuite (node:test, ohne Dependencies)
├── .github/workflows/pages.yml
└── package.json
```

---

## 🛠 Anpassen

**Eigene Farben?** Alle Farben liegen als CSS-Custom-Properties in
`css/styles.css` unter `:root` (hell) und `[data-theme="dark"]` (dunkel).

**Eigene Rätsel teilen?** Das Feld *Seed & Teilen* zeigt den Seed. Wer den
Seed und die Schwierigkeit kennt, kann das exakt gleiche Rätsel laden –
oder den Link aus dem Browser kopieren (`#seed=…&d=…`).

**Technik:** Reines JavaScript mit ES-Modulen, Canvas-Frontend, keine
Laufzeit-Abhängigkeiten. `npm test` nutzt den in Node eingebauten
Test-Runner (`node:test`).

---

## 📄 Lizenz

MIT – siehe [LICENSE](LICENSE).
