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
* **Inseln pro Rätsel** ergeben sich automatisch aus der Schwierigkeit –
  gewählt wird jeweils die größtmögliche Anzahl, die den
  Schwierigkeitsgrad auf einer A6-Seite noch erfüllt (rund 30 / 46 / 65 / 100).
* **Schwierigkeit als Zielvorgabe**: Der Generator sucht ein Raster, auf dem
  das Rätsel *gemessen* in die gewählte Stufe fällt. Unter jedem Rätsel steht
  die gemessene Stufe.
* **Bis zu 100 Rätsel** pro Heft (frei wählbar, oder über die Presets
  8/20/50/100). Die Erzeugung läuft in Etappen, damit die Seite bedienbar
  bleibt. Ein Heft mit 100 Rätseln zu 100 Inseln braucht rund **2 Minuten**.
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

| Grad | Inseln | Raster | Doppelbrücken | Zeit je Rätsel |
|---|---|---|---|---|
| Leicht | 16 – 46 | 14 × 14 | ~10 % | 15 ms |
| Mittel | 22 – 58 | 16 × 16 | ~20 % | 25 ms |
| Schwer | 34 – 64 | 19 × 19 | ~30 % | 40 ms |
| Experte | 44 – 74 | 23 × 23 | ~40 % | 70 ms |
| Rätselheft (DIN A6) | ~30 / 46 / 65 / **100** | bis 22 × 22 | ~12 % | ~1 s |

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

### Anregung: variable Brückenlänge

