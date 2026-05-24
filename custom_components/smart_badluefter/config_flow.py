"""Config & Options Flow für Smart Badlüfter."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers import selector

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
    SLEEP_MODES,
)


def _entity_selector(domain: str | list[str], device_class: str | None = None):
    cfg: dict[str, Any] = {"domain": domain}
    if device_class:
        cfg["device_class"] = device_class
    return selector.EntitySelector(selector.EntitySelectorConfig(**cfg))


STEP_USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_NAME, default="Badezimmer Lüfter"): str,
        vol.Required(CONF_FAN_ENTITY): _entity_selector(["fan", "switch", "input_boolean"]),
        vol.Required(CONF_TEMP_SENSOR): _entity_selector("sensor", "temperature"),
        vol.Required(CONF_HUMIDITY_SENSOR): _entity_selector("sensor", "humidity"),
    }
)


class SmartBadlueferConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Initialer Setup-Flow."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            await self.async_set_unique_id(
                f"{user_input[CONF_FAN_ENTITY]}_{user_input[CONF_HUMIDITY_SENSOR]}"
            )
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title=user_input[CONF_NAME],
                data=user_input,
                options=_default_options(),
            )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_SCHEMA,
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> "SmartBadlueferOptionsFlow":
        return SmartBadlueferOptionsFlow(config_entry)


class SmartBadlueferOptionsFlow(config_entries.OptionsFlow):
    """Optionen nachträglich anpassen."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current = {**_default_options(), **self.config_entry.options}

        schema = vol.Schema(
            {
                vol.Required(
                    CONF_HUMIDITY_THRESHOLD, default=current[CONF_HUMIDITY_THRESHOLD]
                ): vol.All(vol.Coerce(float), vol.Range(min=20, max=95)),
                vol.Required(
                    CONF_TEMP_THRESHOLD, default=current[CONF_TEMP_THRESHOLD]
                ): vol.All(vol.Coerce(float), vol.Range(min=10, max=40)),
                vol.Required(
                    CONF_HUMIDITY_THRESHOLD_NIGHT,
                    default=current[CONF_HUMIDITY_THRESHOLD_NIGHT],
                ): vol.All(vol.Coerce(float), vol.Range(min=20, max=99)),
                vol.Required(
                    CONF_TEMP_THRESHOLD_NIGHT,
                    default=current[CONF_TEMP_THRESHOLD_NIGHT],
                ): vol.All(vol.Coerce(float), vol.Range(min=10, max=45)),
                vol.Required(
                    CONF_SLEEP_START, default=current[CONF_SLEEP_START]
                ): selector.TimeSelector(),
                vol.Required(
                    CONF_SLEEP_END, default=current[CONF_SLEEP_END]
                ): selector.TimeSelector(),
                vol.Required(
                    CONF_SLEEP_MODE, default=current[CONF_SLEEP_MODE]
                ): selector.SelectSelector(
                    selector.SelectSelectorConfig(
                        options=SLEEP_MODES, translation_key="sleep_mode"
                    )
                ),
                vol.Required(
                    CONF_HYSTERESIS, default=current[CONF_HYSTERESIS]
                ): vol.All(vol.Coerce(float), vol.Range(min=0, max=20)),
                vol.Required(
                    CONF_BOOST_TOILET_MINUTES,
                    default=current[CONF_BOOST_TOILET_MINUTES],
                ): vol.All(vol.Coerce(int), vol.Range(min=1, max=120)),
                vol.Required(
                    CONF_BOOST_SHOWER_MINUTES,
                    default=current[CONF_BOOST_SHOWER_MINUTES],
                ): vol.All(vol.Coerce(int), vol.Range(min=1, max=240)),
            }
        )

        return self.async_show_form(step_id="init", data_schema=schema)


def _default_options() -> dict[str, Any]:
    return {
        CONF_HUMIDITY_THRESHOLD: DEFAULT_HUMIDITY_THRESHOLD,
        CONF_TEMP_THRESHOLD: DEFAULT_TEMP_THRESHOLD,
        CONF_HUMIDITY_THRESHOLD_NIGHT: DEFAULT_HUMIDITY_THRESHOLD_NIGHT,
        CONF_TEMP_THRESHOLD_NIGHT: DEFAULT_TEMP_THRESHOLD_NIGHT,
        CONF_SLEEP_START: DEFAULT_SLEEP_START,
        CONF_SLEEP_END: DEFAULT_SLEEP_END,
        CONF_SLEEP_MODE: DEFAULT_SLEEP_MODE,
        CONF_HYSTERESIS: DEFAULT_HYSTERESIS,
        CONF_BOOST_TOILET_MINUTES: DEFAULT_BOOST_TOILET_MINUTES,
        CONF_BOOST_SHOWER_MINUTES: DEFAULT_BOOST_SHOWER_MINUTES,
    }
