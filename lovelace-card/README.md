# Smart Badlüfter Card

Lovelace-Karte zur [Smart Badlüfter](../README.md) Integration.

## Build

```bash
npm install
npm run build       # einmal
npm run watch       # während der Entwicklung
```

Output: `dist/smart-badluefter-card.js`. Diese Datei via HACS oder manuell
unter `<HA>/config/www/community/smart-badluefter-card/` ablegen und in
Lovelace als JS-Modul registrieren.

## Beispiel

```yaml
type: custom:smart-badluefter-card
entity: fan.badezimmer_smart_lufter
boost_toilet_minutes: 5
boost_shower_minutes: 30
```
