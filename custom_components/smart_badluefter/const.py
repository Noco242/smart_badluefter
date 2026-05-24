"""Konstanten für die Smart Badlüfter Integration."""
from __future__ import annotations

from datetime import time

DOMAIN = "smart_badluefter"

# Plattformen, die diese Integration anlegt.
PLATFORMS: list[str] = ["fan", "number", "switch", "sensor", "time"]

# --- Config-Flow Keys ---------------------------------------------------------
CONF_FAN_ENTITY = "fan_entity"
CONF_TEMP_SENSOR = "temperature_sensor"
CONF_HUMIDITY_SENSOR = "humidity_sensor"

# Optionen (über Options-Flow änderbar)
CONF_HUMIDITY_THRESHOLD = "humidity_threshold"
CONF_TEMP_THRESHOLD = "temperature_threshold"
CONF_HUMIDITY_THRESHOLD_NIGHT = "humidity_threshold_night"
CONF_TEMP_THRESHOLD_NIGHT = "temperature_threshold_night"
CONF_SLEEP_START = "sleep_start"
CONF_SLEEP_END = "sleep_end"
CONF_SLEEP_MODE = "sleep_mode"  # "disabled" | "thresholds"
CONF_HYSTERESIS = "hysteresis"
CONF_BOOST_TOILET_MINUTES = "boost_toilet_minutes"
CONF_BOOST_SHOWER_MINUTES = "boost_shower_minutes"

# Defaults
DEFAULT_HUMIDITY_THRESHOLD = 65.0
DEFAULT_TEMP_THRESHOLD = 26.0
DEFAULT_HUMIDITY_THRESHOLD_NIGHT = 80.0
DEFAULT_TEMP_THRESHOLD_NIGHT = 28.0
DEFAULT_SLEEP_START = "22:00:00"
DEFAULT_SLEEP_END = "07:00:00"
DEFAULT_SLEEP_MODE = "thresholds"  # "disabled" deaktiviert Auto vollständig
DEFAULT_HYSTERESIS = 3.0
DEFAULT_BOOST_TOILET_MINUTES = 5
DEFAULT_BOOST_SHOWER_MINUTES = 30

SLEEP_MODES = ["disabled", "thresholds"]

# --- Status -------------------------------------------------------------------
STATE_IDLE = "idle"
STATE_AUTO = "auto"
STATE_BOOST = "boost"
STATE_MANUAL = "manual"

# --- Services -----------------------------------------------------------------
SERVICE_BOOST = "boost"
SERVICE_CANCEL_BOOST = "cancel_boost"
SERVICE_BOOST_TOILET = "boost_toilet"
SERVICE_BOOST_SHOWER = "boost_shower"

ATTR_DURATION = "duration"
ATTR_PRESET = "preset"

# Event Bus
SIGNAL_UPDATE = f"{DOMAIN}_update"
