"""Basisklasse für alle Entitäten dieser Integration."""
from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .const import DOMAIN, SIGNAL_UPDATE
from .controller import SmartFanController


class SmartBadlueferEntity(Entity):
    """Hängt alle Entitäten an dasselbe HA-Device und subscribed Updates."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, controller: SmartFanController) -> None:
        self.controller = controller
        self._attr_unique_id_base = controller.entry.entry_id

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self.controller.entry.entry_id)},
            name=self.controller.entry.title,
            manufacturer="Smart Badlüfter",
            model="Virtual Controller",
            entry_type=None,
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                f"{SIGNAL_UPDATE}_{self.controller.entry.entry_id}",
                self.async_write_ha_state,
            )
        )
