# Radio Card

Custom Card für Home Assistant zum Abspielen von Radiosendern auf mehreren Lautsprechern. Unterstützt Gruppensteuerung, Lautstärkeregelung pro Lautsprecher und einen visuellen Editor.

## Voraussetzungen

- Home Assistant mit Lovelace Dashboard
- Mindestens eine `media_player` Entität (z.B. Sonos, Chromecast, etc.)
- [Radio Browser Integration](https://www.home-assistant.io/integrations/radio_browser/)

## Installation

### Schritt 1 — Datei kopieren

`RadioCard.js` in den `www`-Ordner deiner Home Assistant Konfiguration kopieren. Hierzu am besten den [File Editor](https://www.home-assistant.io/docs/tools/file-editor/) nutzen.

### Schritt 2 — Ressource registrieren

> Falls der Menüpunkt „Ressourcen" fehlt: **Profil → Erweiterter Modus** aktivieren.

1. **Einstellungen → Dashboards**
2. Oben rechts auf **⋮ → Ressourcen** klicken
3. **+ Ressource hinzufügen**
4. URL und Typ eintragen:

| Feld          | Wert                  |
| ------------- | --------------------- |
| URL           | `/local/RadioCard.js` |
| Ressourcentyp | JavaScript-Modul      |

### Schritt 3 — Karte zum Dashboard hinzufügen

1. Dashboard in den **Bearbeitungsmodus** versetzen
2. **+ Karte hinzufügen**
3. In der Liste nach **„Radio Card"** suchen und auswählen
4. Sender und Lautsprecher im visuellen Editor konfigurieren

## Updates einspielen

Nach dem Ersetzen der Datei auf dem Server den Browser-Cache leeren:

- **Browser:** `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)
- **Mobile App:** App-Einstellungen → Companion App → Debuggen → Cache leeren

---
