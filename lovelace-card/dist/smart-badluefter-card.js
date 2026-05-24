/**
 * Smart Badlüfter - Custom Lovelace Card (vanilla JS Variante)
 *
 * Diese Datei wird direkt von Home Assistant geladen. lit wird per ESM-Import
 * von einem CDN bezogen, damit kein lokaler Build (npm) nötig ist.
 *
 * Konfiguration:
 *   type: custom:smart-badluefter-card
 *   entity: fan.<smart_badluefter_fan_entity>
 */
import {
  LitElement,
  html,
  css,
  svg,
  nothing,
} from "https://unpkg.com/lit@3.1.0/index.js?module";

// In HA Karten-Auswahl registrieren
window.customCards = window.customCards || [];
window.customCards.push({
  type: "smart-badluefter-card",
  name: "Smart Badlüfter",
  description: "All-in-one Bedienfeld für die Smart-Badlüfter Integration",
  preview: true,
});

// ---------------------------------------------------------------------------
// Round-Slider
// ---------------------------------------------------------------------------
class SblRoundSlider extends LitElement {
  static properties = {
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    value: { type: Number },
    current: { type: Number },
    arc: { type: Number },
    color: { type: String },
    trackColor: { type: String },
    unit: { type: String },
    label: { type: String },
    disabled: { type: Boolean },
    _dragging: { state: true },
  };

  constructor() {
    super();
    this.min = 0;
    this.max = 100;
    this.step = 1;
    this.value = 0;
    this.current = undefined;
    this.arc = 270;
    this.color = "var(--primary-color)";
    this.trackColor = "var(--disabled-color)";
    this.unit = "";
    this.label = "";
    this.disabled = false;
    this._dragging = false;
    this._size = 240;
    this._stroke = 14;
    this._radius = (this._size - this._stroke) / 2;
  }

  static styles = css`
    :host { display: block; touch-action: none; user-select: none; }
    svg { width: 100%; height: 100%; overflow: visible; cursor: pointer; }
    .handle { fill: var(--card-background-color, #fff); stroke-width: 4; }
    .handle-dot { fill: var(--primary-color); }
    text.value {
      font-size: 56px; font-weight: 300;
      fill: var(--primary-text-color);
      text-anchor: middle; dominant-baseline: middle;
    }
    text.unit {
      font-size: 20px; font-weight: 400;
      fill: var(--secondary-text-color);
      text-anchor: middle;
    }
    text.label {
      font-size: 14px;
      fill: var(--secondary-text-color);
      text-anchor: middle;
    }
    text.current {
      font-size: 13px;
      fill: var(--secondary-text-color);
      text-anchor: middle;
    }
  `;

  _angleStart() { return -90 - this.arc / 2; }
  _angleEnd() { return -90 + this.arc / 2; }

  _valueToAngle(v) {
    const clamped = Math.min(this.max, Math.max(this.min, v));
    const ratio = (clamped - this.min) / (this.max - this.min);
    return this._angleStart() + ratio * this.arc;
  }

