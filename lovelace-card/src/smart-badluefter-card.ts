/**
 * Smart Badlüfter - Custom Lovelace Card
 *
 * Single-file Bundle, das nach `dist/smart-badluefter-card.js` kompiliert
 * und in Home Assistant als Modul-Resource eingebunden wird.
 *
 * Konfiguration:
 *   type: custom:smart-badluefter-card
 *   entity: fan.badezimmer_smart_luefter
 *
 * Alle weiteren Entitäten werden automatisch über die Device-Registry der
 * Integration aufgelöst (siehe _resolveEntities).
 */
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCard } from "custom-card-helpers";

import "./round-slider";
import type { SmartBadluefterCardConfig } from "./types";

// Registriere in der HA Karten-Auswahl
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "smart-badluefter-card",
  name: "Smart Badlüfter",
  description: "All-in-one Bedienfeld für die Smart-Badlüfter Integration",
  preview: true,
});

interface ResolvedEntities {
  humidity_threshold?: string;
  temperature_threshold?: string;
  humidity_threshold_night?: string;
  temperature_threshold_night?: string;
  hysteresis?: string;
  auto_switch?: string;
  mode_sensor?: string;
  boost_remaining?: string;
  sleep_start?: string;
  sleep_end?: string;
}

@customElement("smart-badluefter-card")
export class SmartBadlueferCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: SmartBadluefterCardConfig;
  @state() private _resolved: ResolvedEntities = {};
  @state() private _activeTab: "humidity" | "temperature" = "humidity";

  public setConfig(config: SmartBadluefterCardConfig): void {
    if (!config?.entity || !config.entity.startsWith("fan.")) {
      throw new Error("Es muss eine smart_badluefter Fan-Entität angegeben werden.");
    }
    this._config = {
      show_sleep_controls: true,
      show_boost_buttons: true,
      ...config,
    };
  }

  public getCardSize(): number {
    return 6;
  }

  public static getStubConfig(): SmartBadluefterCardConfig {
    return { type: "custom:smart-badluefter-card", entity: "" };
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has("hass") || changed.has("_config")) {
      this._resolved = this._resolveEntities();
    }
  }

  // ---------- Entity Resolution ------------------------------------------
  private _resolveEntities(): ResolvedEntities {
    const cfg = this._config;
    const hass = this.hass;
    if (!hass || !cfg) return {};

    const fanEntry = (hass as any).entities?.[cfg.entity];
    const deviceId: string | undefined = fanEntry?.device_id;

    const byUnique = (suffix: string): string | undefined => {
      if (!deviceId) return undefined;
      const entities = (hass as any).entities as Record<string, any>;
      for (const [eid, e] of Object.entries(entities)) {
        if (e.device_id === deviceId && e.unique_id?.endsWith(suffix)) {
          return eid;
        }
      }
      return undefined;
    };

    return {
      humidity_threshold:
        cfg.humidity_threshold_entity || byUnique("_humidity_threshold"),
      temperature_threshold:
        cfg.temperature_threshold_entity || byUnique("_temperature_threshold"),
      humidity_threshold_night:
        cfg.humidity_threshold_night_entity ||
        byUnique("_humidity_threshold_night"),
      temperature_threshold_night:
        cfg.temperature_threshold_night_entity ||
        byUnique("_temperature_threshold_night"),
      hysteresis: cfg.hysteresis_entity || byUnique("_hysteresis"),
      auto_switch: cfg.auto_switch_entity || byUnique("_auto"),
      mode_sensor: cfg.mode_sensor_entity || byUnique("_mode"),
      boost_remaining:
        cfg.boost_remaining_entity || byUnique("_boost_remaining"),
      sleep_start: cfg.sleep_start_entity || byUnique("_sleep_start"),
      sleep_end: cfg.sleep_end_entity || byUnique("_sleep_end"),
    };
  }

  private _stateNumber(entityId?: string): number | undefined {
    if (!entityId) return undefined;
    const s = this.hass.states[entityId];
    if (!s) return undefined;
    const n = parseFloat(s.state);
    return isNaN(n) ? undefined : n;
  }

  private _state(entityId?: string): string | undefined {
    if (!entityId) return undefined;
    return this.hass.states[entityId]?.state;
  }

  // ---------- Actions ----------------------------------------------------
  private _setNumber(entityId: string | undefined, value: number) {
    if (!entityId) return;
    this.hass.callService("number", "set_value", {
      entity_id: entityId,
      value,
    });
  }

  private _setTime(entityId: string | undefined, value: string) {
    if (!entityId) return;
    this.hass.callService("time", "set_value", { entity_id: entityId, time: value });
  }

  private _toggleAuto() {
    if (!this._resolved.auto_switch) return;
    this.hass.callService("switch", "toggle", {
      entity_id: this._resolved.auto_switch,
    });
  }

  private _boost(seconds: number, preset: string) {
    this.hass.callService("smart_badluefter", "boost", {
      entity_id: this._config.entity,
      duration: seconds,
      preset,
    });
  }

  private _cancelBoost() {
    this.hass.callService("smart_badluefter", "cancel_boost", {
      entity_id: this._config.entity,
    });
  }

  // ---------- Helpers ----------------------------------------------------
  private _modeLabel(mode: string | undefined): string {
    switch (mode) {
      case "boost":
        return "Boost aktiv";
      case "auto":
        return "Automatik läuft";
      case "manual":
        return "Manuell";
      case "idle":
        return "Leerlauf";
      default:
        return mode ?? "—";
    }
  }

  private _formatRemaining(seconds: number): string {
    if (seconds <= 0) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // ---------- Render -----------------------------------------------------
  protected render() {
    if (!this.hass || !this._config) return nothing;
    const fanState = this.hass.states[this._config.entity];
    if (!fanState) {
      return html`<ha-card><div class="warning">
        Entität ${this._config.entity} nicht gefunden.
      </div></ha-card>`;
    }

    const attrs = fanState.attributes || {};
    const mode = attrs.mode as string | undefined;
    const sleepActive = !!attrs.sleep_active;
    const currentHumidity = this._stateNumber(undefined) ?? attrs.current_humidity;
    const currentTemperature = attrs.current_temperature;

    // Welche Schwellen sind aktiv? Tag oder Nacht?
    const humidityThresholdEntity = sleepActive
      ? this._resolved.humidity_threshold_night
      : this._resolved.humidity_threshold;
    const temperatureThresholdEntity = sleepActive
      ? this._resolved.temperature_threshold_night
      : this._resolved.temperature_threshold;

    const targetHumidity = this._stateNumber(humidityThresholdEntity) ?? 60;
    const targetTemperature = this._stateNumber(temperatureThresholdEntity) ?? 25;

    const autoOn = this._state(this._resolved.auto_switch) === "on";
    const boostRemaining = this._stateNumber(this._resolved.boost_remaining) ?? 0;
    const sleepStart = this._state(this._resolved.sleep_start) ?? "";
    const sleepEnd = this._state(this._resolved.sleep_end) ?? "";

    return html`
      <ha-card>
        <div class="header">
          <div class="title">${this._config.name ?? fanState.attributes.friendly_name ?? "Lüfter"}</div>
          <div class="mode-badge ${mode}">
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
                  min="20"
                  max="95"
                  step="1"
                  unit="%"
                  label="Ziel Luftfeuchte"
                  .value=${targetHumidity}
                  .current=${typeof currentHumidity === "number" ? currentHumidity : undefined}
                  color="var(--info-color, #039be5)"
                  @change=${(e: CustomEvent) =>
                    this._setNumber(humidityThresholdEntity, e.detail.value)}
                ></sbl-round-slider>
              `
            : html`
                <sbl-round-slider
                  min="10"
                  max="40"
                  step="0.5"
                  unit="°C"
                  label="Ziel Temperatur"
                  .value=${targetTemperature}
                  .current=${typeof currentTemperature === "number" ? currentTemperature : undefined}
                  color="var(--warning-color, #ff9800)"
                  @change=${(e: CustomEvent) =>
                    this._setNumber(temperatureThresholdEntity, e.detail.value)}
                ></sbl-round-slider>
              `}
        </div>

        <div class="readings">
          <div class="reading">
            <ha-icon icon="mdi:water-percent"></ha-icon>
            <span>${typeof currentHumidity === "number"
              ? `${currentHumidity.toFixed(1)} %`
              : "—"}</span>
          </div>
          <div class="reading">
            <ha-icon icon="mdi:thermometer"></ha-icon>
            <span>${typeof currentTemperature === "number"
              ? `${currentTemperature.toFixed(1)} °C`
              : "—"}</span>
          </div>
          <button
            class="auto-toggle ${autoOn ? "on" : "off"}"
            @click=${this._toggleAuto}
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
                        <button class="cancel" @click=${this._cancelBoost}>
                          Abbrechen
                        </button>
                      </div>
                    `
                  : html`
                      <button
                        class="action toilet"
                        @click=${() =>
                          this._boost(
                            (this._config.boost_toilet_minutes ?? 5) * 60,
                            "toilet"
                          )}
                      >
                        <ha-icon icon="mdi:toilet"></ha-icon>
                        <div class="action-label">Klo lüften</div>
                        <div class="action-sub">
                          ${this._config.boost_toilet_minutes ?? 5} min
                        </div>
                      </button>
                      <button
                        class="action shower"
                        @click=${() =>
                          this._boost(
                            (this._config.boost_shower_minutes ?? 30) * 60,
                            "shower"
                          )}
                      >
                        <ha-icon icon="mdi:shower"></ha-icon>
                        <div class="action-label">Duschen gehen</div>
                        <div class="action-sub">
                          ${this._config.boost_shower_minutes ?? 30} min
                        </div>
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
                    @change=${(e: Event) =>
                      this._setTime(
                        this._resolved.sleep_start,
                        (e.target as HTMLInputElement).value + ":00"
                      )}
                  />
                </label>
                <label>
                  Ende
                  <input
                    type="time"
                    .value=${(sleepEnd || "07:00:00").substring(0, 5)}
                    @change=${(e: Event) =>
                      this._setTime(
                        this._resolved.sleep_end,
                        (e.target as HTMLInputElement).value + ":00"
                      )}
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
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .title {
      font-size: 1.2em;
      font-weight: 500;
      color: var(--primary-text-color);
    }
    .mode-badge {
      font-size: 0.85em;
      padding: 4px 10px;
      border-radius: 14px;
      background: var(--secondary-background-color);
      color: var(--secondary-text-color);
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .mode-badge.boost {
      background: var(--info-color, #039be5);
      color: white;
    }
    .mode-badge.auto {
      background: var(--success-color, #43a047);
      color: white;
    }
    .sleep-pill {
      background: rgba(0, 0, 0, 0.25);
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 0.85em;
    }

    .tabs {
      display: flex;
      gap: 8px;
    }
    .tabs button {
      flex: 1;
      background: var(--secondary-background-color);
      color: var(--secondary-text-color);
      border: none;
      border-radius: 12px;
      padding: 8px;
      font: inherit;
      cursor: pointer;
      display: inline-flex;
      gap: 6px;
      justify-content: center;
      align-items: center;
    }
    .tabs button.active {
      background: var(--primary-color);
      color: var(--text-primary-color, #fff);
    }

    .slider-wrap {
      display: flex;
      justify-content: center;
      padding: 8px 0;
    }
    sbl-round-slider {
      width: 260px;
      height: 260px;
    }

    .readings {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 4px 4px 0;
    }
    .reading {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      color: var(--secondary-text-color);
    }
    .auto-toggle {
      background: var(--secondary-background-color);
      border: none;
      color: var(--secondary-text-color);
      border-radius: 16px;
      padding: 6px 12px;
      cursor: pointer;
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }
    .auto-toggle.on {
      background: var(--success-color, #43a047);
      color: white;
    }

    .actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .action {
      background: var(--secondary-background-color);
      border: none;
      border-radius: 12px;
      padding: 12px 8px;
      color: var(--primary-text-color);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: center;
      font: inherit;
      transition: background 0.15s ease;
    }
    .action:hover {
      background: var(--divider-color);
    }
    .action ha-icon {
      --mdc-icon-size: 28px;
      color: var(--primary-color);
    }
    .action-label {
      font-weight: 500;
    }
    .action-sub {
      font-size: 0.8em;
      color: var(--secondary-text-color);
    }

    .boost-active {
      grid-column: 1 / -1;
      background: var(--info-color, #039be5);
      color: white;
      padding: 14px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 1.1em;
    }
    .boost-active button.cancel {
      margin-left: auto;
      background: rgba(0, 0, 0, 0.2);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
    }

    .sleep-row {
      display: flex;
      gap: 12px;
      align-items: center;
      padding-top: 8px;
      border-top: 1px solid var(--divider-color);
      color: var(--secondary-text-color);
    }
    .sleep-row label {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      font-size: 0.9em;
    }
    .sleep-row input[type="time"] {
      background: var(--secondary-background-color);
      color: var(--primary-text-color);
      border: 1px solid var(--divider-color);
      border-radius: 6px;
      padding: 2px 4px;
      font: inherit;
    }

    .warning {
      padding: 16px;
      color: var(--error-color);
    }
  `;
}
