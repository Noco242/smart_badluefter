"""Fan-Plattform: virtuelle Lüfter-Entität, die den Controller widerspiegelt."""
from __future__ import annotations

from typing import Any

from homeassistant.components.fan import FanEntity, FanEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, STATE_BOOST
from .controller import SmartFanController
from .entity import SmartBadlueferEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    controller: SmartFanController = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([SmartBadlueferFan(controller)])


class SmartBadlueferFan(SmartBadlueferEntity, FanEntity):
    """Spiegelt den Quell-Lüfter, fügt aber Auto-/Boost-Status hinzu."""

    _attr_translation_key = "smart_fan"
    _attr_supported_features = FanEntityFeature.TURN_ON | FanEntityFeature.TURN_OFF

    def __init__(self, controller: SmartFanController) -> None:
        super().__init__(controller)
        self._attr_unique_id = f"{controller.entry.entry_id}_fan"
        self._attr_name = None  # Device-Name wird übernommen

    @property
    def is_on(self) -> bool:
        st = self.hass.states.get(self.controller.fan_entity_id)
        return bool(st and st.state == STATE_ON)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        boost_until = self.controller.boost_until
        return {
            "mode": self.controller.mode,
            "boost_preset": self.controller.boost_preset,
            "boost_until": boost_until.isoformat() if boost_until else None,
            "current_humidity": self.controller.get_current_humidity(),
            "current_temperature": self.controller.get_current_temperature(),
            "sleep_active": self.controller.is_sleep_now(),
            "source_fan": self.controller.fan_entity_id,
        }

    async def async_turn_on(self, **kwargs: Any) -> None:
        # Manuelles Einschalten ohne Zeitlimit → langer „Boost".
        await self.controller.async_start_boost(24 * 3600, preset="manual")

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self.controller.async_cancel_boost()
        # Falls Auto-Logik den Lüfter trotzdem an hätte: Kill-Switch geht über
        # den dedizierten Switch.
