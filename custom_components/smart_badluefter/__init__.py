"""Smart Badlüfter Integration - Setup-Einstiegspunkt."""
from __future__ import annotations

import logging

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv

from .const import (
    ATTR_DURATION,
    ATTR_PRESET,
    DOMAIN,
    PLATFORMS,
    SERVICE_BOOST,
    SERVICE_BOOST_SHOWER,
    SERVICE_BOOST_TOILET,
    SERVICE_CANCEL_BOOST,
)
from .controller import SmartFanController

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """YAML-Setup ist nicht unterstützt - nur Config Flow."""
    hass.data.setdefault(DOMAIN, {})
    _register_services(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Einen einzelnen Config Entry aufsetzen."""
    controller = SmartFanController(hass, entry)
    await controller.async_setup()
    hass.data[DOMAIN][entry.entry_id] = controller

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Config Entry sauber abbauen."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        controller: SmartFanController = hass.data[DOMAIN].pop(entry.entry_id)
        await controller.async_shutdown()
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload bei Options-Änderungen."""
    await hass.config_entries.async_reload(entry.entry_id)


def _register_services(hass: HomeAssistant) -> None:
    """Service-Calls einmalig (domain-weit) registrieren."""
    if hass.services.has_service(DOMAIN, SERVICE_BOOST):
        return

    async def _resolve(call: ServiceCall) -> list[SmartFanController]:
        """Aus entity_id / device_id den passenden Controller finden."""
        controllers: list[SmartFanController] = []
        targets = call.data.get("entity_id") or call.data.get("device_id")
        all_ctrls: list[SmartFanController] = list(hass.data.get(DOMAIN, {}).values())
        if not targets:
            return all_ctrls
        if isinstance(targets, str):
            targets = [targets]
        for ctrl in all_ctrls:
            if ctrl.fan_entity_id in targets or ctrl.entry.entry_id in targets:
                controllers.append(ctrl)
        return controllers or all_ctrls

    async def boost_service(call: ServiceCall) -> None:
        duration = call.data[ATTR_DURATION]
        preset = call.data.get(ATTR_PRESET)
        for ctrl in await _resolve(call):
            await ctrl.async_start_boost(duration, preset=preset)

    async def cancel_boost_service(call: ServiceCall) -> None:
        for ctrl in await _resolve(call):
            await ctrl.async_cancel_boost()

    async def boost_toilet_service(call: ServiceCall) -> None:
        for ctrl in await _resolve(call):
            await ctrl.async_start_boost(
                ctrl.options.boost_toilet_minutes * 60, preset="toilet"
            )

    async def boost_shower_service(call: ServiceCall) -> None:
        for ctrl in await _resolve(call):
            await ctrl.async_start_boost(
                ctrl.options.boost_shower_minutes * 60, preset="shower"
            )

    hass.services.async_register(
        DOMAIN,
        SERVICE_BOOST,
        boost_service,
        schema=vol.Schema(
            {
                vol.Optional("entity_id"): cv.entity_ids,
                vol.Optional("device_id"): vol.Any(cv.string, [cv.string]),
                vol.Required(ATTR_DURATION): vol.All(
                    vol.Coerce(int), vol.Range(min=1, max=24 * 3600)
                ),
                vol.Optional(ATTR_PRESET): cv.string,
            }
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_CANCEL_BOOST,
        cancel_boost_service,
        schema=vol.Schema(
            {
                vol.Optional("entity_id"): cv.entity_ids,
                vol.Optional("device_id"): vol.Any(cv.string, [cv.string]),
            }
        ),
    )
    hass.services.async_register(
        DOMAIN, SERVICE_BOOST_TOILET, boost_toilet_service
    )
    hass.services.async_register(
        DOMAIN, SERVICE_BOOST_SHOWER, boost_shower_service
    )
