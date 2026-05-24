"""Kernlogik des Smart Badlüfters.

Der Controller hält den Zustand (idle / auto / boost / manual),
hört auf die Sensoren und steuert die Quell-Lüfter-Entität.
Frontend-Entitäten (Number/Switch/Time/Sensor) lesen und mutieren
ihre Werte ausschließlich über diesen Controller.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
import logging
from typing import Optional

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import (
    CALLBACK_TYPE,
    Event,
    HomeAssistant,
    State,
    callback,
)
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_track_state_change_event,
    async_track_point_in_time,
)
from homeassistant.util import dt as dt_util

from .const import (
    CONF_BOOST_SHOWER_MINUTES,
    CONF_BOOST_TOILET_MINUTES,
    CONF_FAN_ENTITY,
    CONF_HUMIDITY_SENSOR,
    CONF_HUMIDITY_THRESHOLD,
    CONF_HUMIDITY_THRESHOLD_NIGHT,
    CONF_HYSTERESIS,
    CONF_SLEEP_END,
    CONF_SLEEP_MODE,
    CONF_SLEEP_START,
    CONF_TEMP_SENSOR,
    CONF_TEMP_THRESHOLD,
    CONF_TEMP_THRESHOLD_NIGHT,
    DEFAULT_BOOST_SHOWER_MINUTES,
    DEFAULT_BOOST_TOILET_MINUTES,
    DEFAULT_HUMIDITY_THRESHOLD,
    DEFAULT_HUMIDITY_THRESHOLD_NIGHT,
    DEFAULT_HYSTERESIS,
    DEFAULT_SLEEP_END,
    DEFAULT_SLEEP_MODE,
    DEFAULT_SLEEP_START,
    DEFAULT_TEMP_THRESHOLD,
    DEFAULT_TEMP_THRESHOLD_NIGHT,
    DOMAIN,
    SIGNAL_UPDATE,
    STATE_AUTO,
    STATE_BOOST,
    STATE_IDLE,
    STATE_MANUAL,
)

_LOGGER = logging.getLogger(__name__)


def _parse_time(value: str | time | None, fallback: str) -> time:
    """Robustes time-Parsing, akzeptiert 'HH:MM' und 'HH:MM:SS'."""
    if isinstance(value, time):
        return value
    raw = value or fallback
    try:
        parts = [int(p) for p in raw.split(":")]
    except (ValueError, AttributeError):
        parts = [int(p) for p in fallback.split(":")]
    while len(parts) < 3:
        parts.append(0)
    return time(parts[0], parts[1], parts[2])


@dataclass
class ControllerOptions:
    """Gebündelte, validierte Optionen aus dem Config Entry."""

    humidity_threshold: float = DEFAULT_HUMIDITY_THRESHOLD
    temperature_threshold: float = DEFAULT_TEMP_THRESHOLD
    humidity_threshold_night: float = DEFAULT_HUMIDITY_THRESHOLD_NIGHT
    temperature_threshold_night: float = DEFAULT_TEMP_THRESHOLD_NIGHT
    sleep_start: time = field(default_factory=lambda: _parse_time(None, DEFAULT_SLEEP_START))
    sleep_end: time = field(default_factory=lambda: _parse_time(None, DEFAULT_SLEEP_END))
    sleep_mode: str = DEFAULT_SLEEP_MODE  # disabled | thresholds
    hysteresis: float = DEFAULT_HYSTERESIS
    boost_toilet_minutes: int = DEFAULT_BOOST_TOILET_MINUTES
    boost_shower_minutes: int = DEFAULT_BOOST_SHOWER_MINUTES

    @classmethod
    def from_entry(cls, entry: ConfigEntry) -> "ControllerOptions":
        data = {**entry.data, **entry.options}
        return cls(
            humidity_threshold=float(data.get(CONF_HUMIDITY_THRESHOLD, DEFAULT_HUMIDITY_THRESHOLD)),
            temperature_threshold=float(data.get(CONF_TEMP_THRESHOLD, DEFAULT_TEMP_THRESHOLD)),
            humidity_threshold_night=float(
                data.get(CONF_HUMIDITY_THRESHOLD_NIGHT, DEFAULT_HUMIDITY_THRESHOLD_NIGHT)
            ),
            temperature_threshold_night=float(
                data.get(CONF_TEMP_THRESHOLD_NIGHT, DEFAULT_TEMP_THRESHOLD_NIGHT)
            ),
            sleep_start=_parse_time(data.get(CONF_SLEEP_START), DEFAULT_SLEEP_START),
            sleep_end=_parse_time(data.get(CONF_SLEEP_END), DEFAULT_SLEEP_END),
            sleep_mode=str(data.get(CONF_SLEEP_MODE, DEFAULT_SLEEP_MODE)),
            hysteresis=float(data.get(CONF_HYSTERESIS, DEFAULT_HYSTERESIS)),
            boost_toilet_minutes=int(
                data.get(CONF_BOOST_TOILET_MINUTES, DEFAULT_BOOST_TOILET_MINUTES)
            ),
            boost_shower_minutes=int(
                data.get(CONF_BOOST_SHOWER_MINUTES, DEFAULT_BOOST_SHOWER_MINUTES)
            ),
        )


class SmartFanController:
    """Steuert einen physischen Lüfter basierend auf Sensoren, Zeit und Boost."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.options = ControllerOptions.from_entry(entry)

        self.fan_entity_id: str = entry.data[CONF_FAN_ENTITY]
        self.temperature_sensor_id: str = entry.data[CONF_TEMP_SENSOR]
        self.humidity_sensor_id: str = entry.data[CONF_HUMIDITY_SENSOR]

        self._mode: str = STATE_IDLE
        self._boost_until: Optional[datetime] = None
        self._boost_preset: Optional[str] = None
        self._auto_enabled: bool = True  # Kill-Switch via Schalter-Entität

        self._unsub_state: list[CALLBACK_TYPE] = []
        self._unsub_timer: Optional[CALLBACK_TYPE] = None
        self._evaluating = asyncio.Lock()

    # ---------- Lifecycle -----------------------------------------------------
    async def async_setup(self) -> None:
        """Listener und initiale Evaluation aufsetzen."""
        self._unsub_state.append(
            async_track_state_change_event(
                self.hass,
                [self.temperature_sensor_id, self.humidity_sensor_id, self.fan_entity_id],
                self._handle_state_event,
            )
        )
        # Initiale Auswertung beim Start verzögern, bis HA komplett oben ist.
        async def _initial(_now=None):
            await self.async_evaluate()

        self.hass.async_create_task(_initial())

    async def async_shutdown(self) -> None:
        for unsub in self._unsub_state:
            unsub()
        self._unsub_state.clear()
        if self._unsub_timer:
            self._unsub_timer()
            self._unsub_timer = None

    def reload_options(self) -> None:
        """Optionen aus dem Entry neu laden."""
        self.options = ControllerOptions.from_entry(self.entry)
        self._notify()

    # ---------- Public API für Entitäten / Services ---------------------------
    @property
    def mode(self) -> str:
        return self._mode

    @property
    def auto_enabled(self) -> bool:
        return self._auto_enabled

    @property
    def boost_until(self) -> Optional[datetime]:
        return self._boost_until

    @property
    def boost_preset(self) -> Optional[str]:
        return self._boost_preset

    def get_current_humidity(self) -> Optional[float]:
        return self._read_float(self.humidity_sensor_id)

    def get_current_temperature(self) -> Optional[float]:
        return self._read_float(self.temperature_sensor_id)

    def is_sleep_now(self, now: Optional[datetime] = None) -> bool:
        """Liegt jetzt im konfigurierten Ruhefenster?"""
        now = now or dt_util.now()
        return self._in_window(now.time(), self.options.sleep_start, self.options.sleep_end)

    @staticmethod
    def _in_window(t: time, start: time, end: time) -> bool:
        if start == end:
            return False
        if start < end:
            return start <= t < end
        # Mitternacht überspannt: z.B. 22:00 - 07:00
        return t >= start or t < end

    async def async_set_auto_enabled(self, enabled: bool) -> None:
        self._auto_enabled = enabled
        await self.async_evaluate()

    async def async_set_option(self, key: str, value) -> None:
        """Eine Option aktualisieren und in den Config Entry persistieren."""
        new_options = {**self.entry.options, key: value}
        self.hass.config_entries.async_update_entry(self.entry, options=new_options)
        # Reload-Listener bügelt den Rest, aber lokale Sicht direkt aktualisieren:
        self.options = ControllerOptions.from_entry(self.entry)
        await self.async_evaluate()

    async def async_start_boost(
        self, duration_seconds: int, preset: Optional[str] = None
    ) -> None:
        """Manuellen Boost starten, überschreibt Auto- und Ruhephasen-Logik."""
        duration_seconds = max(1, int(duration_seconds))
        self._boost_until = dt_util.utcnow() + timedelta(seconds=duration_seconds)
        self._boost_preset = preset
        self._mode = STATE_BOOST

        if self._unsub_timer:
            self._unsub_timer()
        self._unsub_timer = async_track_point_in_time(
            self.hass, self._boost_timer_expired, self._boost_until
        )

        await self._turn_fan_on()
        self._notify()

    async def async_cancel_boost(self) -> None:
        if self._unsub_timer:
            self._unsub_timer()
            self._unsub_timer = None
        self._boost_until = None
        self._boost_preset = None
        await self.async_evaluate()

    # ---------- Interne Events ------------------------------------------------
    @callback
    def _handle_state_event(self, event: Event) -> None:
        self.hass.async_create_task(self.async_evaluate())

    async def _boost_timer_expired(self, now: datetime) -> None:
        self._unsub_timer = None
        self._boost_until = None
        self._boost_preset = None
        await self.async_evaluate()

    # ---------- Kern-Auswertung ----------------------------------------------
    async def async_evaluate(self) -> None:
        """Aktuellen Soll-Zustand des Lüfters berechnen und anwenden."""
        async with self._evaluating:
            # Boost hat höchste Priorität.
            if self._boost_until is not None:
                if dt_util.utcnow() < self._boost_until:
                    self._mode = STATE_BOOST
                    await self._turn_fan_on()
                    self._notify()
                    return
                # abgelaufen
                self._boost_until = None
                self._boost_preset = None

            # Auto-Logik
            if not self._auto_enabled:
                self._mode = STATE_MANUAL
                self._notify()
                return

            sleep = self.is_sleep_now()
            if sleep and self.options.sleep_mode == "disabled":
                # Während Ruhephase kein Auto.
                if self._is_fan_on():
                    await self._turn_fan_off()
                self._mode = STATE_IDLE
                self._notify()
                return

            humidity = self.get_current_humidity()
            temperature = self.get_current_temperature()

            humidity_target = (
                self.options.humidity_threshold_night
                if sleep
                else self.options.humidity_threshold
            )
            temperature_target = (
                self.options.temperature_threshold_night
                if sleep
                else self.options.temperature_threshold
            )

            should_on = False
            if humidity is not None and humidity >= humidity_target:
                should_on = True
            if temperature is not None and temperature >= temperature_target:
                should_on = True

            # Hysterese: erst unter (Ziel - Hysterese) wieder ausschalten,
            # wenn der Lüfter bereits via Auto läuft.
            if not should_on and self._mode == STATE_AUTO:
                hyst = self.options.hysteresis
                still = False
                if humidity is not None and humidity > (humidity_target - hyst):
                    still = True
                if temperature is not None and temperature > (temperature_target - hyst):
                    still = True
                should_on = still

            if should_on:
                self._mode = STATE_AUTO
                await self._turn_fan_on()
            else:
                self._mode = STATE_IDLE
                await self._turn_fan_off()
            self._notify()

    # ---------- Lüfter-IO -----------------------------------------------------
    def _is_fan_on(self) -> bool:
        st = self.hass.states.get(self.fan_entity_id)
        return bool(st and st.state == STATE_ON)

    async def _turn_fan_on(self) -> None:
        if self._is_fan_on():
            return
        domain = self.fan_entity_id.split(".", 1)[0]
        await self.hass.services.async_call(
            domain, "turn_on", {"entity_id": self.fan_entity_id}, blocking=False
        )

    async def _turn_fan_off(self) -> None:
        if not self._is_fan_on():
            return
        domain = self.fan_entity_id.split(".", 1)[0]
        await self.hass.services.async_call(
            domain, "turn_off", {"entity_id": self.fan_entity_id}, blocking=False
        )

    def _read_float(self, entity_id: str) -> Optional[float]:
        st: Optional[State] = self.hass.states.get(entity_id)
        if st is None or st.state in (STATE_UNAVAILABLE, STATE_UNKNOWN, None, ""):
            return None
        try:
            return float(st.state)
        except (TypeError, ValueError):
            _LOGGER.debug("Sensor %s liefert keinen float: %s", entity_id, st.state)
            return None

    # ---------- Benachrichtigungen an Entitäten ------------------------------
    def _notify(self) -> None:
        async_dispatcher_send(self.hass, f"{SIGNAL_UPDATE}_{self.entry.entry_id}")
