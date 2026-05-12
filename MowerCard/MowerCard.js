// Version: 1.0

class MowerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this.config = { ...MowerCard.getStubConfig(), ...config };
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  static getStubConfig() {
    return {
      name: "Mähroboter",
      mower_entity: "lawn_mower.mahroboter",
      battery_entity: "sensor.mahroboter_batterie",
      error_entity: "sensor.mahroboter_fehler",
      charging_entity: "binary_sensor.mahroboter_ladevorgang",
      rain_sensor_entity: "binary_sensor.m_regensensor",
      rain_delay_entity: "number.m_regenverzogerung",
      rain_delay_remaining_entity: "sensor.m_verbleibende_regenverzogerung",
      torque_entity: "number.m_drehmoment",
      edge_cut_entity: "button.m_kantenschnitt",
      auto_firmware_entity: "switch.m_automatische_firmware_aktualisierung",
      firmware_entity: "update.mahroboter_firmware",
    };
  }

  static getConfigElement() {
    return document.createElement("mower-card-editor");
  }

  _escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  _stateLabel(state) {
    const labels = {
      mowing: "Mäht",
      docked: "Ausgangsposition",
      paused: "Pausiert",
      returning: "Fährt zurück",
      idle: "Bereit",
      error: "Fehler",
      unavailable: "Nicht verfügbar",
      starting: "Startet",
      edgecut: "Kantenschnitt",
      zoning: "Zonenfahrt",
      searching_zone: "Sucht Zone",
      rain_delayed: "Regenverzögerung",
      escaped_digital_fence: "Außerhalb Bereich",
    };
    return labels[state] || state;
  }

  _errorLabel(code) {
    const labels = {
      unknown: "Unbekannter Fehler",
      no_error: "Kein Fehler",
      trapped: "Feststeckend",
      lifted: "Angehoben",
      wire_missing: "Begrenzungskabel fehlt",
      outside_wire: "Außerhalb des Begrenzungskabels",
      rain_delay: "Regenverzögerung",
      close_door_to_mow: "Klappe schließen zum Mähen",
      close_door_to_go_home: "Klappe schließen zur Heimfahrt",
      blade_motor_blocked: "Messermotor blockiert",
      wheel_motor_blocked: "Radmotor blockiert",
      trapped_timeout: "Feststeckend (Zeitüberschreitung)",
      upside_down: "Umgekippt",
      battery_low: "Batterie leer",
      reverse_wire: "Kabel-Polarität verkehrt",
      charge_error: "Ladefehler",
      timeout_finding_home: "Heimfahrt Zeitüberschreitung",
      locked: "Gesperrt",
      battery_temperature_error: "Batterietemperaturfehler",
      battery_trunk_open_timeout: "Kofferraumklappe offen (Zeitüberschreitung)",
      wire_sync: "Kabelsynchronisation",
      charging_station_docking_error: "Andockfehler Ladestation",
      hbi_error: "HBI-Fehler",
      ota_error: "Update-Fehler (OTA)",
      map_error: "Kartenfehler",
      excessive_slope: "Steigung zu groß",
      unreachable_zone: "Zone nicht erreichbar",
      unreachable_charging_station: "Ladestation nicht erreichbar",
      insufficient_sensor_data: "Unzureichende Sensordaten",
      training_start_disallowed: "Training nicht erlaubt",
      camera_error: "Kamerafehler",
      mapping_exploration_required: "Kartenerkundung erforderlich",
      mapping_exploration_failed: "Kartenerkundung fehlgeschlagen",
      rfid_reader_error: "RFID-Leserfehler",
      headlight_error: "Scheinwerferfehler",
      missing_charging_station: "Ladestation nicht gefunden",
      blade_height_adjustment_blocked: "Schnitthöhenverstellung blockiert",
    };
    return labels[code] || code;
  }

  _formatLastChanged(entity) {
    if (!entity) return "";
    const date = new Date(entity.last_changed);
    const now = new Date();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const time = `${hours}:${minutes}`;
    if (date.toDateString() === now.toDateString()) return `heute ${time}`;
    if (date.toDateString() === new Date(now - 86400000).toDateString())
      return `gestern ${time}`;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}. ${time}`;
  }

  _hasError(errorEntity) {
    if (!errorEntity) return false;
    const state = errorEntity.state;
    return (
      state !== "" &&
      state !== "0" &&
      state !== "none" &&
      state !== "no_error" &&
      state !== "unknown" &&
      state !== "unavailable"
    );
  }

  static get _css() {
    return `
      .card-container {
        padding: 16px 16px 16px 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 280px;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .mower-name {
        font-size: 1.1em;
        font-weight: bold;
        color: var(--primary-text-color);
        flex: 1;
      }

      .header-battery {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-right: 16px;
        height: 32px;
      }

      .header-battery-icon {
        --mdc-icon-size: 20px;
        color: var(--success-color, #4caf50);
      }

      .header-battery-icon--low {
        color: var(--error-color, #c00);
      }

      .header-battery-label {
        font-size: 0.85em;
        color: var(--secondary-text-color);
      }

      .info-row {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        gap: 10px;
        flex: 1;
      }

      .info-status-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .info-time {
        font-size: 0.85em;
        color: var(--secondary-text-color);
      }

      .status-badge {
        font-size: 1.2em;
        font-weight: bold;
      }

      .status-badge--mowing,
      .status-badge--edgecut,
      .status-badge--zoning,
      .status-badge--idle {
        color: var(--success-color, #4caf50);
      }

      .status-badge--docked,
      .status-badge--returning,
      .status-badge--searching_zone,
      .status-badge--rain_delayed {
        color: var(--info-color, #2196f3);
      }

      .status-badge--paused,
      .status-badge--starting {
        color: var(--warning-color, #ff9800);
      }

      .status-badge--error,
      .status-badge--escaped_digital_fence,
      .status-badge--unavailable {
        color: var(--error-color, #c00);
      }

      .error-container {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding-left: 10px;
      }

      .error-badge {
        font-size: 1.2em;
        font-weight: bold;
        color: var(--error-color, #c00);
      }

      .error-reason {
        font-size: 0.9em;
        color: var(--error-color, #c00);
      }

      .update-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        background: var(--secondary-background-color);
        border-radius: 8px;
        border-left: 3px solid var(--warning-color, #ff9800);
      }

      .update-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .update-title {
        font-size: 0.85em;
        color: var(--primary-text-color);
      }

      .update-version {
        font-size: 0.78em;
        color: var(--secondary-text-color);
      }

      .update-install-button {
        flex-shrink: 0;
        padding: 8px 14px;
        border: none;
        border-radius: 5px;
        background: var(--warning-color, #ff9800);
        color: white;
        font-size: 0.85em;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .update-install-button:hover {
        opacity: 0.85;
      }

      .update-install-button ha-icon {
        --mdc-icon-size: 18px;
      }

      .rain-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .rain-indicator ha-icon {
        --mdc-icon-size: 20px;
        flex-shrink: 0;
        color: #64b5f6;
      }

      .rain-indicator-text {
        font-size: 0.85em;
        color: var(--secondary-text-color);
      }

      .button-row {
        display: flex;
        gap: 8px;
      }

      .button-base {
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: 5px;
        font-size: 0.9em;
        cursor: pointer;
        color: white;
      }

      .button-base:disabled {
        background: var(--disabled-color, #bdbdbd);
        color: var(--secondary-text-color);
        cursor: not-allowed;
      }

      .button-base ha-icon {
        --mdc-icon-size: 20px;
      }

      .button-primary {
        background: var(--primary-color);
      }

      .button-primary:hover:not(:disabled) {
        opacity: 0.85;
      }

      .button-primary:active:not(:disabled) {
        opacity: 0.7;
      }

      .button-settings {
        flex: 0 0 auto;
        padding: 6px;
        background: transparent;
        color: var(--secondary-text-color);
      }

      .button-settings:hover {
        color: var(--primary-text-color);
      }
    `;
  }

  _showSettingsPopup() {
    if (document.querySelector(".mower-settings-wrapper")) return;

    const cardRect = this.getBoundingClientRect();

    const torqueEntity = this.config.torque_entity
      ? this._hass.states[this.config.torque_entity]
      : null;
    const rainDelayEntity = this.config.rain_delay_entity
      ? this._hass.states[this.config.rain_delay_entity]
      : null;

    const torqueValue = torqueEntity ? parseFloat(torqueEntity.state) : null;
    const torqueStep = torqueEntity
      ? parseFloat(torqueEntity.attributes.step) || 1
      : 1;
    const torqueMin = torqueEntity
      ? (parseFloat(torqueEntity.attributes.min) ?? -50)
      : -50;
    const torqueMax = torqueEntity
      ? (parseFloat(torqueEntity.attributes.max) ?? 50)
      : 50;

    const rainDelayValue = rainDelayEntity
      ? parseFloat(rainDelayEntity.state)
      : null;
    const rainDelayStep = rainDelayEntity
      ? parseFloat(rainDelayEntity.attributes.step) || 1
      : 1;
    const rainDelayMin = rainDelayEntity
      ? (parseFloat(rainDelayEntity.attributes.min) ?? 0)
      : 0;
    const rainDelayMax = rainDelayEntity
      ? (parseFloat(rainDelayEntity.attributes.max) ?? 1440)
      : 1440;

    const dialog = document.createElement("dialog");
    dialog.className = "mower-settings-wrapper";
    dialog.style.cssText = `padding:0;border:none;background:rgba(0,0,0,0.5);margin:0;position:fixed;left:${cardRect.left}px;top:${cardRect.top}px;width:${cardRect.width}px;height:${cardRect.height}px;max-width:none;max-height:none;display:flex;align-items:center;justify-content:center;overflow:hidden`;

    dialog.innerHTML = `
      <style>
        dialog.mower-settings-wrapper::backdrop {
          background: transparent;
        }

        .mower-settings-popup {
          background: var(--card-background-color, #2d2d2d);
          border-radius: 16px;
          padding: 0;
          width: 100%;
          max-width: 320px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          overflow: hidden;
        }

        .mower-settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--divider-color, #444);
        }

        .mower-settings-title {
          font-size: 1em;
          font-weight: bold;
          color: var(--primary-text-color);
        }

        .mower-settings-close {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--secondary-text-color);
          padding: 4px;
          display: flex;
          align-items: center;
          border-radius: 5px;
        }

        .mower-settings-close ha-icon {
          --mdc-icon-size: 20px;
        }

        .mower-settings-body {
          padding: 12px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .mower-settings-section-title {
          font-size: 0.75em;
          font-weight: bold;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: -8px;
        }

        .mower-settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .mower-settings-label {
          font-size: 0.9em;
          color: var(--primary-text-color);
          flex: 1;
        }

        .mower-settings-value {
          font-size: 0.9em;
          font-weight: bold;
          color: var(--primary-color);
        }

        .mower-settings-slider {
          width: 100%;
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
          margin: 4px 0 0;
        }

        .mower-settings-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }

        .mower-settings-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }

        .mower-settings-divider {
          border: none;
          border-top: 1px solid var(--divider-color, #444);
          margin: 0;
        }
      </style>

      <div class="mower-settings-popup">
        <div class="mower-settings-header">
          <span class="mower-settings-title">Einstellungen</span>
          <button class="mower-settings-close">
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </div>
        <div class="mower-settings-body">

          ${torqueEntity ? `
          <div class="mower-settings-section-title">Mähwerk</div>
          <div class="mower-settings-row">
            <span class="mower-settings-label">Drehmoment</span>
            <span class="mower-settings-value" id="torque-value">${torqueValue}%</span>
          </div>
          <input type="range"
            class="mower-settings-slider"
            id="torque-slider"
            min="${torqueMin}"
            max="${torqueMax}"
            step="${torqueStep}"
            value="${torqueValue}">
          <hr class="mower-settings-divider">
          ` : ""}

          ${rainDelayEntity ? `
          <div class="mower-settings-section-title">Regen</div>
          <div class="mower-settings-row">
            <span class="mower-settings-label">Verzögerung</span>
            <span class="mower-settings-value" id="rain-delay-value"></span>
          </div>
          <input type="range"
            class="mower-settings-slider"
            id="rain-delay-slider"
            min="${rainDelayMin}"
            max="${rainDelayMax}"
            step="${rainDelayStep}"
            value="${rainDelayValue}">
          <div style="height:12px"></div>
          ` : ""}

        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    dialog.showModal();

    const closePopup = () => {
      dialog.close();
      dialog.remove();
      document.removeEventListener("keydown", onEsc, { capture: true });
    };
    const onEsc = (event) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        event.preventDefault();
        closePopup();
      }
    };
    document.addEventListener("keydown", onEsc, { capture: true });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closePopup();
    });
    dialog.addEventListener("click", (event) => {
      if (!dialog.querySelector(".mower-settings-popup").contains(event.target))
        closePopup();
    });
    dialog.querySelector(".mower-settings-close").addEventListener("click", closePopup);

    const updateSliderBackground = (slider) => {
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);
      const value = parseFloat(slider.value);
      const percentage = ((value - min) / (max - min)) * 100;
      slider.style.background = `linear-gradient(to right, var(--primary-color) ${percentage}%, var(--divider-color, #444) ${percentage}%)`;
    };

    const formatMinutes = (minutes) => {
      if (minutes < 60) return `${minutes} min`;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    };

    if (torqueEntity) {
      const torqueSlider = dialog.querySelector("#torque-slider");
      const torqueValueDisplay = dialog.querySelector("#torque-value");

      updateSliderBackground(torqueSlider);

      torqueSlider.addEventListener("input", () => {
        torqueValueDisplay.textContent = `${torqueSlider.value}%`;
        updateSliderBackground(torqueSlider);
      });

      torqueSlider.addEventListener("change", () => {
        this._hass.callService("number", "set_value", {
          entity_id: this.config.torque_entity,
          value: parseFloat(torqueSlider.value),
        });
      });
    }

    if (rainDelayEntity) {
      const rainDelaySlider = dialog.querySelector("#rain-delay-slider");
      const rainDelayValueDisplay = dialog.querySelector("#rain-delay-value");

      rainDelayValueDisplay.textContent = formatMinutes(rainDelayValue);
      updateSliderBackground(rainDelaySlider);

      rainDelaySlider.addEventListener("input", () => {
        rainDelayValueDisplay.textContent = formatMinutes(parseInt(rainDelaySlider.value));
        updateSliderBackground(rainDelaySlider);
      });

      rainDelaySlider.addEventListener("change", () => {
        this._hass.callService("number", "set_value", {
          entity_id: this.config.rain_delay_entity,
          value: parseInt(rainDelaySlider.value),
        });
      });
    }
  }

  _showInfoPopup() {
    if (document.querySelector(".mower-info-wrapper")) return;

    const cardRect = this.getBoundingClientRect();

    const firmwareEntity = this.config.firmware_entity
      ? this._hass.states[this.config.firmware_entity]
      : null;
    const autoFirmwareEntity = this.config.auto_firmware_entity
      ? this._hass.states[this.config.auto_firmware_entity]
      : null;

    const installedVersion = firmwareEntity?.attributes.installed_version ?? null;
    const latestVersion = firmwareEntity?.attributes.latest_version ?? null;
    const updateAvailable = firmwareEntity?.state === "on";
    const autoFirmwareOn = autoFirmwareEntity?.state === "on";

    const dialog = document.createElement("dialog");
    dialog.className = "mower-info-wrapper";
    dialog.style.cssText = `padding:0;border:none;background:rgba(0,0,0,0.5);margin:0;position:fixed;left:${cardRect.left}px;top:${cardRect.top}px;width:${cardRect.width}px;height:${cardRect.height}px;max-width:none;max-height:none;display:flex;align-items:center;justify-content:center;overflow:hidden`;

    dialog.innerHTML = `
      <style>
        dialog.mower-info-wrapper::backdrop {
          background: transparent;
        }

        .mower-info-popup {
          background: var(--card-background-color, #2d2d2d);
          border-radius: 16px;
          padding: 0;
          width: 100%;
          max-width: 320px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          overflow: hidden;
        }

        .mower-info-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--divider-color, #444);
        }

        .mower-info-title {
          font-size: 1em;
          font-weight: bold;
          color: var(--primary-text-color);
        }

        .mower-info-close {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--secondary-text-color);
          padding: 4px;
          display: flex;
          align-items: center;
          border-radius: 5px;
        }

        .mower-info-close ha-icon {
          --mdc-icon-size: 20px;
        }

        .mower-info-body {
          padding: 12px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .mower-info-section-title {
          font-size: 0.75em;
          font-weight: bold;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: -8px;
        }

        .mower-info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .mower-info-label {
          font-size: 0.9em;
          color: var(--primary-text-color);
          flex: 1;
        }

        .mower-info-value {
          font-size: 0.9em;
          font-weight: bold;
          color: var(--secondary-text-color);
        }

        .mower-info-divider {
          border: none;
          border-top: 1px solid var(--divider-color, #444);
          margin: 0;
        }

        .mower-info-toggle {
          width: 34px;
          height: 20px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
          background: var(--disabled-color, #bdbdbd);
        }

        .mower-info-toggle--on {
          background: var(--primary-color);
        }

        .mower-info-toggle::after {
          content: "";
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          top: 3px;
          left: 3px;
          transition: transform 0.2s;
        }

        .mower-info-toggle--on::after {
          transform: translateX(14px);
        }
      </style>

      <div class="mower-info-popup">
        <div class="mower-info-header">
          <span class="mower-info-title">Information</span>
          <button class="mower-info-close">
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </div>
        <div class="mower-info-body">

          ${firmwareEntity ? `
          <div class="mower-info-section-title">Firmware</div>
          ${installedVersion ? `
          <div class="mower-info-row">
            <span class="mower-info-label">Installiert</span>
            <span class="mower-info-value">${installedVersion}</span>
          </div>
          ` : ""}
          ${updateAvailable && latestVersion ? `
          <div class="mower-info-row">
            <span class="mower-info-label">Verfügbar</span>
            <span class="mower-info-value" style="color:var(--warning-color,#ff9800)">${latestVersion}</span>
          </div>
          ` : ""}
          ` : ""}

          ${autoFirmwareEntity ? `
          <hr class="mower-info-divider">
          <div class="mower-info-row">
            <span class="mower-info-label">Auto-Update</span>
            <button class="mower-info-toggle${autoFirmwareOn ? " mower-info-toggle--on" : ""}" id="auto-firmware-toggle"></button>
          </div>
          ` : ""}

        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    dialog.showModal();

    const closePopup = () => {
      dialog.close();
      dialog.remove();
      document.removeEventListener("keydown", onEsc, { capture: true });
    };
    const onEsc = (event) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        event.preventDefault();
        closePopup();
      }
    };
    document.addEventListener("keydown", onEsc, { capture: true });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closePopup();
    });
    dialog.addEventListener("click", (event) => {
      if (!dialog.querySelector(".mower-info-popup").contains(event.target))
        closePopup();
    });
    dialog.querySelector(".mower-info-close").addEventListener("click", closePopup);

    if (autoFirmwareEntity) {
      const toggleButton = dialog.querySelector("#auto-firmware-toggle");
      let autoFirmwareIsOn = autoFirmwareOn;

      toggleButton.addEventListener("click", () => {
        autoFirmwareIsOn = !autoFirmwareIsOn;
        toggleButton.classList.toggle("mower-info-toggle--on", autoFirmwareIsOn);
        this._hass.callService(
          "switch",
          autoFirmwareIsOn ? "turn_on" : "turn_off",
          { entity_id: this.config.auto_firmware_entity }
        );
      });
    }
  }

  render() {
    if (!this.config || !this._hass) return;

    const mowerEntity = this._hass.states[this.config.mower_entity];
    const batteryEntity = this.config.battery_entity
      ? this._hass.states[this.config.battery_entity]
      : null;
    const errorEntity = this.config.error_entity
      ? this._hass.states[this.config.error_entity]
      : null;
    const chargingEntity = this.config.charging_entity
      ? this._hass.states[this.config.charging_entity]
      : null;
    const rainSensorEntity = this.config.rain_sensor_entity
      ? this._hass.states[this.config.rain_sensor_entity]
      : null;
    const rainDelayRemainingEntity = this.config.rain_delay_remaining_entity
      ? this._hass.states[this.config.rain_delay_remaining_entity]
      : null;
    const firmwareEntity = this.config.firmware_entity
      ? this._hass.states[this.config.firmware_entity]
      : null;

    const name = this.config.name || "Mähroboter";
    const state = mowerEntity ? mowerEntity.state : "unavailable";
    const stateLabel = this._stateLabel(state);

    const batteryLevel = batteryEntity ? parseFloat(batteryEntity.state) : null;
    const isCharging = chargingEntity?.state === "on";
    const isRaining = rainSensorEntity?.state === "on";
    const rainDelayRemaining = rainDelayRemainingEntity
      ? parseFloat(rainDelayRemainingEntity.state)
      : 0;
    const rainDelayUnit =
      rainDelayRemainingEntity?.attributes.unit_of_measurement ?? "min";
    const hasError = this._hasError(errorEntity);
    const errorText = hasError ? errorEntity.state : null;
    const lastChanged = this._formatLastChanged(mowerEntity);

    const updateAvailable = firmwareEntity?.state === "on";
    const latestVersion = firmwareEntity?.attributes.latest_version ?? null;

    const isMowing = state === "mowing";
    const isDocked = state === "docked";
    const isPaused = state === "paused";
    const isReturning = state === "returning";

    const startDisabled = isMowing ? " disabled" : "";
    const pauseDisabled = !isMowing && !isPaused ? " disabled" : "";
    const dockDisabled = isDocked || isReturning ? " disabled" : "";

    const hasInfo = this.config.firmware_entity || this.config.auto_firmware_entity;
    const hasSettings = this.config.torque_entity || this.config.rain_delay_entity;

    this.shadowRoot.innerHTML = `
      <style>${MowerCard._css}</style>
      <ha-card class="card-container">

        <div class="header">
          <span class="mower-name">${this._escapeHtml(name)}</span>
          ${batteryLevel !== null ? `
          <div class="header-battery">
            <span class="header-battery-label">${batteryLevel}%</span>
            <ha-icon
              class="header-battery-icon${!isCharging && batteryLevel < 20 ? " header-battery-icon--low" : ""}"
              icon="${isCharging ? "mdi:battery-charging" : "mdi:battery"}"></ha-icon>
          </div>
          ` : ""}
          ${hasInfo ? `
          <button class="button-base button-settings" id="info-button">
            <ha-icon icon="mdi:information-outline"></ha-icon>
          </button>
          ` : ""}
          ${hasSettings ? `
          <button class="button-base button-settings" id="settings-button">
            <ha-icon icon="mdi:cog"></ha-icon>
          </button>
          ` : ""}
        </div>

        <div class="info-row">
          <div class="info-status-line">
            <span class="status-badge status-badge--${state}">${this._escapeHtml(stateLabel)}</span>
            ${lastChanged ? `<span class="info-time">${this._escapeHtml(lastChanged)}</span>` : ""}
          </div>
          ${hasError ? `
          <div class="error-container">
            <span class="error-badge">Fehler erkannt</span>
            <span class="error-reason">${this._escapeHtml(this._errorLabel(errorText))}</span>
          </div>
          ` : ""}
        </div>

        ${updateAvailable ? `
        <div class="update-row">
          <div class="update-info">
            <div class="update-title">Firmware-Update verfügbar</div>
            <div class="update-version">${this._escapeHtml(String(latestVersion ?? ""))}</div>
          </div>
          <button class="update-install-button" id="update-button">
            <ha-icon icon="mdi:update"></ha-icon>
            Installieren
          </button>
        </div>
        ` : ""}

        ${isRaining ? `
        <div class="rain-indicator">
          <ha-icon icon="mdi:weather-rainy"></ha-icon>
          ${rainDelayRemaining > 0 ? `<span class="rain-indicator-text">Verbleibende Regenverzögerung ${rainDelayRemaining} ${this._escapeHtml(rainDelayUnit)}</span>` : ""}
        </div>
        ` : ""}

        <div class="button-row">
          <button class="button-base button-primary" id="start-button"${startDisabled}>
            <ha-icon icon="mdi:play"></ha-icon>
          </button>

          <button class="button-base button-primary" id="pause-button"${pauseDisabled}>
            <ha-icon icon="${isPaused ? "mdi:play-pause" : "mdi:pause"}"></ha-icon>
          </button>

          <button class="button-base button-primary" id="dock-button"${dockDisabled}>
            <ha-icon icon="mdi:home"></ha-icon>
          </button>

          ${this.config.edge_cut_entity ? `
          <button class="button-base button-primary" id="edge-cut-button">
            <ha-icon icon="mdi:scissors-cutting"></ha-icon>
          </button>
          ` : ""}
        </div>

      </ha-card>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    this.shadowRoot
      .getElementById("start-button")
      ?.addEventListener("click", () => {
        this._hass.callService("lawn_mower", "start_mowing", {
          entity_id: this.config.mower_entity,
        });
      });

    this.shadowRoot
      .getElementById("pause-button")
      ?.addEventListener("click", () => {
        const state = this._hass.states[this.config.mower_entity]?.state;
        this._hass.callService(
          "lawn_mower",
          state === "paused" ? "start_mowing" : "pause",
          { entity_id: this.config.mower_entity }
        );
      });

    this.shadowRoot
      .getElementById("dock-button")
      ?.addEventListener("click", () => {
        this._hass.callService("lawn_mower", "dock", {
          entity_id: this.config.mower_entity,
        });
      });

    this.shadowRoot
      .getElementById("update-button")
      ?.addEventListener("click", () => {
        this._hass.callService("update", "install", {
          entity_id: this.config.firmware_entity,
        });
      });

    this.shadowRoot
      .getElementById("info-button")
      ?.addEventListener("click", () => {
        this._showInfoPopup();
      });

    this.shadowRoot
      .getElementById("settings-button")
      ?.addEventListener("click", () => {
        this._showSettingsPopup();
      });

    this.shadowRoot
      .getElementById("edge-cut-button")
      ?.addEventListener("click", () => {
        this._hass.callService("button", "press", {
          entity_id: this.config.edge_cut_entity,
        });
      });
  }

  getCardSize() {
    return 3;
  }
}

customElements.define("mower-card", MowerCard);

// ── MowerCardEditor ────────────────────────────────────────────────────────

class MowerCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
  }

  connectedCallback() {
    this._escHandler = (event) => {
      if (event.key !== "Escape") return;
      const dialog = this._findHaEditDialog();
      if (!dialog) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (typeof dialog.closeDialog === "function") {
        if (!this._editorDirty) dialog._dirty = false;
        dialog.closeDialog();
        return;
      }
      const button = dialog.shadowRoot?.querySelector(
        "ha-icon-button[slot='navigationIcon'], mwc-icon-button[slot='navigationIcon'], [dialogaction='close']"
      );
      if (button) {
        button.click();
        return;
      }
      (
        dialog.shadowRoot?.querySelector("ha-dialog") ??
        dialog.shadowRoot?.querySelector("dialog")
      )?.dispatchEvent(new Event("cancel", { cancelable: true }));
    };
    document.addEventListener("keydown", this._escHandler, { capture: true });
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._escHandler, { capture: true });
  }

  _findHaEditDialog() {
    const selector = "hui-dialog-edit-card,hui-edit-card-dialog";
    const findDialogIn = (root) => root?.querySelector?.(selector) ?? null;
    const ha = document.querySelector("home-assistant");
    const homeAssistantShadowRoot = ha?.shadowRoot;
    const main = homeAssistantShadowRoot?.querySelector("home-assistant-main");
    const mainShadowRoot = main?.shadowRoot;
    const panel =
      mainShadowRoot?.querySelector("ha-panel-lovelace") ??
      mainShadowRoot?.querySelector("partial-panel-resolver");
    const panelShadowRoot = panel?.shadowRoot;
    const huiRoot = panelShadowRoot?.querySelector("hui-root");
    return (
      findDialogIn(document) ??
      findDialogIn(homeAssistantShadowRoot) ??
      findDialogIn(mainShadowRoot) ??
      findDialogIn(panelShadowRoot) ??
      findDialogIn(huiRoot?.shadowRoot) ??
      null
    );
  }

  setConfig(config) {
    this._config = {
      type: config.type,
      name: config.name || "Mähroboter",
      mower_entity: config.mower_entity || "",
      battery_entity: config.battery_entity || "",
      error_entity: config.error_entity || "",
      charging_entity: config.charging_entity || "",
      rain_sensor_entity: config.rain_sensor_entity || "",
      rain_delay_entity: config.rain_delay_entity || "",
      rain_delay_remaining_entity: config.rain_delay_remaining_entity || "",
      torque_entity: config.torque_entity || "",
      edge_cut_entity: config.edge_cut_entity || "",
      auto_firmware_entity: config.auto_firmware_entity || "",
      firmware_entity: config.firmware_entity || "",
    };
    this._editorDirty = false;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _fire() {
    this._editorDirty = true;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  _field(id, label, placeholder, value) {
    return `
      <div class="item">
        <div class="field">
          <div class="field-label">${label}</div>
          <input
            type="text"
            id="${id}"
            class="config-input"
            value="${this._escapeHtml(value)}"
            placeholder="${placeholder}"
          >
        </div>
      </div>
    `;
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding-bottom: 16px;
        }

        .section-title {
          font-weight: bold;
          font-size: 0.95em;
          margin: 16px 0 6px;
          color: var(--primary-text-color);
          padding: 0 16px;
        }

        .item {
          padding: 4px 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .field-label {
          font-size: 0.75em;
          color: var(--secondary-text-color);
        }

        .config-input {
          width: 100%;
          height: 36px;
          padding: 0 10px;
          box-sizing: border-box;
          border: 1px solid var(--divider-color, #555);
          border-radius: 4px;
          background: var(--secondary-background-color, #1c1c1c);
          color: var(--primary-text-color);
          font-size: 0.9em;
        }

        .config-input:focus {
          outline: none;
          border-color: var(--primary-color);
        }
      </style>

      <div class="section-title">Allgemein</div>

      ${this._field(
        "name",
        "Name",
        "Mähroboter",
        this._config.name)}

      <div class="section-title">Basis-Entitäten</div>

      ${this._field(
        "mower-entity",
        "Mähroboter (lawn_mower.*)",
        "lawn_mower.mahroboter",
        this._config.mower_entity)}

      ${this._field(
        "battery-entity",
        "Batterie (sensor.*)",
        "sensor.mahroboter_batterie",
        this._config.battery_entity)}

      ${this._field(
        "error-entity",
        "Fehler (sensor.*)",
        "sensor.mahroboter_fehler",
        this._config.error_entity)}

      ${this._field(
        "charging-entity",
        "Ladevorgang (binary_sensor.*)",
        "binary_sensor.mahroboter_ladevorgang",
        this._config.charging_entity)}

      <div class="section-title">Regen</div>

      ${this._field(
        "rain-sensor-entity",
        "Regensensor (binary_sensor.*)",
        "binary_sensor.m_regensensor",
        this._config.rain_sensor_entity)}

      ${this._field(
        "rain-delay-entity",
        "Regenverzögerung (number.*)",
        "number.m_regenverzogerung",
        this._config.rain_delay_entity)}

      ${this._field(
        "rain-delay-remaining-entity",
        "Verbleibende Verzögerung (sensor.*)",
        "sensor.m_verbleibende_regenverzogerung",
        this._config.rain_delay_remaining_entity)}

      <div class="section-title">Einstellungs-Popup</div>

      ${this._field(
        "torque-entity",
        "Drehmoment (number.*)",
        "number.m_drehmoment",
        this._config.torque_entity)}

      ${this._field(
        "edge-cut-entity",
        "Kantenschnitt (button.*)",
        "button.m_kantenschnitt",
        this._config.edge_cut_entity)}

      <div class="section-title">Info-Popup</div>

      ${this._field(
        "auto-firmware-entity",
        "Auto-Firmware-Update (switch.*)",
        "switch.m_automatische_firmware_aktualisierung",
        this._config.auto_firmware_entity)}

      ${this._field(
        "firmware-entity",
        "Firmware-Update (update.*)",
        "update.mahroboter_firmware",
        this._config.firmware_entity)}
    `;

    this._bindEditorEvents();
  }

  _bindEditorEvents() {
    const fields = {
      name: "name",
      "mower-entity": "mower_entity",
      "battery-entity": "battery_entity",
      "error-entity": "error_entity",
      "charging-entity": "charging_entity",
      "rain-sensor-entity": "rain_sensor_entity",
      "rain-delay-entity": "rain_delay_entity",
      "rain-delay-remaining-entity": "rain_delay_remaining_entity",
      "torque-entity": "torque_entity",
      "edge-cut-entity": "edge_cut_entity",
      "auto-firmware-entity": "auto_firmware_entity",
      "firmware-entity": "firmware_entity",
    };

    Object.entries(fields).forEach(([elementId, configKey]) => {
      this.shadowRoot
        .getElementById(elementId)
        ?.addEventListener("change", (event) => {
          this._config[configKey] = event.target.value;
          this._fire();
        });
    });
  }
}

customElements.define("mower-card-editor", MowerCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "mower-card",
  name: "Mower Card",
  description: "Steuerung und Status für Mähroboter",
  preview: true,
});
