"""Number-Plattform: Ziel-Werte (Temperatur/Feuchte, Tag/Nacht, Hysterese)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import PERCENTAGE, UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CONF_HUMIDITY_THRESHOLD,
    CONF_HUMIDITY_THRESHOLD_NIGHT,
    CONF_HYSTERESIS,
    CONF_TEMP_THRESHOLD,
    CONF_TEMP_THRESHOLD_NIGHT,
    DOMAIN,
)
from .controller import SmartFanController
from .entity import SmartBadlueferEntity


@dataclass(frozen=True)
class _NumberDef:
    key: str
    translation_key: str
    icon: str
    unit: str
    min_value: float
    max_value: float
    step: float
    getter: Callable[[SmartFanController], float]


_NUMBERS: tuple[_NumberDef, ...] = (
    _NumberDef(
        key=CONF_HUMIDITY_THRESHOLD,
        translation_key="humidity_threshold",
        icon="mdi:water-percent",
        unit=PERCENTAGE,
        min_value=20,
        max_value=95,
        step=1,
        getter=lambda c: c.options.humidity_threshold,
    ),
    _NumberDef(
        key=CONF_TEMP_THRESHOLD,
        translation_key="temperature_threshold",
        icon="mdi:thermometer",
        unit=UnitOfTemperature.CELSIUS,
        min_value=10,
        max_value=40,
        step=0.5,
        getter=lambda c: c.options.temperature_threshold,
    ),
    _NumberDef(
        key=CONF_HUMIDITY_THRESHOLD_NIGHT,
        translation_key="humidity_threshold_night",
        icon="mdi:weather-night",
        unit=PERCENTAGE,
        min_value=20,
        max_value=99,
        step=1,
        getter=lambda c: c.options.humidity_threshold_night,
    ),
    _NumberDef(
        key=CONF_TEMP_THRESHOLD_NIGHT,
        translation_key="temperature_threshold_night",
        icon="mdi:thermometer-lines",
        unit=UnitOfTemperature.CELSIUS,
        min_value=10,
        max_value=45,
        step=0.5,
        getter=lambda c: c.options.temperature_threshold_night,
    ),
    _NumberDef(
        key=CONF_HYSTERESIS,
        translation_key="hysteresis",
        icon="mdi:tune-variant",
        unit="",
        min_value=0,
        max_value=20,
        step=0.5,
        getter=lambda c: c.options.hysteresis,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    controller: SmartFanController = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(_SmartNumber(controller, d) for d in _NUMBERS)


class _SmartNumber(SmartBadlueferEntity, NumberEntity):
    _attr_mode = NumberMode.BOX

    def __init__(self, controller: SmartFanController, definition: _NumberDef) -> None:
        super().__init__(controller)
        self._def = definition
        self._attr_unique_id = f"{controller.entry.entry_id}_{definition.key}"
        self._attr_translation_key = definition.translation_key
        self._attr_icon = definition.icon
        self._attr_native_unit_of_measurement = definition.unit or None
        self._attr_native_min_value = definition.min_value
        self._attr_native_max_value = definition.max_value
        self._attr_native_step = definition.step

    @property
    def native_value(self) -> float:
        return self._def.getter(self.controller)

    async def async_set_native_value(self, value: float) -> None:
        await self.controller.async_set_option(self._def.key, float(value))
