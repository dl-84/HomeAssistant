// Version: 1.1

const MAX_VOLUME = 25;
const RESET_VOLUME = 10; // percent
const UNJOIN_DELAY_MS = 800;
const VOLUME_START_THRESHOLD = 10; // percent

// ── RadioCard ──────────────────────────────────────────────────────────────

class RadioCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._selectedStation = -1;
    this._selectedPlayer = -1;
    this._masterEntity = null;
    this._masterAutoDetected = false;
    this._pausedEntities = [];
    this._resumingEntities = [];
    this._groupedEntities = [];
  }

  setConfig(config) {
    this.config = config;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  static getStubConfig() {
    return {
      stationLabel: "Sender",
      playerLabel: "Lautsprecher",
      stations: [
        {
          name: "Absolut Top",
          url: "media-source://radio_browser/32bd882d-8d12-4a97-8058-f4af8485772b",
        },
      ],
      players: [],
    };
  }

  static getConfigElement() {
    return document.createElement("radio-card-editor");
  }

  _escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  _maxVolume() {
    return this.config.maxVolume ?? MAX_VOLUME;
  }

  _resetVolume() {
    return (this.config.resetVolume ?? RESET_VOLUME) / 100;
  }

  static get _css() {
    return `
      .card-container {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .button-base ha-icon {
        --mdc-icon-size: 20px;
      }

      .dropdowns {
        display: flex;
        gap: 20px;
      }

      .dropdowns .row {
        flex: 1;
      }

      .row {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .dropdown-label {
        font-size: 0.95em;
        font-weight: bold;
        color: var(--primary-text-color);
      }

      .dropdown-select {
        flex: 1;
        height: 48px;
        appearance: none;
        -webkit-appearance: none;
        padding: 8px 36px 8px 12px;
        border: 1px solid var(--divider-color, #999);
        border-radius: 5px;
        background: var(--card-background-color) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 12px center;
        color: var(--primary-text-color);
        font-size: 1.1em;
        cursor: pointer;
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

      .button-primary {
        background: var(--primary-color);
      }

      .button-primary:hover:not(:disabled) {
        opacity: 0.85;
      }

      .button-primary:active:not(:disabled) {
        opacity: 0.7;
      }

      .button-danger {
        background: var(--error-color, #c00);
      }

      .play-row {
        display: flex;
        gap: 8px;
        margin-top: 5px;
      }

      .divider {
        border: none;
        border-top: 2px solid var(--divider-color, #aaa);
        margin: 2px 0;
      }

      .player-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-top: 16px;
        padding-bottom: 16px;
      }

      .player-row:first-child {
        padding-top: 0;
      }

      .player-row:last-child {
        padding-bottom: 0;
      }

      .player-name-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .player-name {
        font-size: 0.95em;
        font-weight: bold;
        color: var(--primary-text-color);
        flex: 1;
      }

      .player-label {
        font-size: 0.85em;
        color: var(--secondary-text-color);
        flex-shrink: 0;
      }

      .player-track {
        font-size: 0.85em;
        color: var(--secondary-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .button-row {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }

      .volume-button {
        border: 1px solid var(--primary-color);
      }

      .volume-button:disabled {
        border: 1px solid var(--disabled-color, #bdbdbd);
      }

      .volume-display {
        border: 1px solid var(--primary-color);
        font-weight: bold;
        cursor: default;
      }
    `;
  }

  _buildPlayerRows() {
    const players = this.config.players || [];
    const elements = [];

    players.forEach((player, index) => {
      if (index > 0) {
        const hr = document.createElement("hr");
        hr.className = "divider";
        elements.push(hr);
      }

      const state = this._hass.states[player.entity];
      const isPlaying =
        state && (state.state === "playing" || state.state === "paused");
      const isActivelyPlaying = state && state.state === "playing";
      const inGroup =
        state &&
        state.attributes.group_members &&
        state.attributes.group_members.length > 1;
      const isMaster =
        this._masterEntity !== null && this._masterEntity === player.entity;
      const isSlave = inGroup && !isMaster;
      const isGrouped = isSlave || this._groupedEntities.includes(player.entity);
      const isMasterWithSlaves =
        isMaster && (inGroup || this._groupedEntities.length > 0);
      const isInPaused = this._pausedEntities.includes(player.entity);
      const pauseButtonDisabled =
        !isActivelyPlaying && !isInPaused ? " disabled" : "";
      const pauseButtonIcon = isInPaused ? "mdi:play-pause" : "mdi:pause";
      const artist = (state && state.attributes.media_artist) || "";
      const title = (state && state.attributes.media_title) || "";
      const volume =
        state && state.attributes.volume_level != null
          ? Math.round(state.attributes.volume_level * 100)
          : 50;

      let trackInfo;
      if (isPlaying) {
        trackInfo =
          artist || title
            ? artist
              ? `${artist} — ${title}`
              : title
            : "Wird gestartet...";
      } else if (this._resumingEntities.includes(player.entity)) {
        trackInfo = "Wird gestartet...";
      } else if (isInPaused) {
        trackInfo = "Pausiert";
      } else {
        trackInfo = "Aus";
      }

      const div = document.createElement("div");
      div.className = "player-row";
      div.innerHTML = `
        <div class="player-name-row">
          <span class="player-name">${this._escapeHtml(player.name)}</span>
          ${isMaster ? '<span class="player-label">Master</span>' : ""}
          ${isGrouped ? '<span class="player-label">Slave</span>' : ""}
        </div>
        <div class="player-track">${this._escapeHtml(trackInfo)}</div>
        <div class="button-row">
          <button class="button-base button-danger stop-button" data-index="${index}"${isPlaying ? "" : " disabled"}>
            <ha-icon icon="mdi:stop"/>
          </button>

          <button class="button-base button-primary button-pause" data-index="${index}"${pauseButtonDisabled}>
            <ha-icon icon="${pauseButtonIcon}"/>
          </button>

          <button class="button-base button-primary button-group-toggle" data-index="${index}" data-grouped="${isGrouped}"${this._masterEntity === null || (this._masterEntity === player.entity && !isMasterWithSlaves) ? " disabled" : ""}>
            <ha-icon icon="${isGrouped || isMasterWithSlaves ? "mdi:link-variant-off" : "mdi:speaker-multiple"}"/>
          </button>

          <button class="button-base button-primary volume-button" data-index="${index}" data-step="-1">
            <ha-icon icon="mdi:volume-minus"/>
          </button>

          <button class="button-base button-primary volume-display" data-index="${index}">${volume}</button>

          <button class="button-base button-primary volume-button" data-index="${index}" data-step="1">
            <ha-icon icon="mdi:volume-plus"/>
          </button>
        </div>
      `;
      elements.push(div);
    });

    return elements;
  }

  _buildHTML({
    stationOptions,
    playerOptions,
    playDisabled,
    pauseDisabled,
    pauseIcon,
    stopDisabled,
    resetDisabled,
  }) {
    return `
      <style>${RadioCard._css}</style>
      <ha-card class="card-container">
        <div class="dropdowns">
          <div class="row">
            <label class="dropdown-label">${this.config.stationLabel || "Sender"}</label>
            <select id="station" class="dropdown-select">${stationOptions}</select>
          </div>
          <div class="row">
            <label class="dropdown-label">${this.config.playerLabel || "Lautsprecher"}</label>
            <select id="player" class="dropdown-select">${playerOptions}</select>
          </div>
        </div>
        <div class="play-row">
          <button id="play" class="button-base button-primary"${playDisabled}>
            <ha-icon icon="mdi:play"/>
          </button>

          <button id="pause" class="button-base button-primary"${pauseDisabled}>
            <ha-icon icon="${pauseIcon}"/>
          </button>

          <button id="reset" class="button-base button-danger"${stopDisabled}>
            <ha-icon icon="mdi:stop"/>
          </button>

          <button id="reset-config" class="button-base button-primary"${resetDisabled}>
            <ha-icon icon="mdi:restore"/>
          </button>
        </div>
        <hr class="divider">
        <div id="player-list"></div>
      </ha-card>
    `;
  }

  _showVolumePopup(button, player) {
    if (document.querySelector(".volume-popup-wrapper")) return;

    const maxVolume = this._maxVolume();
    const state = this._hass.states[player.entity];
    const volume =
      state && state.attributes.volume_level != null
        ? Math.round(state.attributes.volume_level * 100)
        : parseInt(button.textContent);

    const presets = [0.2, 0.4, 0.6, 0.8].map((factor) =>
      Math.round(maxVolume * factor)
    );

    const dialog = document.createElement("dialog");
    dialog.className = "volume-popup-wrapper";
    const cardRect = this.getBoundingClientRect();
    dialog.style.cssText = `padding:0;border:none;background:rgba(0,0,0,0.5);margin:0;position:fixed;left:${cardRect.left}px;top:${cardRect.top}px;width:${cardRect.width}px;height:${cardRect.height}px;max-width:none;max-height:none;display:flex;align-items:center;justify-content:center;overflow:hidden`;
    dialog.innerHTML = `
      <style>
        dialog.volume-popup-wrapper::backdrop {
          background: transparent;
        }

        .volume-popup {
          background: var(--card-background-color, #2d2d2d);
          border-radius: 16px;
          padding: 24px 24px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          min-width: 220px;
          position: relative;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }

        .volume-popup-close {
          position: absolute;
          top: 12px;
          left: 12px;
          background: transparent;
          border: none;
          color: var(--primary-text-color, #fff);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 5px;
        }

        .volume-popup-close ha-icon {
          --mdc-icon-size: 22px;
        }

        .volume-popup-name {
          font-size: 1.1em;
          font-weight: bold;
          color: var(--primary-text-color, #fff);
          margin-top: 8px;
        }

        .volume-popup-value {
          font-size: 2em;
          font-weight: bold;
          color: var(--primary-text-color, #fff);
          min-width: 3ch;
          text-align: center;
        }

        .volume-popup-track {
          width: 100px;
          height: 220px;
          border-radius: 30px;
          background: var(--secondary-background-color);
          position: relative;
          cursor: pointer;
          touch-action: none;
          user-select: none;
          overflow: hidden;
        }

        .volume-popup-fill {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--primary-color);
          border-radius: 0;
          pointer-events: none;
        }

        .volume-popup-handle {
          position: absolute;
          top: 12px;
          left: 20%;
          right: 20%;
          height: 4px;
          background: rgba(255,255,255,0.9);
          border-radius: 2px;
        }

        .volume-popup-presets {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .volume-popup-preset {
          background: var(--secondary-background-color);
          border: none;
          border-radius: 10px;
          padding: 8px 14px;
          color: var(--primary-text-color);
          cursor: pointer;
          font-size: 0.9em;
          transition: background 0.15s;
        }

        .volume-popup-preset.active {
          background: var(--primary-color);
          color: white;
        }
      </style>
      <div class="volume-popup">
        <button class="volume-popup-close">
          <ha-icon icon="mdi:close"/>
        </button>
        <div class="volume-popup-name">${this._escapeHtml(player.name)}</div>
        <div class="volume-popup-value">${volume}</div>
        <div class="volume-popup-track">
          <div class="volume-popup-fill" style="height:${(Math.min(volume, maxVolume) / maxVolume) * 100}%">
            <div class="volume-popup-handle"></div>
          </div>
        </div>
        <div class="volume-popup-presets">
          ${presets
            .map(
              (preset) =>
                `<button class="volume-popup-preset${volume === preset ? " active" : ""}" data-value="${preset}">${preset}</button>`
            )
            .join("")}
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();

    const valueDisplay = dialog.querySelector(".volume-popup-value");
    const track = dialog.querySelector(".volume-popup-track");
    const fill = dialog.querySelector(".volume-popup-fill");

    const updateUI = (value) => {
      fill.style.height = (value / maxVolume) * 100 + "%";
      valueDisplay.textContent = value;
      dialog
        .querySelectorAll(".volume-popup-preset")
        .forEach((preset) =>
          preset.classList.toggle(
            "active",
            parseInt(preset.dataset.value) === value
          )
        );
    };

    const getVolumeFromY = (clientY) => {
      const rect = track.getBoundingClientRect();
      return Math.round(
        Math.min(1, Math.max(0, (rect.bottom - clientY) / rect.height)) *
          maxVolume
      );
    };

    const setVolume = (value) => {
      button.textContent = String(value);
      this._hass.callService("media_player", "volume_set", {
        entity_id: player.entity,
        volume_level: value / 100,
      });
    };

    track.addEventListener("pointerdown", (event) => {
      track.setPointerCapture(event.pointerId);
      updateUI(getVolumeFromY(event.clientY));
      event.preventDefault();
    });
    track.addEventListener("pointermove", (event) => {
      if (!track.hasPointerCapture(event.pointerId)) return;
      updateUI(getVolumeFromY(event.clientY));
    });
    track.addEventListener("pointerup", (event) => {
      if (!track.hasPointerCapture(event.pointerId)) return;
      const value = getVolumeFromY(event.clientY);
      updateUI(value);
      setVolume(value);
    });

    dialog.querySelectorAll(".volume-popup-preset").forEach((preset) => {
      preset.addEventListener("click", () => {
        const value = parseInt(preset.dataset.value);
        updateUI(value);
        setVolume(value);
      });
    });

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
      if (!dialog.querySelector(".volume-popup").contains(event.target))
        closePopup();
    });
    dialog.querySelector(".volume-popup-close").addEventListener("click", closePopup);
  }

  _bindEvents(isResumeMode) {
    this.shadowRoot
      .getElementById("station")
      .addEventListener("change", (event) => {
        this._selectedStation = parseInt(event.target.value);
        this.shadowRoot.getElementById("play").disabled =
          this._selectedStation === -1 || this._selectedPlayer === -1;
      });

    this.shadowRoot
      .getElementById("player")
      .addEventListener("change", (event) => {
        this._selectedPlayer = parseInt(event.target.value);
        this.shadowRoot.getElementById("play").disabled =
          this._selectedStation === -1 || this._selectedPlayer === -1;
      });

    this.shadowRoot.getElementById("reset").addEventListener("click", () => {
      (this.config.players || []).forEach((player) =>
        this._hass.callService("media_player", "media_stop", {
          entity_id: player.entity,
        })
      );
      this._masterEntity = null;
      this._masterAutoDetected = true;
      this._pausedEntities = [];
      this._resumingEntities = [];
      this._groupedEntities = [];
      this.render();
    });

    this.shadowRoot
      .getElementById("reset-config")
      .addEventListener("click", () => {
        this._masterEntity = null;
        this._masterAutoDetected = true;
        this._pausedEntities = [];
        this._resumingEntities = [];
        this._groupedEntities = [];
        (this.config.players || []).forEach((player) => {
          this._hass.callService("media_player", "unjoin", {
            entity_id: player.entity,
          });
          this._hass.callService("media_player", "volume_set", {
            entity_id: player.entity,
            volume_level: this._resetVolume(),
          });
        });
        this.render();
      });

    this.shadowRoot.getElementById("play").addEventListener("click", () => {
      const station = this.config.stations[this._selectedStation];
      const player = this.config.players[this._selectedPlayer];

      const playerState = this._hass.states[player.entity];
      const playerInGroup =
        (playerState &&
          playerState.attributes.group_members &&
          playerState.attributes.group_members.length > 1) ||
        this._groupedEntities.includes(player.entity);

      const startPlayback = () => {
        const currentVolume =
          playerState && playerState.attributes.volume_level != null
            ? playerState.attributes.volume_level * 100
            : 0;
        if (currentVolume > VOLUME_START_THRESHOLD) {
          this._hass.callService("media_player", "volume_set", {
            entity_id: player.entity,
            volume_level: this._resetVolume(),
          });
        }
        this._hass.callService("media_player", "play_media", {
          entity_id: player.entity,
          media_content_id: station.url,
          media_content_type: "music",
        });
      };

      if (playerInGroup) {
        this._groupedEntities = this._groupedEntities.filter(
          (entity) => entity !== player.entity
        );
        this._hass.callService("media_player", "unjoin", {
          entity_id: player.entity,
        });
        setTimeout(startPlayback, UNJOIN_DELAY_MS);
      } else {
        startPlayback();
      }

      this._masterEntity = player.entity;
      this._selectedStation = -1;
      this._selectedPlayer = -1;
      this.render();
    });

    this.shadowRoot.getElementById("pause").addEventListener("click", () => {
      if (isResumeMode) {
        this._resumingEntities = [...this._pausedEntities];
        this._pausedEntities.forEach((entity) =>
          this._hass.callService("media_player", "media_play", {
            entity_id: entity,
          })
        );
        this._pausedEntities = [];
      } else {
        this._pausedEntities = [];
        (this.config.players || []).forEach((player) => {
          const state = this._hass.states[player.entity];
          if (state && state.state === "playing") {
            this._pausedEntities.push(player.entity);
            this._hass.callService("media_player", "media_pause", {
              entity_id: player.entity,
            });
          }
        });
      }
      this.render();
    });

    this.shadowRoot.querySelectorAll(".stop-button").forEach((button) => {
      button.addEventListener("click", () => {
        const player = this.config.players[parseInt(button.dataset.index)];
        this._hass.callService("media_player", "media_stop", {
          entity_id: player.entity,
        });
        if (this._masterEntity === player.entity) this._masterEntity = null;
        this.render();
      });
    });

    this.shadowRoot.querySelectorAll(".button-pause").forEach((button) => {
      button.addEventListener("click", () => {
        const player = this.config.players[parseInt(button.dataset.index)];
        if (this._pausedEntities.includes(player.entity)) {
          this._resumingEntities = [...this._resumingEntities, player.entity];
          this._pausedEntities = this._pausedEntities.filter(
            (entity) => entity !== player.entity
          );
          this._hass.callService("media_player", "media_play", {
            entity_id: player.entity,
          });
        } else {
          this._pausedEntities = [...this._pausedEntities, player.entity];
          this._hass.callService("media_player", "media_pause", {
            entity_id: player.entity,
          });
        }
        this.render();
      });
    });

    this.shadowRoot.querySelectorAll(".button-group-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const player = this.config.players[parseInt(button.dataset.index)];
        const isMasterClick = this._masterEntity === player.entity;

        if (isMasterClick) {
          const oldMaster = player.entity;
          const state = this._hass.states[oldMaster];
          const haGroupMembers = (
            (state && state.attributes.group_members) ||
            []
          ).filter((entity) => entity !== oldMaster);
          const newMaster =
            this._groupedEntities[0] || haGroupMembers[0] || null;

          this._masterEntity = newMaster;
          if (newMaster)
            this._groupedEntities = this._groupedEntities.filter(
              (entity) => entity !== newMaster
            );
          this._hass.callService("media_player", "unjoin", {
            entity_id: oldMaster,
          });
          this._hass.callService("media_player", "media_stop", {
            entity_id: oldMaster,
          });
          if (newMaster) {
            setTimeout(
              () =>
                this._hass.callService("media_player", "media_play", {
                  entity_id: newMaster,
                }),
              UNJOIN_DELAY_MS
            );
          }
        } else if (button.dataset.grouped === "true") {
          this._groupedEntities = this._groupedEntities.filter(
            (entity) => entity !== player.entity
          );
          this._hass.callService("media_player", "unjoin", {
            entity_id: player.entity,
          });
          if (this._masterEntity) {
            setTimeout(
              () =>
                this._hass.callService("media_player", "media_play", {
                  entity_id: this._masterEntity,
                }),
              UNJOIN_DELAY_MS
            );
          }
        } else {
          this._groupedEntities = [...this._groupedEntities, player.entity];
          this._hass.callService("media_player", "join", {
            entity_id: this._masterEntity,
            group_members: [player.entity],
          });
        }
        this.render();
      });
    });

    this.shadowRoot.querySelectorAll(".volume-display").forEach((button) => {
      button.addEventListener("click", () => {
        this._showVolumePopup(
          button,
          this.config.players[parseInt(button.dataset.index)]
        );
      });
    });

    this.shadowRoot.querySelectorAll(".volume-button").forEach((button) => {
      button.addEventListener("click", () => {
        const step = parseInt(button.dataset.step);
        const player = this.config.players[parseInt(button.dataset.index)];
        const display = button.parentElement.querySelector(".volume-display");
        const newValue = Math.min(
          this._maxVolume(),
          Math.max(0, parseInt(display.textContent) + step)
        );
        display.textContent = newValue;
        this._hass.callService("media_player", "volume_set", {
          entity_id: player.entity,
          volume_level: newValue / 100,
        });
      });
    });
  }

  render() {
    if (!this.config || !this._hass) return;

    if (!this._masterAutoDetected) {
      this._masterAutoDetected = true;
      const playing = (this.config.players || []).find((player) => {
        const state = this._hass.states[player.entity];
        return state && (state.state === "playing" || state.state === "paused");
      });
      if (playing) this._masterEntity = playing.entity;
    }

    this._resumingEntities = this._resumingEntities.filter((entity) => {
      const state = this._hass.states[entity];
      return !state || state.state !== "playing";
    });

    const stations = this.config.stations || [];
    const players = this.config.players || [];

    const stationOptions =
      `<option value="-1"${this._selectedStation === -1 ? " selected" : ""}></option>` +
      stations
        .map(
          (station, index) =>
            `<option value="${index}"${index === this._selectedStation ? " selected" : ""}>${station.name}</option>`
        )
        .join("");

    const playerOptions =
      `<option value="-1"${this._selectedPlayer === -1 ? " selected" : ""}></option>` +
      players
        .map(
          (player, index) =>
            `<option value="${index}"${index === this._selectedPlayer ? " selected" : ""}>${player.name}</option>`
        )
        .join("");

    const playDisabled =
      this._selectedStation === -1 || this._selectedPlayer === -1
        ? " disabled"
        : "";
    const anyPlaying = players.some((player) => {
      const state = this._hass.states[player.entity];
      return state && state.state === "playing";
    });
    const anyPaused = players.some((player) => {
      const state = this._hass.states[player.entity];
      return state && state.state === "paused";
    });
    const isResumeMode = !anyPlaying && this._pausedEntities.length > 0;
    const stopDisabled =
      anyPlaying || anyPaused || this._pausedEntities.length > 0
        ? ""
        : " disabled";
    const pauseDisabled = anyPlaying || isResumeMode ? "" : " disabled";
    const pauseIcon = isResumeMode ? "mdi:play-pause" : "mdi:pause";
    const resetDisabled = players.some((player) => {
      const state = this._hass.states[player.entity];
      return state && (state.state === "playing" || state.state === "paused");
    })
      ? " disabled"
      : "";

    this.shadowRoot.innerHTML = this._buildHTML({
      stationOptions,
      playerOptions,
      playDisabled,
      pauseDisabled,
      pauseIcon,
      stopDisabled,
      resetDisabled,
    });

    this._buildPlayerRows().forEach((row) =>
      this.shadowRoot.getElementById("player-list").appendChild(row)
    );

    this._bindEvents(isResumeMode);
  }

  getCardSize() {
    return 3;
  }
}

customElements.define("radio-card", RadioCard);

// ── RadioCardEditor ────────────────────────────────────────────────────────

class RadioCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {
      stationLabel: "Sender",
      playerLabel: "Lautsprecher",
      stations: [],
      players: [],
    };
  }

  connectedCallback() {
    this._escHandler = (event) => {
      if (
        event.key !== "Escape" ||
        document.querySelector(".player-picker-wrapper,.station-picker-wrapper,.volume-popup-wrapper")
      )
        return;
      const dialog = this._findHaEditDialog();
      if (!dialog) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (typeof dialog.closeDialog === "function") {
        // If no changes were made, reset HA's internal dirty flag to avoid the
        // "Unsaved Changes" confirmation appearing unnecessarily.
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
    document.removeEventListener("keydown", this._escHandler, {
      capture: true,
    });
  }

  _findHaEditDialog() {
    const selector = "hui-dialog-edit-card,hui-edit-card-dialog";
    const findDialogIn = (root) => root?.querySelector?.(selector) ?? null;
    // querySelector does NOT pierce shadow roots; walk each boundary manually.
    // HA path: document → home-assistant → home-assistant-main
    //          → ha-panel-lovelace / partial-panel-resolver → hui-root → dialog
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
      stationLabel: config.stationLabel || "Sender",
      playerLabel: config.playerLabel || "Lautsprecher",
      maxVolume: config.maxVolume ?? MAX_VOLUME,
      resetVolume: config.resetVolume ?? RESET_VOLUME,
      stations: (config.stations || []).map((station) => ({ ...station })),
      players: (config.players || []).map((player) => ({ ...player })),
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
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  _getPickerRefRect() {
    const editorRect = this.getBoundingClientRect();
    let node =
      this.parentElement ??
      (this.getRootNode() instanceof ShadowRoot
        ? this.getRootNode().host
        : null);
    while (node && node !== document.documentElement) {
      const tag = node.tagName?.toLowerCase() || "";
      if (tag === "ha-dialog" || tag === "hui-edit-card-dialog") {
        const rect = node.getBoundingClientRect();
        if (rect.width > 100) return rect;
      }
      const rect = node.getBoundingClientRect();
      if (
        rect.width > editorRect.width + 100 &&
        rect.width < window.innerWidth * 0.99 &&
        rect.height > 300
      )
        return rect;
      node =
        node.parentElement ??
        (node.getRootNode() instanceof ShadowRoot
          ? node.getRootNode().host
          : null);
    }
    return editorRect.width > 0
      ? {
          left: editorRect.left,
          top: editorRect.top - 60,
          width: editorRect.width,
          height: editorRect.height + 120,
        }
      : {
          left: 0,
          top: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        };
  }

  _render() {
    const stations = this._config.stations || [];
    const players = this._config.players || [];

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
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .config-sort-button {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--secondary-text-color);
          padding: 4px;
          display: flex;
          align-items: center;
          border-radius: 5px;
        }

        .config-sort-button:hover {
          color: var(--primary-text-color);
          background: rgba(128,128,128,0.15);
        }

        .config-sort-button ha-icon {
          --mdc-icon-size: 18px;
          pointer-events: none;
        }

        .item {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 4px 16px;
        }

        .item.drag-over {
          outline: 2px solid var(--primary-color);
          border-radius: 4px;
          background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.08);
        }

        .field {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .field-label {
          font-size: 0.75em;
          color: var(--secondary-text-color);
        }

        .left-col {
          flex: 1;
          display: flex;
          align-items: flex-end;
          gap: 8px;
          min-width: 0;
        }

        .left-col .field {
          flex: 1;
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

        .config-number-input {
          -moz-appearance: textfield;
        }

        .config-number-input::-webkit-outer-spin-button,
        .config-number-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
        }

        .config-delete-button {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--error-color, #c00);
          padding: 6px;
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 5px;
        }

        .config-delete-button ha-icon {
          --mdc-icon-size: 20px;
          pointer-events: none;
        }

        .config-drag-button {
          background: transparent;
          border: none;
          cursor: grab;
          color: var(--secondary-text-color);
          padding: 6px;
          flex-shrink: 0;
          width: 28px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: none;
          border-radius: 5px;
        }

        .config-drag-button:active {
          cursor: grabbing;
        }

        .config-drag-button ha-icon {
          --mdc-icon-size: 18px;
          pointer-events: none;
        }

        .add-btn {
          display: block;
          width: calc(100% - 32px);
          margin: 8px 16px 0;
          padding: 10px;
          background: transparent;
          border: 1px dashed var(--divider-color, #555);
          border-radius: 5px;
          color: var(--secondary-text-color);
          cursor: pointer;
          font-size: 0.9em;
          text-align: center;
          box-sizing: border-box;
        }

        .add-btn:hover {
          background: rgba(128,128,128,0.1);
        }
      </style>

      <div class="section-title">Beschriftungen</div>
      <div class="item">
        <div class="field">
          <div class="field-label">Linkes Label</div>
          <input type="text" id="station-label" class="config-input" value="${this._escapeHtml(this._config.stationLabel)}">
        </div>
        <div class="field">
          <div class="field-label">Rechtes Label</div>
          <input type="text" id="player-label" class="config-input" value="${this._escapeHtml(this._config.playerLabel)}">
        </div>
      </div>

      <div class="section-title">Lautstärke</div>
      <div class="item">
        <div class="field">
          <div class="field-label">Max. Lautstärke (1–100)</div>
          <input type="number" id="max-volume" class="config-input config-number-input" min="1" max="100" value="${this._config.maxVolume}">
        </div>
        <div class="field">
          <div class="field-label">Reset-Lautstärke (0–100)</div>
          <input type="number" id="reset-volume" class="config-input config-number-input" min="0" max="100" value="${this._config.resetVolume}">
        </div>
      </div>

      <div class="section-title">
        <span>Sender</span>
        <button class="config-sort-button" data-section="stations" title="Alphabetisch sortieren">
          <ha-icon icon="mdi:sort-alphabetical-ascending"/>
        </button>
      </div>
      ${stations
        .map(
          (station, index) => `
        <div class="item" draggable="true" data-drag-section="stations" data-drag-index="${index}">
          <button class="config-drag-button">
            <ha-icon icon="mdi:drag"/>
          </button>
          <div class="left-col">
            <div class="field">
              <div class="field-label">Name</div>
              <input type="text" class="config-input st-name" data-index="${index}" value="${this._escapeHtml(station.name)}">
            </div>
          </div>
          <div class="field">
            <div class="field-label">URL</div>
            <input type="text" class="config-input st-url" data-index="${index}" value="${this._escapeHtml(station.url)}">
          </div>
          <button class="config-delete-button" data-section="stations" data-index="${index}">
            <ha-icon icon="mdi:delete"/>
          </button>
        </div>
      `
        )
        .join("")}
      <button class="add-btn" id="add-station">+ Sender hinzufügen</button>

      <div class="section-title">
        <span>Lautsprecher</span>
        <button class="config-sort-button" data-section="players" title="Alphabetisch sortieren">
          <ha-icon icon="mdi:sort-alphabetical-ascending"/>
        </button>
      </div>
      ${players
        .map(
          (player, index) => `
        <div class="item" draggable="true" data-drag-section="players" data-drag-index="${index}">
          <button class="config-drag-button">
            <ha-icon icon="mdi:drag"/>
          </button>
          <div class="left-col">
            <div class="field">
              <div class="field-label">Entity ID</div>
              <input type="text" class="config-input pl-entity" data-index="${index}" value="${this._escapeHtml(player.entity)}" placeholder="media_player.name">
            </div>
          </div>
          <div class="field">
            <div class="field-label">Anzeigename</div>
            <input type="text" class="config-input pl-name" data-index="${index}" value="${this._escapeHtml(player.name)}">
          </div>
          <button class="config-delete-button" data-section="players" data-index="${index}">
            <ha-icon icon="mdi:delete"/>
          </button>
        </div>
      `
        )
        .join("")}
      <button class="add-btn" id="add-player">+ Lautsprecher hinzufügen</button>
    `;

    this._bindEditorEvents();
  }

  _showPlayerPicker() {
    if (document.querySelector(".player-picker-wrapper")) return;

    const referenceRect = this._getPickerRefRect();
    const added = new Set(this._config.players.map((player) => player.entity));
    const available = Object.entries(this._hass.states)
      .filter(([id]) => id.startsWith("media_player.") && !added.has(id))
      .map(([id, state]) => ({
        id,
        name: state.attributes.friendly_name || id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const dialog = document.createElement("dialog");
    dialog.className = "player-picker-wrapper";
    dialog.style.cssText =
      "display:block;padding:0;margin:0;border:none;background:transparent;overflow:visible;max-width:none;max-height:none;pointer-events:none";
    dialog.innerHTML = `
      <style>
        dialog.player-picker-wrapper::backdrop {
          display: none;
        }

        .player-picker-overlay {
          position: fixed;
          left: ${referenceRect.left}px;
          top: ${referenceRect.top}px;
          width: ${referenceRect.width}px;
          height: ${referenceRect.height}px;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          pointer-events: all;
          box-sizing: border-box;
        }

        .player-picker-popup {
          background: var(--card-background-color, #2d2d2d);
          border-radius: 12px;
          min-width: 300px;
          max-width: 420px;
          max-height: 60vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }

        .player-picker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--divider-color, #444);
          flex-shrink: 0;
        }

        .player-picker-title {
          font-weight: normal;
          font-size: var(--dialog-heading-font-size, 1.5rem);
          color: var(--primary-text-color, #fff);
        }

        .player-picker-close {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--secondary-text-color);
          padding: 4px;
          display: flex;
          border-radius: 5px;
        }

        .player-picker-close ha-icon {
          --mdc-icon-size: 20px;
          pointer-events: none;
        }

        .player-picker-list {
          overflow-y: auto;
          flex: 1;
        }

        .player-picker-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid var(--divider-color, #333);
        }

        .player-picker-item:last-child {
          border-bottom: none;
        }

        .player-picker-item:hover {
          background: rgba(128,128,128,0.12);
        }

        .player-picker-item ha-icon {
          --mdc-icon-size: 22px;
          color: var(--secondary-text-color);
          flex-shrink: 0;
        }

        .player-picker-item-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .player-picker-item-name {
          font-size: 0.95em;
          color: var(--primary-text-color, #fff);
        }

        .player-picker-item-id {
          font-size: 0.78em;
          color: var(--secondary-text-color);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .player-picker-empty {
          padding: 24px 16px;
          text-align: center;
          color: var(--secondary-text-color);
          font-size: 0.9em;
        }
      </style>
      <div class="player-picker-overlay">
        <div class="player-picker-popup">
          <div class="player-picker-header">
            <span class="player-picker-title">Lautsprecher auswählen</span>
            <button class="player-picker-close">
              <ha-icon icon="mdi:close"/>
            </button>
          </div>
          <div class="player-picker-list">
            ${
              available.length === 0
                ? '<div class="player-picker-empty">Keine weiteren Lautsprecher verfügbar</div>'
                : available
                    .map(
                      (item) => `
                  <div class="player-picker-item" data-entity="${item.id}" data-name="${this._escapeHtml(item.name)}">
                    <ha-icon icon="mdi:speaker"/>
                    <div class="player-picker-item-info">
                      <div class="player-picker-item-name">${this._escapeHtml(item.name)}</div>
                      <div class="player-picker-item-id">${item.id}</div>
                    </div>
                  </div>`
                    )
                    .join("")
            }
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();

    const close = () => {
      dialog.close();
      dialog.remove();
      document.removeEventListener("keydown", onEsc, { capture: true });
    };
    const onEsc = (event) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onEsc, { capture: true });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });

    dialog.querySelector(".player-picker-close").addEventListener("click", close);
    dialog.querySelector(".player-picker-overlay").addEventListener("click", (event) => {
      if (event.target === dialog.querySelector(".player-picker-overlay")) close();
    });

    dialog.querySelectorAll(".player-picker-item").forEach((item) => {
      item.addEventListener("click", () => {
        this._config.players.push({
          entity: item.dataset.entity,
          name: item.dataset.name,
        });
        this._render();
        this._fire();
        close();
      });
    });
  }

  _showStationPicker() {
    if (document.querySelector(".station-picker-wrapper")) return;

    const referenceRect = this._getPickerRefRect();
    const added = new Set(this._config.stations.map((station) => station.url));

    const dialog = document.createElement("dialog");
    dialog.className = "station-picker-wrapper";
    dialog.style.cssText =
      "display:block;padding:0;margin:0;border:none;background:transparent;overflow:visible;max-width:none;max-height:none;pointer-events:none";
    dialog.innerHTML = `
      <style>
        dialog.station-picker-wrapper::backdrop {
          display: none;
        }

        .station-picker-overlay {
          position: fixed;
          left: ${referenceRect.left}px;
          top: ${referenceRect.top}px;
          width: ${referenceRect.width}px;
          height: ${referenceRect.height}px;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          pointer-events: all;
          box-sizing: border-box;
        }

        .station-picker-popup {
          background: var(--card-background-color, #2d2d2d);
          border-radius: 12px;
          width: 420px;
          max-width: calc(100% - 32px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }

        .station-picker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--divider-color, #444);
          flex-shrink: 0;
        }

        .station-picker-title {
          font-weight: normal;
          font-size: var(--dialog-heading-font-size, 1.5rem);
          color: var(--primary-text-color, #fff);
        }

        .station-picker-close {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--secondary-text-color);
          padding: 4px;
          display: flex;
          border-radius: 5px;
        }

        .station-picker-close ha-icon {
          --mdc-icon-size: 20px;
          pointer-events: none;
        }

        .station-picker-search-wrap {
          padding: 10px 16px;
          border-bottom: 1px solid var(--divider-color, #444);
          flex-shrink: 0;
        }

        .station-picker-search {
          width: 100%;
          height: 36px;
          padding: 0 10px;
          box-sizing: border-box;
          border: 1px solid var(--divider-color, #555);
          border-radius: 4px;
          background: var(--secondary-background-color, #1c1c1c);
          color: var(--primary-text-color);
          font-size: 0.9em;
          outline: none;
        }

        .station-picker-search:focus {
          border-color: var(--primary-color);
        }

        .station-picker-list {
          overflow-y: auto;
          height: calc(6 * 48px);
        }

        .station-picker-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          cursor: pointer;
          border-bottom: 1px solid var(--divider-color, #333);
          min-height: 48px;
          box-sizing: border-box;
        }

        .station-picker-item:last-child {
          border-bottom: none;
        }

        .station-picker-item:hover {
          background: rgba(128,128,128,0.12);
        }

        .station-picker-item ha-icon {
          --mdc-icon-size: 22px;
          color: var(--secondary-text-color);
          flex-shrink: 0;
        }

        .station-picker-item-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }

        .station-picker-item-name {
          font-size: 0.95em;
          color: var(--primary-text-color, #fff);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .station-picker-item-sub {
          font-size: 0.78em;
          color: var(--secondary-text-color);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .station-picker-status {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--secondary-text-color);
          font-size: 0.9em;
        }

        .station-picker-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--divider-color, #444);
          border-top-color: var(--primary-color);
          border-radius: 50%;
          animation: station-picker-spin 0.8s linear infinite;
        }

        @keyframes station-picker-spin {
          to { transform: rotate(360deg); }
        }
      </style>
      <div class="station-picker-overlay">
        <div class="station-picker-popup">
          <div class="station-picker-header">
            <span class="station-picker-title">Sender auswählen</span>
            <button class="station-picker-close">
              <ha-icon icon="mdi:close"/>
            </button>
          </div>
          <div class="station-picker-search-wrap">
            <input type="text" class="station-picker-search" placeholder="Sender suchen...">
          </div>
          <div class="station-picker-list"><div class="station-picker-status"><div class="station-picker-spinner"></div></div></div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();

    const close = () => {
      dialog.close();
      dialog.remove();
      document.removeEventListener("keydown", onEsc, { capture: true });
    };
    const onEsc = (event) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onEsc, { capture: true });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });

    dialog.querySelector(".station-picker-close").addEventListener("click", close);
    dialog.querySelector(".station-picker-overlay").addEventListener("click", (event) => {
      if (event.target === dialog.querySelector(".station-picker-overlay")) close();
    });

    const list = dialog.querySelector(".station-picker-list");

    const renderList = (stations) => {
      const filtered = stations.filter(
        (station) =>
          !added.has("media-source://radio_browser/" + station.stationuuid)
      );
      if (filtered.length === 0) {
        list.innerHTML = '<div class="station-picker-status">Keine Sender gefunden</div>';
        return;
      }
      list.innerHTML = filtered
        .map(
          (station) => `
        <div class="station-picker-item" data-name="${this._escapeHtml(station.name)}" data-url="media-source://radio_browser/${station.stationuuid}">
          <ha-icon icon="mdi:radio"/>
          <div class="station-picker-item-info">
            <div class="station-picker-item-name">${this._escapeHtml(station.name)}</div>
            ${station.country ? `<div class="station-picker-item-sub">${this._escapeHtml(station.country)}</div>` : ""}
          </div>
        </div>`
        )
        .join("");
      list.querySelectorAll(".station-picker-item").forEach((item) => {
        item.addEventListener("click", () => {
          this._config.stations.push({
            name: item.dataset.name,
            url: item.dataset.url,
          });
          this._render();
          this._fire();
          close();
        });
      });
    };

    const fetchStations = async (query = "") => {
      list.innerHTML =
        '<div class="station-picker-status"><div class="station-picker-spinner"></div></div>';
      try {
        const url = query
          ? `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}&limit=100&order=votes&reverse=true&hidebroken=true`
          : `https://de1.api.radio-browser.info/json/stations/topvote/100`;
        const response = await fetch(url);
        renderList(await response.json());
      } catch {
        list.innerHTML =
          '<div class="station-picker-status">Fehler beim Laden der Sender</div>';
      }
    };

    fetchStations();

    let debounceTimer;
    dialog.querySelector(".station-picker-search").addEventListener("input", (event) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(
        () => fetchStations(event.target.value.trim()),
        300
      );
    });
  }

  _bindLabelEvents() {
    this.shadowRoot
      .getElementById("station-label")
      .addEventListener("change", (event) => {
        this._config.stationLabel = event.target.value;
        this._fire();
      });
    this.shadowRoot
      .getElementById("player-label")
      .addEventListener("change", (event) => {
        this._config.playerLabel = event.target.value;
        this._fire();
      });
    this.shadowRoot
      .getElementById("max-volume")
      .addEventListener("change", (event) => {
        const value = Math.min(
          100,
          Math.max(1, parseInt(event.target.value) || MAX_VOLUME)
        );
        event.target.value = value;
        this._config.maxVolume = value;
        this._fire();
      });
    this.shadowRoot
      .getElementById("reset-volume")
      .addEventListener("change", (event) => {
        const value = Math.min(
          100,
          Math.max(0, parseInt(event.target.value) || RESET_VOLUME)
        );
        event.target.value = value;
        this._config.resetVolume = value;
        this._fire();
      });
  }

  _bindFieldEvents() {
    const addEventListeners = (selector, eventName, handler) =>
      this.shadowRoot
        .querySelectorAll(selector)
        .forEach((element) => element.addEventListener(eventName, handler));
    addEventListeners(".st-name", "change", (event) => {
      this._config.stations[+event.target.dataset.index].name =
        event.target.value;
      this._fire();
    });
    addEventListeners(".st-url", "change", (event) => {
      this._config.stations[+event.target.dataset.index].url =
        event.target.value;
      this._fire();
    });
    addEventListeners(".pl-entity", "change", (event) => {
      this._config.players[+event.target.dataset.index].entity =
        event.target.value;
      this._fire();
    });
    addEventListeners(".pl-name", "change", (event) => {
      this._config.players[+event.target.dataset.index].name =
        event.target.value;
      this._fire();
    });
    addEventListeners(".config-delete-button", "click", (event) => {
      const button = event.currentTarget;
      this._config[button.dataset.section].splice(+button.dataset.index, 1);
      this._render();
      this._fire();
    });
    addEventListeners(".config-sort-button", "click", (event) => {
      const section = event.currentTarget.dataset.section;
      this._config[section].sort((a, b) => a.name.localeCompare(b.name));
      this._render();
      this._fire();
    });
  }

  _bindDragEvents() {
    const addEventListeners = (selector, eventName, handler) =>
      this.shadowRoot
        .querySelectorAll(selector)
        .forEach((element) => element.addEventListener(eventName, handler));
    let dragSrc = null;
    addEventListeners(".item[draggable]", "dragstart", (event) => {
      if (event.target.tagName === "INPUT") {
        event.preventDefault();
        return;
      }
      dragSrc = event.currentTarget;
      event.dataTransfer.effectAllowed = "move";
      setTimeout(
        () => dragSrc && dragSrc.style.setProperty("opacity", "0.4"),
        0
      );
    });
    addEventListeners(".item[draggable]", "dragend", (event) => {
      event.currentTarget.style.removeProperty("opacity");
      this.shadowRoot
        .querySelectorAll(".item.drag-over")
        .forEach((element) => element.classList.remove("drag-over"));
      dragSrc = null;
    });
    addEventListeners(".item[draggable]", "dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    addEventListeners(".item[draggable]", "dragenter", (event) => {
      event.currentTarget.classList.add("drag-over");
    });
    addEventListeners(".item[draggable]", "dragleave", (event) => {
      event.currentTarget.classList.remove("drag-over");
    });
    addEventListeners(".item[draggable]", "drop", (event) => {
      event.preventDefault();
      const dst = event.currentTarget;
      if (!dragSrc || dragSrc === dst) return;
      if (dragSrc.dataset.dragSection !== dst.dataset.dragSection) return;
      const [moved] = this._config[dragSrc.dataset.dragSection].splice(
        +dragSrc.dataset.dragIndex,
        1
      );
      this._config[dst.dataset.dragSection].splice(
        +dst.dataset.dragIndex,
        0,
        moved
      );
      this._render();
      this._fire();
    });
  }

  _bindAddEvents() {
    this.shadowRoot
      .getElementById("add-station")
      .addEventListener("click", () => {
        this._showStationPicker();
      });
    this.shadowRoot
      .getElementById("add-player")
      .addEventListener("click", () => {
        if (this._hass) {
          this._showPlayerPicker();
        } else {
          this._config.players.push({ entity: "", name: "" });
          this._render();
          this._fire();
        }
      });
  }

  _bindEditorEvents() {
    this._bindLabelEvents();
    this._bindFieldEvents();
    this._bindDragEvents();
    this._bindAddEvents();
  }
}

customElements.define("radio-card-editor", RadioCardEditor);

window.customCards = window.customCards || [];

window.customCards.push({
  type: "radio-card",
  name: "Radio Card",
  description: "Radio-Sender auf mehreren Lautsprechern steuern",
});
