# Character Tavern

Homepage für Namensgeneratoren und Zufallscharaktere. Reine HTML/CSS/JS-Seite ohne Build-Schritt, läuft auf GitHub Pages und offline.

## Einrichten (einmalig)

1. Neues GitHub-Repository anlegen (z. B. `character-tavern`) und den Inhalt dieses Ordners hochladen.
2. **Settings → Pages → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`** speichern.
3. Nach ca. 1 Minute ist die Seite unter `https://DEIN-NAME.github.io/character-tavern/` erreichbar.

## Admin-Zugang (Verwaltung)

Die Verwaltung liegt unter `admin.html` (Link „Verwaltung“ im Fuß der Seite). Dein **Zugang ist ein GitHub-Token** – nur damit kann veröffentlicht werden:

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens → Generate**.
2. *Repository access*: nur dein `character-tavern`-Repo. *Permissions → Contents: Read and write*.
3. Token in der Verwaltung eintragen (zusammen mit Benutzername und Repo-Name). „Merken“ speichert ihn nur in deinem Browser.

Behandle den Token wie ein Passwort und gib ihn nicht weiter.

## Was die Verwaltung kann

- **Reiter & Unterpunkte**: anlegen, umbenennen, löschen, per Ziehen am ⠿ sortieren (Unterpunkte auch in andere Reiter ziehen). Emoji und Logo pro Reiter.
- **Fertige HTML-Datei auf einen Reiter ziehen** → wird Unterpunkt (Name aus `<title>`). Auf die große Fläche ziehen → neuer Reiter.
- **Downloads**: Kategorien anlegen, Dateien hineinziehen → Download-Button entsteht automatisch. Alle Seiten stehen zusätzlich automatisch im Download-Bereich.
- **Startseite**: Überschrift, Einleitung, Textblöcke.
- **Veröffentlichen** schreibt alles in einem Commit ins Repo; nicht mehr benutzte Dateien werden entfernt. **Als ZIP sichern** ist die Alternative ohne Token.

## Eigene Generator-Seiten

Jede Seite ist eine **eigenständige HTML-Datei** (eigenes Design erlaubt), die ohne externe Abhängigkeiten läuft. Sie wird im Tavern-Rahmen per iframe angezeigt. Wichtig für Offline: keine Links auf externe Schriften, Skripte oder Bilder.

## Offline

Ein Service Worker speichert beim ersten Besuch alle Seiten. Im Download-Bereich gibt es außerdem „Für Offline-Nutzung speichern“ und „Alle Seiten als ZIP“. Offline-Speicherung funktioniert nur über https (GitHub Pages) oder `localhost`, nicht per Doppelklick auf `index.html`.

## Lokal testen

```
python3 -m http.server 8000   # dann http://localhost:8000
```

## Struktur

```
index.html, admin.html     Hauptseite / Verwaltung
data/site.json             Reiter, Unterpunkte, Downloads, Startseitentexte
pages/                     Generator-Seiten
downloads/                 Dateien des Download-Bereichs
assets/                    Logos, Icons
css/ js/ sw.js             Design, Logik, Offline-Modus
```
