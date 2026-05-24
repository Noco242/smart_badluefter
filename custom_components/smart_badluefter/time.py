"""Time-Plattform: Ruhephase-Start und -Ende einstellbar."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import time
from typing import Callable

from homeassistant.components.time import TimeEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_SLEEP_END, CONF_SLEEP_START, DOMAIN
from .controller import SmartFanController
from .entity import SmartBadlueferEntity


@dataclass(frozen=True)
class _TimeDef:
    key: str
    translation_key: str
    icon: str
    getter: Callable[[SmartFanController], time]


_TIMES: tuple[_TimeDef, ...] = (
    _TimeDef(CONF_SLEEP_START, "sleep_start", "mdi:weather-night",
             lambda c: c.options.sleep_start),
    _TimeDef(CONF_SLEEP_END, "sleep_end", "mdi:weather-sunny",
             lambda c: c.options.sleep_end),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    controller: SmartFanController = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(_SleepTime(controller, d) for d in _TIMES)


class _SleepTime(SmartBadlueferEntity, TimeEntity):
    def __init__(self, controller: SmartFanController, definition: _TimeDef) -> None:
        super().__init__(controller)
        self._def = definition
        self._attr_unique_id = f"{controller.entry.entry_id}_{definition.key}"
        self._attr_translation_key = definition.translation_key
        self._attr_icon = definition.icon

    @property
    def native_value(self) -> time:
        return self._def.getter(self.controller)

    async def async_set_value(self, value: time) -> None:
        # Als String persistieren - homeassistant.util.dt erwartet das gleiche
        # Format wie der TimeSelector beim Config-Flow.
        await self.controller.async_set_option(self._def.key, value.strftime("%H:%M:%S"))
