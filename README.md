# Smart Badlüfter

Eine Home-Assistant-Integration **plus** Lovelace-Karte, die Hygrostat,
Thermostat, Ruhephase und manuelle Boost-Timer eines Badezimmerlüfters in
**einem Gerät** und **einer Karte** vereint.

Features:

- automatisches Einschalten ab konfigurierbarer Luftfeuchte **oder** Temperatur
- Ruhephase mit Start/Ende - wahlweise Auto-Aus oder höhere Schwellen
- Hysterese gegen Flattern
- Boost-Service mit beliebiger Dauer, plus Presets `boost_toilet` und `boost_shower`
- runde Slider, aktuelle Werte, Boost-Buttons und Ruhephasen-Editor in einer Karte
- alles über die HA-UI einrichtbar (Config-Flow + Optionen-Flow)

## Repository-Struktur

```
HA_luefter/
├── hacs.json
├── README.md
├── custom_components/
│   └── smart_badluefter/         # Python-Integration
│       ├── __init__.py
│       ├── manifest.json
│       ├── const.py
│       ├── controller.py
│       ├── config_flow.py
│       ├── entity.py
│       ├── fan.py
│       ├── number.py
│       ├── switch.py
│       ├── sensor.py
│       ├── time.py
│       ├── services.yaml
│       ├── strings.json
│       └── translations/{de,en}.json
└── lovelace-card/                # TypeScript-Frontend-Karte
    ├── package.json
    ├── tsconfig.json
    ├── rollup.config.js
    └── src/
        ├── smart-badluefter-card.ts
        ├── round-slider.ts
        └── types.ts
```

## 1. Lokale Test-Installation (vor HACS-Release)

### Backend

1. Inhalt von `custom_components/smart_badluefter/` nach
   `<HA-config-dir>/custom_components/smart_badluefter/` kopieren.
2. Home Assistant neu starten.
3. *Einstellungen → Geräte & Dienste → "+ Integration hinzufügen" → "Smart Badlüfter"*.
4. Lüfter-Entität, Temperatur- und Feuchtigkeitssensor auswählen.
5. Über den *Konfigurieren*-Button im Integrations-Tile lassen sich
   Schwellen, Ruhephase, Hysterese und Boost-Dauern jederzeit anpassen.

Die Integration legt ein Gerät an mit:

- `fan.<name>_smart_lufter` - virtuelle Lüfter-Entität
- `number.*_humidity_threshold`, `..._temperature_threshold`, plus Nacht-Varianten und Hysterese
- `switch.*_auto` - Automatik-Schalter
- `sensor.*_mode`, `sensor.*_boost_remaining`
- `time.*_sleep_start`, `time.*_sleep_end`

Services (Domain `smart_badluefter`):

- `boost` (entity_id, duration in Sekunden, optional preset)
- `cancel_boost`
- `boost_toilet`, `boost_shower` - benutzen die im Optionen-Flow konfigurierten Dauern

### Frontend-Karte

```bash
cd lovelace-card
npm install
npm run build
```

Das erzeugt `lovelace-card/dist/smart-badluefter-card.js`.

1. Datei nach `<HA-config-dir>/www/community/smart-badluefter-card/smart-badluefter-card.js`
   kopieren (oder einen beliebigen Pfad unter `www/`).
2. *Einstellungen → Dashboards → drei Punkte → Ressourcen → Ressource hinzufügen*:
   - URL: `/local/community/smart-badluefter-card/smart-badluefter-card.js`
   - Typ: *JavaScript Modul*
3. Dashboard im Edit-Modus: Karte → manuell → folgendes einfügen:

```yaml
type: custom:smart-badluefter-card
entity: fan.badezimmer_smart_lufter
# optional:
boost_toilet_minutes: 5
boost_shower_minutes: 30
show_sleep_controls: true
```

Die Karte löst alle übrigen Entitäten automatisch über das Gerät der Fan-Entität
auf. Bei Bedarf können einzelne Entitäten via
`humidity_threshold_entity`, `temperature_threshold_entity`,
`sleep_start_entity` usw. überschrieben werden.

## 2. HACS-Installation (nach Veröffentlichung)

1. Repository auf GitHub pushen, sodass die Top-Level-Struktur erhalten bleibt.
2. In HACS → drei Punkte → *Custom repositories* das Repo als Typ
   *Integration* hinzufügen. Für die Karte: zweiter Eintrag als Typ
   *Lovelace*. (Wenn Backend und Frontend zwei getrennte Repos sind, ist das
   sauberer; aktuell liegt beides hier zusammen, damit Demo und Tests einfach
   bleiben.)
3. Die Integration wie unter 1. konfigurieren, die Karte wie unter 1. einbinden.

## 3. Entwicklungs-Hinweise

### Backend

Die Logik lebt zentral in `controller.py`. Alle Entitäten sind dumme Adapter,
die ihren Wert über den `SmartFanController` lesen/schreiben und via
`async_dispatcher_send` ein Re-Render anstoßen. Die Auswertung
(`async_evaluate`) wird immer dann ausgelöst, wenn sich ein Sensor- oder
Lüfter-State ändert oder eine Option neu gesetzt wird.

Boost-Timer benutzen `async_track_point_in_time` - überlebt also HA-Neustarts
**nicht** (bewusst: ein laufender Boost soll nach Neustart nicht stillschweigend
weiterlaufen). Sollte das anders gewünscht sein: `boost_until` in
`entry.options` persistieren.

### Frontend

Die Karte ist ein single-file Bundle (`rollup -c`). `lit` wird ins Bundle
inlined, sodass keine separate Resource nötig ist. Während der Entwicklung:

```bash
npm run watch
```

und das `dist/smart-badluefter-card.js` direkt symlinken bzw. nach `www/`
synchronisieren.

### Tests

Für eine schnelle Live-Schleife empfehle ich
[`pytest-homeassistant-custom-component`](https://github.com/MatthewFlamm/pytest-homeassistant-custom-component)
für `controller.py` (besonders die Tag/Nacht-Schwellen- und Hysterese-Logik
verdient eigene Tests) sowie HA Container Edition (`ghcr.io/home-assistant/home-assistant`)
für End-to-End-Tests mit Demo-Sensoren (`input_number`).

## Lizenz

MIT - siehe `LICENSE`.
