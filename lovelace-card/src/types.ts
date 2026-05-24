import type { HomeAssistant, LovelaceCardConfig } from "custom-card-helpers";

export interface SmartBadluefterCardConfig extends LovelaceCardConfig {
  type: string;
  /** Pflicht: die smart_badluefter Fan-Entität (z.B. fan.badezimmer_smart_luefter) */
  entity: string;
  /** Optionale Overrides - werden sonst aus dem Device der Fan-Entität abgeleitet. */
  humidity_threshold_entity?: string;
  temperature_threshold_entity?: string;
  humidity_threshold_night_entity?: string;
  temperature_threshold_night_entity?: string;
  hysteresis_entity?: string;
  auto_switch_entity?: string;
  mode_sensor_entity?: string;
  boost_remaining_entity?: string;
  sleep_start_entity?: string;
  sleep_end_entity?: string;
  /** Anzeigeoptionen */
  name?: string;
  show_sleep_controls?: boolean;
  show_boost_buttons?: boolean;
  boost_toilet_minutes?: number;
  boost_shower_minutes?: number;
}

export type Hass = HomeAssistant;