Die Idee, Brücken über **ein oder mehrere freie Felder** zu führen statt immer
nur über eines, stammt aus
[erthium/hashiwokakero](https://github.com/erthium/hashiwokakero) (GPL-3.0).
Die Umsetzung in diesem Projekt ist eigenständig in JavaScript; das Projekt
steht unter MIT.

Der Effekt ist erstaunlich groß – gemessen bei 100 Inseln:

| Brückenlänge | Versuche je eindeutigem Rätsel | Zeit |
|---|---|---|
| nur 1–2 Felder | 11,6 | 15,9 s |
| bis 3 Felder | **2,9** | **1,0 s** |
| bis 6 Felder | 3,6 | 0,6 s |

Grund: längere Brücken verteilen die Inseln weiter über das Brett und
erzeugen weniger zufällige Ausrichtungen – also weniger „Ablenk-Kanten" und
damit weniger Mehrdeutigkeit.

Nebeneffekt: die Rätsel sehen deutlich authentischer aus, weil die Brücken
nicht alle dieselbe Länge haben. Vorher verteilten sich die Längen auf
17,6 × einfeldrig und 21,4 × zweifeldrig – **keine einzige längere Brücke**.
Mit variablen Längen (bis 4 Felder) sind es 11,9 / 13,0 / 7,5 / 6,6.

Der Gewinn an Eindeutigkeit erlaubt zugleich **mehr Doppelbrücken** ohne
Sackgasse: bei 40 Inseln sinkt die Zahl der benötigten Versuche von 8,7
(bei 25 % Doppelbrücken) auf 2,5.

Die zweite Idee desselben Projekts – keine zwei Inseln direkt nebeneinander
zu platzieren – hat sich in der Messung **als schädlich erwiesen** (Quote
fällt auf 0 %, weil das Brett dann nicht mehr gefüllt werden kann) und wurde
deshalb nicht übernommen.

Ebenfalls nicht übernommen: die dortige Generator-Routine prüft die
Eindeutigkeit gar nicht („there may not be only 1 solution" steht so im
README des Projekts). Diese Lücke schließt der hier verwendete Ansatz
durch die Verifikation mit dem Solver.

### Anordnung der Knoten

Zwei Regeln sorgen für ein luftiges, gleichmässiges Brett:

1. **Keine zwei Knoten auf benachbarten Hilfslinien-Ecken.** Die vier
   Nachbarfelder eines Knotens bleiben immer frei – zwei Inseln stehen also
   nie direkt nebeneinander. Damit ist das Raster zugleich die unterste
   Grenze der Islandsymmetrie.
2. **Best-Candidate-Sampling.** Pro Schritt werden mehrere mögliche
   Positionen erprobt und jene gewählt, die am weitesten von den übrigen
   Inseln entfernt liegt (Abstand zur nächstgelegenen Insel). Das streut die
   Knoten gleichmässig über das Brett, statt sie zu clustern.

Gemessen (40 Inseln):

| | mittlerer Abstand zur Nachbarinsel | Paare direkt nebeneinander |
|---|---|---|
| vorher | 1,49 | 11,4 |
| **jetzt** | **2,10** | **0,0** |

Nebenbei ein angenehmer Effekt: durch die gleichmässigere Verstellung
entstehen weniger zufällige Ausrichtungen – die Rätsel sind damit auch
deutlich **logiklösbarer** (bei 20–29 Inseln steigt der Anteil rein
logisch bestimmbarer Kanten von 60 % auf 100 %).

Die Raster mussten dafür grösser werden, weil ohne direkte Nachbarschaft
weniger Inseln auf dieselbe Fläche passen. Die gemessenen Kapazitäten:

| Raster | erreichbare Inseln |
|---|---|
| 11 × 11 | ~34 |
| 13 × 13 | ~46 |
| 16 × 16 | ~65 |
| 19 × 17 | ~80 |
| 23 × 21 | ~115 |

### Rätselheft: Schwierigkeit als Zielvorgabe

Früher war die Auswahl im Heft widersprüchlich: der Schwierigkeitsgrad
wurde **ausschliesslich** über die Inselzahl bestimmt, die Stufen-Auswahl war
nur ein Etikett. Ein „leichtes" Rätsel mit 100 Inseln war deshalb schlicht
unmöglich – es war immer „sehr schwer".

**Ursache:** Die Schwierigkeit hängt nicht an der Inselzahl, sondern an der
**Dichte** des Brettes. 100 Inseln auf 23 × 21 Feldern sind sehr schwer,
dieselben 100 Inseln auf 42 × 40 Feldern nur mittel:

| Raster (100 Inseln) | gemessene Schwierigkeit | rein logisch lösbar |
|---|---|---|
| 23 × 21 | 0,80 (sehr schwer) | 6 % |
| 28 × 26 | 0,72 | 19 % |
| 34 × 32 | 0,65 | 18 % |
| 42 × 40 | 0,52 (mittel) | 41 % |

**Lösung:** Der Generator sucht jetzt ein Rätsel, dessen *gemessene*
Schwierigkeit in das Band der gewünschten Stufe fällt, und passt dafür die
Rastergrösse adaptiv an (zu schwer → luftigeres Raster, zu leicht →
dichteres). Die Stufen-Auswahl im Heft ist damit eine echte Zielvorgabe.

#### Die Inselzahl gehört nicht mehr zur Auswahl

Die Frage, ob man die Inselzahl überhaupt wählen lassen soll, hat sich mit
der Messung erledigt: **nein**. Sie widerspricht der Stufe. Das Heft handelt
sie beim Erzeugen selbst aus – und zwar so, dass möglichst viele Inseln
herauskommen, ohne den Schwierigkeitsgrad zu verfehlen:

1. Startwert ist die stufentypische Dichte auf einer A6-Seite.
2. Reicht das Band nicht (zu hart), wird die Zahl gesenkt.
3. Passt es, wird sie in 10-%-Schritten erhöht, solange das Band hält.

Weil die Messung von Rätsel zu Rätsel streut, zählt der **Median aus drei
Proberätseln** und es bleibt ein Puffer von 20 % zum oberen Bandrand. Ohne
diesen Puffer würde ein einzelner Glückstreffer die Zahl nach oben ziehen –
und die übrigen Rätsel des Hefts wären zu schwer.

| Stufe | Inseln je Rätsel | Zielband | gemessen (Beispielheft) |
|---|---|---|---|
| Leicht | ~30–36 | 0 – 0,25 | 0,07 – 0,33 |
| Mittel | ~46 | 0,25 – 0,45 | 0,31 – 0,37 |
| Schwer | ~63–69 | 0,45 – 0,62 | 0,51 – 0,61 |
| Experte | 100 (A6-Grenze) | 0,62 – 1 | 0,72 – 0,86 |

Die Zahl hängt vom Seed ab: sie wird für jedes Heft neu ausgehandelt. Unter
jedem Rätsel steht die *gemessene* Stufe, in der Fusszeile des Hefts, wie
viele Rätsel das Zielband getroffen haben.

#### Optimierung: mehr Inseln bei gleicher Schwierigkeit

Die Fragestellung, ob die Parameter so optimiert werden können, dass mehr
Inseln bei gleicher Stufe herauskommen, hat einen klaren Sieger: die
**maximale Brückenlänge**. Längere Brücken verteilen die Inseln weiter
über das Brett und erzeugen weniger zufällige Ausrichtungen – also weniger
„Ablenk-Kanten" und damit weniger Mehrdeutigkeit.

Gemessen am Zielband „leicht" (5 Versuche je Punkt):

| maxExtra | Doppelbrücken | Brückenlänge | erreichte Inselzahl |
|---|---|---|---|
| 1 | 0 % | 3 Felder | 30 |
| 1 | 0 % | 4 Felder | 60 |
| 1 | 0 % | **6 Felder** | **85** |
| 2 | 20 % | 6 Felder | 70 |
| 3 | 20 % | 6 Felder | 85 |

Mit Brücken über bis zu 6 Felder sind also **85 statt 30 Inseln** möglich –
fast dreifach. Deshalb nutzen die Stufen jetzt `maxLen: 6` (Leicht/Mittel),
5 (Schwer) und 4 (Experte, wo die Dichte die Härte steuert).

Der Spielstand je Stufe:

| Stufe | Inseln | Raster | Doppelbrücken | Brückenlänge |
|---|---|---|---|---|
| Leicht | 16 – 46 | 14 × 14 | 10 % | 6 |
| Mittel | 22 – 58 | 16 × 16 | 20 % | 6 |
| Schwer | 34 – 64 | 19 × 19 | 30 % | 5 |
| Experte | 44 – 74 | 23 × 23 | 40 % | 4 |

#### Die Antwort auf die Kernfrage

*Ja* – ein Rätsel mit 100 Inseln **kann** leicht sein, es braucht nur ein
entsprechend weiteres Raster. Auf einer DIN-A6-Seite ist das allerdings
nicht darstellbar: bei höchstens 22 Spalten (Lesbarkeit) und 100 Inseln
bleibt das Raster 22 × 22, und damit ist ein solches Rätsel zwangsläufig
„sehr schwer" (gemessen 0,68 – 0,80).

Deshalb weist das Heft darauf hin, wenn eine Kombination nicht erreichbar
ist, und nennt die tatsächlich erreichte Spanne.

Unter jedem Rätsel steht jetzt die **gemessene** Schwierigkeit, nicht die
gewünschte:

```
7 · mittel (0.41)
```

---

## 📊 Schwierigkeitsmessung

Der Ansatz stammt ebenfalls aus `erthium/hashiwokakero`: die Schwierigkeit
ergibt sich aus dem **Solver-Aufwand** plus wenigen Strukturmetriken,
normiert gegen Referenzbereiche.

Hier wird das in [`js/difficulty.js`](js/difficulty.js) umgesetzt:

| Metrik | Gewicht | Bedeutung |
|---|---|---|
| `nodes` | 0,40 | Verzweigungsschritte des Solvers (Brute-Force-Aufwand) |
| `logicShare` | 0,30 | Anteil der Kanten, die **allein durch Logik** bestimmbar sind |
| `avgNumber` | 0,20 | mittlere Inselzahl |
| `density` | 0,10 | Inseldichte |

Zwei Anpassungen gegenüber dem Vorbild:

* **Logarithmus statt Linearwert.** Die Knotenzahl ist stark schief verteilt
  (typisch 1–3 bei kleinen, aber auch 350 bei grossen Brettern). Eine lineare
  Normalisierung verstärkt kleine Unterschiede extrem – der Logarithmus
  verteilt die Werte gleichmässig.
* **Normierung gegen die Gesamtverteilung**, nicht gegen einzelne
  Geometrien. Das Brett wird auf seinen kleinsten umschliessenden Rechteck
  beschnitten, die Geometrie wechselt also ständig. Nur die globale Normierung
  hält die Werte zwischen verschiedenen Brettgrössen vergleichbar.

Die Referenzbereiche stecken in
[`js/data/difficulty.js`](js/data/difficulty.js) und werden erzeugt von:

```bash
npm run calibrate      # dauert einige Minuten
```

Nach jeder Änderung am Generator sollte die Kalibrierung neu laufen – sonst
passen die Referenzbereiche nicht mehr zum Erzeuger.

Der gemessene Wert steht in der App oben rechts und im Rätselheft als
Durchschnitt. Die Einordnung fällt überraschend klar aus:

| Inselzahl | Solver-Knoten (Median) | rein logisch lösbar |
|---|---|---|
| 10–19 | 1 | 100 % |
| 20–29 | 2 | 60 % |
| 30–39 | 7 | 29 % |
| 40–59 | 20 | 13 % |
| 60–79 | 61 | 9 % |
| 80–120 | 356 | 4 % |

Bemerkenswert: die **Korrelation zwischen Inselzahl und Solver-Aufwand
beträgt nur r = 0,65** – der Aufwand trägt also echte Zusatzinformation
und ist mehr als ein Synonym für die Brettgrösse. Umgekehrt korreliert die
bisherige Struktur-Heuristik (`qualityScore`, die das „interessanteste"
Rätsel aus den Kandidaten wählt) nur mit **r = 0,66** zum Solver-Aufwand –
die beiden messen also tatsächlich verschiedene Dinge und ergänzen sich.

Die gemessenen Werte der Stufen:

| Stufe | Ø Schwierigkeitsgrad | Einordnung |
|---|---|---|
| Leicht | 0,28 | sehr leicht – leicht |
| Mittel | 0,26 | sehr leicht – leicht |
| Schwer | 0,32 | sehr leicht – mittel |
| Experte | 0,55 | mittel – schwer |
| Heft (100 Inseln) | 0,66 | sehr schwer |

Auffällig: die kleinen Stufen liegen dicht beieinander. Der Grund ist
ehrlich und nützlich – **kleine Rätsel sind fast vollständig durch Logik
lösbar** (100 % bzw. 60 % Anteil rein logisch bestimmter Kanten). Der
Solver-Aufwand misst also im Wesentlichen die Achse „mit Logik lösbar
oder mit Raten", während die Inselzahl die Achse „Grösse und
Erschöpfung" abdeckt. Beide Angaben stehen deshalb nebeneinander.

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
│   ├── difficulty.js          # Schwierigkeitsmessung (Metriken + Normierung)
│   ├── game.js                # Spielzustand: Brücken, Undo/Redo, Hinweise
│   ├── generator.js           # Rätselgenerator
│   ├── layout.js              # Seitenaufteilung des Rätselhefts
│   ├── render.js              # Canvas-Renderer + Trefferprüfung
│   ├── svg.js                 # SVG-Renderer (Druck & Heft)
│   ├── rng.js                 # deterministischer Zufallsgenerator (xmur3 + mulberry32)
│   ├── solver.js              # Constraint-Solver
│   ├── booklet.js             # Logik der Heft-Erzeugung
│   └── data/
│       └── difficulty.js      # Referenzbereiche (npm run calibrate)
├── scripts/
│   └── calibrate.mjs          # erzeugt die Referenzbereiche
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
