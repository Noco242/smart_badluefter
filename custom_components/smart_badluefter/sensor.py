"""Sensor-Plattform: aktueller Modus + verbleibende Boost-Zeit."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from homeassistant.components.sensor import SensorEntity, SensorDeviceClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import DOMAIN, STATE_AUTO, STATE_BOOST, STATE_IDLE, STATE_MANUAL
from .controller import SmartFanController
from .entity import SmartBadlueferEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    controller: SmartFanController = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([_ModeSensor(controller), _BoostRemainingSensor(controller)])


class _ModeSensor(SmartBadlueferEntity, SensorEntity):
    _attr_translation_key = "mode"
    _attr_icon = "mdi:state-machine"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = [STATE_IDLE, STATE_AUTO, STATE_BOOST, STATE_MANUAL]

    def __init__(self, controller: SmartFanController) -> None:
        super().__init__(controller)
        self._attr_unique_id = f"{controller.entry.entry_id}_mode"

    @property
    def native_value(self) -> str:
        return self.controller.mode

    @property
    def extra_state_attributes(self) -> dict:
        return {"boost_preset": self.controller.boost_preset}


class _BoostRemainingSensor(SmartBadlueferEntity, SensorEntity):
    _attr_translation_key = "boost_remaining"
    _attr_icon = "mdi:timer-sand"
    _attr_native_unit_of_measurement = "s"

    def __init__(self, controller: SmartFanController) -> None:
        super().__init__(controller)
        self._attr_unique_id = f"{controller.entry.entry_id}_boost_remaining"

    @property
    def native_value(self) -> Optional[int]:
        until: Optional[datetime] = self.controller.boost_until
        if until is None:
            return 0
        remaining = (until - dt_util.utcnow()).total_seconds()
        return max(0, int(remaining))