  _polar(angleDeg, r) {
    const a = (angleDeg * Math.PI) / 180;
    const cx = this._size / 2;
    const cy = this._size / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  _arcPath(fromAngle, toAngle) {
    const r = this._radius;
    const start = this._polar(fromAngle, r);
    const end = this._polar(toAngle, r);
    const large = Math.abs(toAngle - fromAngle) > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
  }

  _onPointerDown(ev) {
    if (this.disabled) return;
    ev.target.setPointerCapture(ev.pointerId);
    this._dragging = true;
    this._updateFromEvent(ev);
  }

  _onPointerMove(ev) {
    if (!this._dragging) return;
    this._updateFromEvent(ev);
  }

  _onPointerUp(ev) {
    if (!this._dragging) return;
    this._dragging = false;
    try { ev.target.releasePointerCapture(ev.pointerId); } catch (_) {}
    this.dispatchEvent(new CustomEvent("change", { detail: { value: this.value } }));
  }

  _updateFromEvent(ev) {
    const svgEl = this.renderRoot.querySelector("svg");
    if (!svgEl) return;
    const pt = svgEl.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    const dx = local.x - this._size / 2;
    const dy = local.y - this._size / 2;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const start = this._angleStart();
    const end = this._angleEnd();
    if (angle < start) angle = start;
    if (angle > end) angle = end;
    const ratio = (angle - start) / this.arc;
    const raw = this.min + ratio * (this.max - this.min);
    const stepped = Math.round(raw / this.step) * this.step;
    const clamped = Math.min(this.max, Math.max(this.min, stepped));
    if (clamped !== this.value) {
      this.value = clamped;
      this.dispatchEvent(new CustomEvent("input", { detail: { value: this.value } }));
    }
  }

  render() {
    const start = this._angleStart();
    const end = this._angleEnd();
    const valueAngle = this._valueToAngle(this.value);
    const handlePos = this._polar(valueAngle, this._radius);
    const currentDotPos =
      this.current !== undefined
        ? this._polar(this._valueToAngle(this.current), this._radius)
        : null;

    return html`
      <svg
        viewBox="0 0 ${this._size} ${this._size}"
        @pointerdown=${this._onPointerDown}
        @pointermove=${this._onPointerMove}
        @pointerup=${this._onPointerUp}
        @pointercancel=${this._onPointerUp}
      >
        <path
          d=${this._arcPath(start, end)}
          stroke=${this.trackColor}
          stroke-width=${this._stroke}
          stroke-linecap="round"
          fill="none"
        />
        <path
          d=${this._arcPath(start, valueAngle)}
          stroke=${this.color}
          stroke-width=${this._stroke}
          stroke-linecap="round"
          fill="none"
        />
        ${currentDotPos
          ? svg`<circle cx=${currentDotPos.x} cy=${currentDotPos.y} r="5"
                     fill="var(--secondary-text-color)" opacity="0.6"/>`
          : nothing}
        <circle
          class="handle"
          cx=${handlePos.x}
          cy=${handlePos.y}
          r="14"
          stroke=${this.color}
        />
        <circle class="handle-dot" cx=${handlePos.x} cy=${handlePos.y} r="6" />

        <text class="label" x=${this._size / 2} y=${this._size / 2 - 50}>
          ${this.label}
        </text>
        <text class="value" x=${this._size / 2} y=${this._size / 2}>
          ${Math.round(this.value * 10) / 10}${this.unit}
        </text>
        ${this.current !== undefined
          ? html`<text class="current" x=${this._size / 2} y=${this._size / 2 + 36}>
              aktuell ${Math.round(this.current * 10) / 10}${this.unit}
            </text>`
          : nothing}
      </svg>
    `;
  }
}
customElements.define("sbl-round-slider", SblRoundSlider);

// ---------------------------------------------------------------------------
// Hauptkarte
// ---------------------------------------------------------------------------
class SmartBadlueferCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _resolved: { state: true },
    _activeTab: { state: true },
  };

  constructor() {
    super();
    this._resolved = {};
    this._activeTab = "humidity";
  }

  setConfig(config) {
    if (!config || !config.entity || !config.entity.startsWith("fan.")) {
      throw new Error("Es muss eine smart_badluefter Fan-Entität (fan.*) angegeben werden.");
    }
    this._config = Object.assign(
      { show_sleep_controls: true, show_boost_buttons: true },
      config
    );
  }

  getCardSize() { return 6; }

  static getStubConfig() {
    return { type: "custom:smart-badluefter-card", entity: "" };
  }

  willUpdate(changed) {
    if (changed.has("hass") || changed.has("_config")) {
      this._resolved = this._resolveEntities();
    }
  }

  _resolveEntities() {
    const cfg = this._config;
    const hass = this.hass;
    if (!hass || !cfg) return {};
    const entities = hass.entities || {};
    const fanEntry = entities[cfg.entity];
    const deviceId = fanEntry && fanEntry.device_id;

    const byUnique = (suffix) => {
      if (!deviceId) return undefined;
      for (const [eid, e] of Object.entries(entities)) {
        if (e.device_id === deviceId && e.unique_id && e.unique_id.endsWith(suffix)) {
          return eid;
        }
      }
      return undefined;
    };

    return {
      humidity_threshold: cfg.humidity_threshold_entity || byUnique("_humidity_threshold"),
      temperature_threshold: cfg.temperature_threshold_entity || byUnique("_temperature_threshold"),
      humidity_threshold_night: cfg.humidity_threshold_night_entity || byUnique("_humidity_threshold_night"),
      temperature_threshold_night: cfg.temperature_threshold_night_entity || byUnique("_temperature_threshold_night"),
      hysteresis: cfg.hysteresis_entity || byUnique("_hysteresis"),
      auto_switch: cfg.auto_switch_entity || byUnique("_auto"),
      mode_sensor: cfg.mode_sensor_entity || byUnique("_mode"),
      boost_remaining: cfg.boost_remaining_entity || byUnique("_boost_remaining"),
      sleep_start: cfg.sleep_start_entity || byUnique("_sleep_start"),
      sleep_end: cfg.sleep_end_entity || byUnique("_sleep_end"),
    };
  }

  _stateNumber(entityId) {
    if (!entityId) return undefined;
    const s = this.hass.states[entityId];
    if (!s) return undefined;
    const n = parseFloat(s.state);
    return isNaN(n) ? undefined : n;
  }
  _state(entityId) {
    if (!entityId) return undefined;
    const s = this.hass.states[entityId];
    return s ? s.state : undefined;
  }

  _setNumber(entityId, value) {
    if (!entityId) return;
    this.hass.callService("number", "set_value", { entity_id: entityId, value });
  }
  _setTime(entityId, value) {
    if (!entityId) return;
    this.hass.callService("time", "set_value", { entity_id: entityId, time: value });
  }
  _toggleAuto() {
    if (!this._resolved.auto_switch) return;
    this.hass.callService("switch", "toggle", { entity_id: this._resolved.auto_switch });
  }
  _boost(seconds, preset) {
    this.hass.callService("smart_badluefter", "boost", {
      entity_id: this._config.entity,
      duration: seconds,
      preset,
    });
  }
  _cancelBoost() {
    this.hass.callService("smart_badluefter", "cancel_boost", { entity_id: this._config.entity });
  }

  _modeLabel(mode) {
    switch (mode) {
      case "boost": return "Boost aktiv";
      case "auto": return "Automatik läuft";
      case "manual": return "Manuell";
      case "idle": return "Leerlauf";
      default: return mode || "—";
    }
  }

  _formatRemaining(seconds) {
    if (seconds <= 0) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  render() {
    if (!this.hass || !this._config) return nothing;
    const fanState = this.hass.states[this._config.entity];
    if (!fanState) {
      return html`<ha-card><div class="warning">
        Entität ${this._config.entity} nicht gefunden.
      </div></ha-card>`;
    }

    const attrs = fanState.attributes || {};
    const mode = attrs.mode;
    const sleepActive = !!attrs.sleep_active;
    const currentHumidity = attrs.current_humidity;
    const currentTemperature = attrs.current_temperature;

    const humidityThresholdEntity = sleepActive
      ? this._resolved.humidity_threshold_night
      : this._resolved.humidity_threshold;
    const temperatureThresholdEntity = sleepActive
      ? this._resolved.temperature_threshold_night
      : this._resolved.temperature_threshold;

    const targetHumidity = this._stateNumber(humidityThresholdEntity) || 60;
    const targetTemperature = this._stateNumber(temperatureThresholdEntity) || 25;

    const autoOn = this._state(this._resolved.auto_switch) === "on";
    const boostRemaining = this._stateNumber(this._resolved.boost_remaining) || 0;
    const sleepStart = this._state(this._resolved.sleep_start) || "";
    const sleepEnd = this._state(this._resolved.sleep_end) || "";

    return html`
      <ha-card>
        <div class="header">
          <div class="title">${this._config.name || attrs.friendly_name || "Lüfter"}</div>
          <div class="mode-badge ${mode || ""}">
            ${this._modeLabel(mode)}
            ${sleepActive ? html`<span class="sleep-pill">Nacht</span>` : nothing}
          </div>
        </div>

        <div class="tabs">
          <button
            class=${this._activeTab === "humidity" ? "active" : ""}
            @click=${() => (this._activeTab = "humidity")}
          >
            <ha-icon icon="mdi:water-percent"></ha-icon> Luftfeuchte
          </button>
          <button
            class=${this._activeTab === "temperature" ? "active" : ""}
            @click=${() => (this._activeTab = "temperature")}
          >
            <ha-icon icon="mdi:thermometer"></ha-icon> Temperatur
          </button>
        </div>

        <div class="slider-wrap">
          ${this._activeTab === "humidity"
            ? html`
                <sbl-round-slider
                  min="20" max="95" step="1"
                  unit="%"
                  label="Ziel Luftfeuchte"
                  .value=${targetHumidity}
                  .current=${typeof currentHumidity === "number" ? currentHumidity : undefined}
                  color="var(--info-color, #039be5)"
                  @change=${(e) => this._setNumber(humidityThresholdEntity, e.detail.value)}
                ></sbl-round-slider>
              `
            : html`
                <sbl-round-slider
                  min="10" max="40" step="0.5"
                  unit="°C"
                  label="Ziel Temperatur"
                  .value=${targetTemperature}
                  .current=${typeof currentTemperature === "number" ? currentTemperature : undefined}
                  color="var(--warning-color, #ff9800)"
                  @change=${(e) => this._setNumber(temperatureThresholdEntity, e.detail.value)}
                ></sbl-round-slider>
              `}
        </div>

        <div class="readings">
          <div class="reading">
            <ha-icon icon="mdi:water-percent"></ha-icon>
            <span>${typeof currentHumidity === "number" ? `${currentHumidity.toFixed(1)} %` : "—"}</span>
          </div>
          <div class="reading">
            <ha-icon icon="mdi:thermometer"></ha-icon>
            <span>${typeof currentTemperature === "number" ? `${currentTemperature.toFixed(1)} °C` : "—"}</span>
          </div>
          <button
            class="auto-toggle ${autoOn ? "on" : "off"}"
            @click=${() => this._toggleAuto()}
            title="Automatik ${autoOn ? "an" : "aus"}"
          >
            <ha-icon icon="mdi:auto-mode"></ha-icon>
            Auto ${autoOn ? "an" : "aus"}
          </button>
        </div>

        ${this._config.show_boost_buttons
          ? html`
              <div class="actions">
                ${boostRemaining > 0
                  ? html`
                      <div class="boost-active">
                        <ha-icon icon="mdi:timer-sand"></ha-icon>
                        <span>${this._formatRemaining(boostRemaining)}</span>
                        <button class="cancel" @click=${() => this._cancelBoost()}>
                          Abbrechen
                        </button>
                      </div>
                    `
                  : html`
                      <button
                        class="action toilet"
                        @click=${() => this._boost((this._config.boost_toilet_minutes || 5) * 60, "toilet")}
                      >
                        <ha-icon icon="mdi:toilet"></ha-icon>
                        <div class="action-label">Klo lüften</div>
                        <div class="action-sub">${this._config.boost_toilet_minutes || 5} min</div>
                      </button>
                      <button
                        class="action shower"
                        @click=${() => this._boost((this._config.boost_shower_minutes || 30) * 60, "shower")}
                      >
                        <ha-icon icon="mdi:shower"></ha-icon>
                        <div class="action-label">Duschen gehen</div>
                        <div class="action-sub">${this._config.boost_shower_minutes || 30} min</div>
                      </button>
                    `}
              </div>
            `
          : nothing}

        ${this._config.show_sleep_controls
          ? html`
              <div class="sleep-row">
                <ha-icon icon="mdi:weather-night"></ha-icon>
                <label>
                  Start
                  <input
                    type="time"
                    .value=${(sleepStart || "22:00:00").substring(0, 5)}
                    @change=${(e) =>
                      this._setTime(this._resolved.sleep_start, e.target.value + ":00")}
                  />
                </label>
                <label>
                  Ende
                  <input
                    type="time"
                    .value=${(sleepEnd || "07:00:00").substring(0, 5)}
                    @change=${(e) =>
                      this._setTime(this._resolved.sleep_end, e.target.value + ":00")}
                  />
                </label>
              </div>
            `
          : nothing}
      </ha-card>
    `;
  }

  static styles = css`
    ha-card {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .header {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
    }
    .title { font-size: 1.2em; font-weight: 500; color: var(--primary-text-color); }
    .mode-badge {
      font-size: 0.85em; padding: 4px 10px; border-radius: 14px;
      background: var(--secondary-background-color);
      color: var(--secondary-text-color);
      display: inline-flex; gap: 6px; align-items: center;
    }
    .mode-badge.boost { background: var(--info-color, #039be5); color: white; }
    .mode-badge.auto { background: var(--success-color, #43a047); color: white; }
    .sleep-pill {
      background: rgba(0,0,0,0.25); padding: 1px 6px; border-radius: 8px; font-size: 0.85em;
    }

    .tabs { display: flex; gap: 8px; }
    .tabs button {
      flex: 1; background: var(--secondary-background-color);
      color: var(--secondary-text-color);
      border: none; border-radius: 12px; padding: 8px; font: inherit; cursor: pointer;
      display: inline-flex; gap: 6px; justify-content: center; align-items: center;
    }
    .tabs button.active { background: var(--primary-color); color: var(--text-primary-color, #fff); }

    .slider-wrap { display: flex; justify-content: center; padding: 8px 0; }
    sbl-round-slider { width: 260px; height: 260px; }

    .readings {
      display: flex; gap: 8px; align-items: center; justify-content: space-between;
      padding: 4px 4px 0;
    }
    .reading { display: inline-flex; gap: 4px; align-items: center; color: var(--secondary-text-color); }
    .auto-toggle {
      background: var(--secondary-background-color); border: none;
      color: var(--secondary-text-color); border-radius: 16px; padding: 6px 12px;
      cursor: pointer; display: inline-flex; gap: 4px; align-items: center;
    }
    .auto-toggle.on { background: var(--success-color, #43a047); color: white; }

    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .action {
      background: var(--secondary-background-color); border: none; border-radius: 12px;
      padding: 12px 8px; color: var(--primary-text-color); cursor: pointer;
      display: flex; flex-direction: column; gap: 4px; align-items: center;
      font: inherit; transition: background 0.15s ease;
    }
    .action:hover { background: var(--divider-color); }
    .action ha-icon { --mdc-icon-size: 28px; color: var(--primary-color); }
    .action-label { font-weight: 500; }
    .action-sub { font-size: 0.8em; color: var(--secondary-text-color); }

    .boost-active {
      grid-column: 1 / -1;
      background: var(--info-color, #039be5); color: white;
      padding: 14px; border-radius: 12px;
      display: flex; align-items: center; gap: 12px; font-size: 1.1em;
    }
    .boost-active button.cancel {
      margin-left: auto; background: rgba(0,0,0,0.2); color: white;
      border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer;
    }

    .sleep-row {
      display: flex; gap: 12px; align-items: center; padding-top: 8px;
      border-top: 1px solid var(--divider-color); color: var(--secondary-text-color);
    }
    .sleep-row label { display: inline-flex; gap: 4px; align-items: center; font-size: 0.9em; }
    .sleep-row input[type="time"] {
      background: var(--secondary-background-color); color: var(--primary-text-color);
      border: 1px solid var(--divider-color); border-radius: 6px;
      padding: 2px 4px; font: inherit;
    }

    .warning { padding: 16px; color: var(--error-color); }
  `;
}
customElements.define("smart-badluefter-card", SmartBadlueferCard);

console.info(
  "%c SMART-BADLUEFTER-CARD %c 0.1.0 ",
  "color: white; background: #039be5; font-weight: 700;",
  "color: #039be5; background: white; font-weight: 700;"
);
