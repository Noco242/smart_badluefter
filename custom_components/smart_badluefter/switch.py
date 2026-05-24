"""Switch-Plattform: Kill-Switch für Auto-Modus."""
from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .controller import SmartFanController
from .entity import SmartBadlueferEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    controller: SmartFanController = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([_AutoSwitch(controller)])


class _AutoSwitch(SmartBadlueferEntity, SwitchEntity):
    _attr_translation_key = "auto_enabled"
    _attr_icon = "mdi:auto-mode"

    def __init__(self, controller: SmartFanController) -> None:
        super().__init__(controller)
        self._attr_unique_id = f"{controller.entry.entry_id}_auto"

    @property
    def is_on(self) -> bool:
        return self.controller.auto_enabled

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self.controller.async_set_auto_enabled(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self.controller.async_set_auto_enabled(False)
