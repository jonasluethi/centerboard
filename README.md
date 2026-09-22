# Centerboard – Mitarbeiter-Standorte

Kleine Web-App, die Mitarbeiteradressen auf einer swisstopo-Karte einzeichnet.

## Verwendung

Keine Build-Schritte nötig – `index.html` direkt öffnen oder lokal servieren:

```bash
python3 -m http.server 8000
```

Dann `http://localhost:8000` im Browser öffnen.

## Funktionsweise

- **Karte**: swisstopo WMTS-Kacheln (Landeskarte farbig/grau, Luftbild) über Leaflet.
- **Geocoding**: Adressen werden client-seitig über den öffentlichen swisstopo
  `SearchServer` (`api3.geo.admin.ch`) in Koordinaten umgewandelt.
- **Daten**: Startliste steht in `employees.json`. Über die Seitenleiste können
  weitere Mitarbeitende hinzugefügt/entfernt werden; Änderungen werden im
  `localStorage` des Browsers gespeichert ("Auf Standardliste zurücksetzen"
  löscht sie wieder).

## Hinweis zur Sandbox

In dieser Remote-Umgebung ist ausgehender Netzwerkzugriff auf externe Hosts
(swisstopo-API, CDN) blockiert, die App konnte daher hier nicht live im
Browser getestet werden. Im normalen Browser des Nutzers mit regulärem
Internetzugang funktionieren die Aufrufe an `api3.geo.admin.ch` und
`wmts.geo.admin.ch` wie dokumentiert.
