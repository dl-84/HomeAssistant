const MAX_VOLUME = 25;
const RESET_VOLUME = 10; // percent
const UNJOIN_DELAY_MS = 800;
const VOL_START_THRESHOLD = 10; // percent

const CLR_BTN = "var(--primary-color)";
const CLR_BTN_OFF = "var(--disabled-color, #bdbdbd)";
const CLR_ACCENT = "var(--primary-color)";
const CLR_TEXT_OFF = "var(--secondary-text-color)";

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

  _esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  _maxVol() {
    return this.config.maxVolume ?? MAX_VOLUME;
  }
  _resetVol() {
    return (this.config.resetVolume ?? RESET_VOLUME) / 100;
  }

  static get _css() {
    return `
      ha-card { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
      button ha-icon { --mdc-icon-size: 20px; }
      .dropdowns { display: flex; gap: 20px; }
      .dropdowns .row { flex: 1; }
      .row { display: flex; flex-direction: column; gap: 4px; }
      label { font-size: 0.95em; font-weight: bold; color: var(--primary-text-color); }
      select {
        flex: 1; height: 48px; appearance: none; -webkit-appearance: none;
        padding: 8px 36px 8px 12px; border: 1px solid var(--divider-color, #999); border-radius: 5px;
        background: var(--card-background-color) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 12px center;
        color: var(--primary-text-color); font-size: 1.1em; cursor: pointer;
      }
      .play-row { display: flex; gap: 8px; margin-top: 5px; }
      .play-row button { flex: 1; padding: 12px; border: none; border-radius: 5px; font-size: 0.9em; cursor: pointer; color: white; }
      #play, #pause { background: ${CLR_BTN}; }
      #play:hover:not(:disabled), #pause:hover:not(:disabled) { opacity: 0.85; }
      #play:active:not(:disabled), #pause:active:not(:disabled) { opacity: 0.7; }
      #play:disabled, #pause:disabled { background: ${CLR_BTN_OFF}; color: ${CLR_TEXT_OFF}; cursor: not-allowed; }
      #reset { background: var(--error-color, #c00); border: none; color: white; }
      #reset:disabled { background: ${CLR_BTN_OFF}; color: ${CLR_TEXT_OFF}; cursor: not-allowed; }
      #reset-config { background: ${CLR_BTN}; border: none; color: white; }
      #reset-config:disabled { background: ${CLR_BTN_OFF}; border: none; color: ${CLR_TEXT_OFF}; cursor: not-allowed; }
      .divider { border: none; border-top: 2px solid var(--divider-color, #aaa); margin: 2px 0; }
      .player-row { display: flex; flex-direction: column; gap: 4px; padding-top: 16px; padding-bottom: 16px; }
      .player-row:first-child { padding-top: 0; }
      .player-row:last-child  { padding-bottom: 0; }
      .player-name-row { display: flex; align-items: center; gap: 8px; }
      .player-name { font-size: 0.95em; font-weight: bold; color: var(--primary-text-color); flex: 1; }
      .player-master, .player-slave { font-size: 0.85em; color: var(--secondary-text-color); flex-shrink: 0; }
      .player-track { font-size: 0.85em; color: var(--secondary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .btn-row { display: flex; gap: 8px; margin-top: 8px; }
      .btn-row button { flex: 1; padding: 12px; border: none; border-radius: 5px; font-size: 0.9em; cursor: pointer; color: white; }
      .btn-row .stop-btn { background: var(--error-color, #c00); border: none; color: white; }
      .btn-row .stop-btn:disabled { background: ${CLR_BTN_OFF}; border: none; color: ${CLR_TEXT_OFF}; cursor: not-allowed; }
      .btn-row .btn-group-toggle { background: ${CLR_BTN}; border: none; color: white; }
      .btn-row .btn-group-toggle:disabled { background: ${CLR_BTN_OFF}; border: none; color: ${CLR_TEXT_OFF}; cursor: not-allowed; }
      .btn-row .vol-down, .btn-row .vol-up { background: ${CLR_BTN}; border: 1px solid ${CLR_BTN}; color: white; }
      .btn-row .vol-down:disabled, .btn-row .vol-up:disabled { border: 1px solid ${CLR_BTN_OFF}; color: ${CLR_TEXT_OFF}; cursor: not-allowed; }
      .btn-row .vol-display { background: ${CLR_BTN}; border: 1px solid ${CLR_BTN}; color: white; font-weight: bold; cursor: default; }
      .btn-row .btn-pause { background: ${CLR_BTN}; border: none; color: white; }
      .btn-row .btn-pause:disabled { background: ${CLR_BTN_OFF}; color: ${CLR_TEXT_OFF}; cursor: not-allowed; }
    `;
  }

  _buildPlayerRows() {
    const players = this.config.players || [];
    const elements = [];

    players.forEach((p, i) => {
      if (i > 0) {
        const hr = document.createElement("hr");
        hr.className = "divider";
        elements.push(hr);
      }

      const state = this._hass.states[p.entity];
      const isPlaying =
        state && (state.state === "playing" || state.state === "paused");
      const isActivelyPlaying = state && state.state === "playing";
      const inGroup =
        state &&
        state.attributes.group_members &&
        state.attributes.group_members.length > 1;
      const isMaster =
        this._masterEntity !== null && this._masterEntity === p.entity;
      const isSlave = inGroup && !isMaster;
      const isGrouped = isSlave || this._groupedEntities.includes(p.entity);
      const isMasterWithSlaves =
        isMaster && (inGroup || this._groupedEntities.length > 0);
      const isInPaused = this._pausedEntities.includes(p.entity);
      const pauseBtnDisabled =
        !isActivelyPlaying && !isInPaused ? " disabled" : "";
      const pauseBtnIcon = isInPaused ? "mdi:play-pause" : "mdi:pause";
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
      } else if (this._resumingEntities.includes(p.entity)) {
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
          <span class="player-name">${this._esc(p.name)}</span>
          ${isMaster ? '<span class="player-master">Master</span>' : ""}
          ${isGrouped ? '<span class="player-slave">Slave</span>' : ""}
        </div>
        <div class="player-track">${this._esc(trackInfo)}</div>
        <div class="btn-row">
          <button class="stop-btn" data-index="${i}"${isPlaying ? "" : " disabled"}><ha-icon icon="mdi:stop"></ha-icon></button>
          <button class="btn-pause" data-index="${i}"${pauseBtnDisabled}><ha-icon icon="${pauseBtnIcon}"></ha-icon></button>
          <button class="btn-group-toggle" data-index="${i}" data-grouped="${isGrouped}"${this._masterEntity === null || (this._masterEntity === p.entity && !isMasterWithSlaves) ? " disabled" : ""}><ha-icon icon="${isGrouped || isMasterWithSlaves ? "mdi:link-variant-off" : "mdi:speaker-multiple"}"></ha-icon></button>
          <button class="vol-down" data-index="${i}"><ha-icon icon="mdi:volume-minus"></ha-icon></button>
          <button class="vol-display" data-index="${i}">${volume}</button>
          <button class="vol-up" data-index="${i}"><ha-icon icon="mdi:volume-plus"></ha-icon></button>
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
      <ha-card>
        <div class="dropdowns">
          <div class="row"><label>${this.config.stationLabel || "Sender"}</label><select id="station">${stationOptions}</select></div>
          <div class="row"><label>${this.config.playerLabel || "Lautsprecher"}</label><select id="player">${playerOptions}</select></div>
        </div>
        <div class="play-row">
          <button id="play"${playDisabled}><ha-icon icon="mdi:play"></ha-icon></button>
          <button id="pause"${pauseDisabled}><ha-icon icon="${pauseIcon}"></ha-icon></button>
          <button id="reset"${stopDisabled}><ha-icon icon="mdi:stop"></ha-icon></button>
          <button id="reset-config"${resetDisabled}><ha-icon icon="mdi:restore"></ha-icon></button>
        </div>
        <hr class="divider">
        <div id="player-list"></div>
      </ha-card>
    `;
  }

  _showVolumePopup(btn, player) {
    if (document.querySelector(".dl-vol-wrapper")) return;

    const maxVol = this._maxVol();
    const state = this._hass.states[player.entity];
    const volume =
      state && state.attributes.volume_level != null
        ? Math.round(state.attributes.volume_level * 100)
        : parseInt(btn.textContent);

    const presets = [0.2, 0.4, 0.6, 0.8].map((f) => Math.round(maxVol * f));

    const dialog = document.createElement("dialog");
    dialog.className = "dl-vol-wrapper";
    const cardRect = this.getBoundingClientRect();
    dialog.style.cssText = `padding:0;border:none;background:rgba(0,0,0,0.5);margin:0;position:fixed;left:${cardRect.left}px;top:${cardRect.top}px;width:${cardRect.width}px;height:${cardRect.height}px;max-width:none;max-height:none;display:flex;align-items:center;justify-content:center;overflow:hidden`;
    dialog.innerHTML = `
      <style>
        dialog.dl-vol-wrapper::backdrop { background: transparent; }
        .dl-vol-popup { background: var(--card-background-color, #2d2d2d); border-radius: 16px; padding: 24px 24px 20px; display: flex; flex-direction: column; align-items: center; gap: 16px; min-width: 220px; position: relative; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
        .dl-vol-close { position: absolute; top: 12px; left: 12px; background: transparent; border: none; color: var(--primary-text-color, #fff); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; }
        .dl-vol-close ha-icon { --mdc-icon-size: 22px; }
        .dl-vol-name  { font-size: 1.1em; font-weight: bold; color: var(--primary-text-color, #fff); margin-top: 8px; }
        .dl-vol-value { font-size: 2em; font-weight: bold; color: var(--primary-text-color, #fff); min-width: 3ch; text-align: center; }
        .dl-vol-track { width: 100px; height: 220px; border-radius: 30px; background: var(--secondary-background-color); position: relative; cursor: pointer; touch-action: none; user-select: none; overflow: hidden; }
        .dl-vol-fill  { position: absolute; bottom: 0; left: 0; right: 0; background: ${CLR_ACCENT}; border-radius: 0; pointer-events: none; }
        .dl-vol-handle { position: absolute; top: 12px; left: 20%; right: 20%; height: 4px; background: rgba(255,255,255,0.9); border-radius: 2px; }
        .dl-vol-presets { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .dl-vol-preset { background: var(--secondary-background-color); border: none; border-radius: 20px; padding: 8px 14px; color: var(--primary-text-color); cursor: pointer; font-size: 0.9em; transition: background 0.15s; }
        .dl-vol-preset.active { background: ${CLR_BTN}; color: white; }
      </style>
      <div class="dl-vol-popup">
        <button class="dl-vol-close"><ha-icon icon="mdi:close"></ha-icon></button>
        <div class="dl-vol-name">${this._esc(player.name)}</div>
        <div class="dl-vol-value">${volume}</div>
        <div class="dl-vol-track">
          <div class="dl-vol-fill" style="height:${(Math.min(volume, maxVol) / maxVol) * 100}%">
            <div class="dl-vol-handle"></div>
          </div>
        </div>
        <div class="dl-vol-presets">
          ${presets.map((v) => `<button class="dl-vol-preset${volume === v ? " active" : ""}" data-val="${v}">${v}</button>`).join("")}
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();

    const valueDisplay = dialog.querySelector(".dl-vol-value");
    const track = dialog.querySelector(".dl-vol-track");
    const fill = dialog.querySelector(".dl-vol-fill");

    const updateUI = (val) => {
      fill.style.height = (val / maxVol) * 100 + "%";
      valueDisplay.textContent = val;
      dialog
        .querySelectorAll(".dl-vol-preset")
        .forEach((p) =>
          p.classList.toggle("active", parseInt(p.dataset.val) === val)
        );
    };

    const getVolFromY = (clientY) => {
      const rect = track.getBoundingClientRect();
      return Math.round(
        Math.min(1, Math.max(0, (rect.bottom - clientY) / rect.height)) * maxVol
      );
    };

    const setVolume = (val) => {
      btn.textContent = String(val);
      this._hass.callService("media_player", "volume_set", {
        entity_id: player.entity,
        volume_level: val / 100,
      });
    };

    track.addEventListener("pointerdown", (e) => {
      track.setPointerCapture(e.pointerId);
      updateUI(getVolFromY(e.clientY));
      e.preventDefault();
    });
    track.addEventListener("pointermove", (e) => {
      if (!track.hasPointerCapture(e.pointerId)) return;
      updateUI(getVolFromY(e.clientY));
    });
    track.addEventListener("pointerup", (e) => {
      if (!track.hasPointerCapture(e.pointerId)) return;
      const val = getVolFromY(e.clientY);
      updateUI(val);
      setVolume(val);
    });

    dialog.querySelectorAll(".dl-vol-preset").forEach((preset) => {
      preset.addEventListener("click", () => {
        const val = parseInt(preset.dataset.val);
        updateUI(val);
        setVolume(val);
      });
    });

    const closePopup = () => {
      dialog.close();
      dialog.remove();
      document.removeEventListener("keydown", onEsc, { capture: true });
    };
    const onEsc = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        closePopup();
      }
    };
    document.addEventListener("keydown", onEsc, { capture: true });
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closePopup();
    });
    dialog.addEventListener("click", (e) => {
      if (!dialog.querySelector(".dl-vol-popup").contains(e.target))
        closePopup();
    });
    dialog.querySelector(".dl-vol-close").addEventListener("click", closePopup);
  }

  _bindEvents(isResumeMode) {
    this.shadowRoot
      .getElementById("station")
      .addEventListener("change", (e) => {
        this._selectedStation = parseInt(e.target.value);
        this.shadowRoot.getElementById("play").disabled =
          this._selectedStation === -1 || this._selectedPlayer === -1;
      });

    this.shadowRoot.getElementById("player").addEventListener("change", (e) => {
      this._selectedPlayer = parseInt(e.target.value);
      this.shadowRoot.getElementById("play").disabled =
        this._selectedStation === -1 || this._selectedPlayer === -1;
    });

    this.shadowRoot.getElementById("reset").addEventListener("click", () => {
      (this.config.players || []).forEach((p) =>
        this._hass.callService("media_player", "media_stop", {
          entity_id: p.entity,
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
        (this.config.players || []).forEach((p) => {
          this._hass.callService("media_player", "unjoin", {
            entity_id: p.entity,
          });
          this._hass.callService("media_player", "volume_set", {
            entity_id: p.entity,
            volume_level: this._resetVol(),
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
        const currentVol =
          playerState && playerState.attributes.volume_level != null
            ? playerState.attributes.volume_level * 100
            : 0;
        if (currentVol > VOL_START_THRESHOLD) {
          this._hass.callService("media_player", "volume_set", {
            entity_id: player.entity,
            volume_level: this._resetVol(),
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
          (e) => e !== player.entity
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
        (this.config.players || []).forEach((p) => {
          const s = this._hass.states[p.entity];
          if (s && s.state === "playing") {
            this._pausedEntities.push(p.entity);
            this._hass.callService("media_player", "media_pause", {
              entity_id: p.entity,
            });
          }
        });
      }
      this.render();
    });

    this.shadowRoot.querySelectorAll(".stop-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const player = this.config.players[parseInt(btn.dataset.index)];
        this._hass.callService("media_player", "media_stop", {
          entity_id: player.entity,
        });
        if (this._masterEntity === player.entity) this._masterEntity = null;
        this.render();
      });
    });

    this.shadowRoot.querySelectorAll(".btn-pause").forEach((btn) => {
      btn.addEventListener("click", () => {
        const player = this.config.players[parseInt(btn.dataset.index)];
        if (this._pausedEntities.includes(player.entity)) {
          this._resumingEntities = [...this._resumingEntities, player.entity];
          this._pausedEntities = this._pausedEntities.filter(
            (e) => e !== player.entity
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

    this.shadowRoot.querySelectorAll(".btn-group-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const player = this.config.players[parseInt(btn.dataset.index)];
        const isMasterClick = this._masterEntity === player.entity;

        if (isMasterClick) {
          const oldMaster = player.entity;
          const state = this._hass.states[oldMaster];
          const haGroupMembers = (
            (state && state.attributes.group_members) ||
            []
          ).filter((e) => e !== oldMaster);
          const newMaster =
            this._groupedEntities[0] || haGroupMembers[0] || null;

          this._masterEntity = newMaster;
          if (newMaster)
            this._groupedEntities = this._groupedEntities.filter(
              (e) => e !== newMaster
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
        } else if (btn.dataset.grouped === "true") {
          this._groupedEntities = this._groupedEntities.filter(
            (e) => e !== player.entity
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

    this.shadowRoot.querySelectorAll(".vol-display").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._showVolumePopup(
          btn,
          this.config.players[parseInt(btn.dataset.index)]
        );
      });
    });

    this.shadowRoot.querySelectorAll(".vol-down, .vol-up").forEach((btn) => {
      btn.addEventListener("click", () => {
        const isUp = btn.classList.contains("vol-up");
        const player = this.config.players[parseInt(btn.dataset.index)];
        const display = btn.parentElement.querySelector(".vol-display");
        const newVal = Math.min(
          this._maxVol(),
          Math.max(0, parseInt(display.textContent) + (isUp ? 1 : -1))
        );
        display.textContent = newVal;
        this._hass.callService("media_player", "volume_set", {
          entity_id: player.entity,
          volume_level: newVal / 100,
        });
      });
    });
  }

  render() {
    if (!this.config || !this._hass) return;

    if (!this._masterAutoDetected) {
      this._masterAutoDetected = true;
      const playing = (this.config.players || []).find((p) => {
        const s = this._hass.states[p.entity];
        return s && (s.state === "playing" || s.state === "paused");
      });
      if (playing) this._masterEntity = playing.entity;
    }

    this._resumingEntities = this._resumingEntities.filter((entity) => {
      const s = this._hass.states[entity];
      return !s || s.state !== "playing";
    });

    const stations = this.config.stations || [];
    const players = this.config.players || [];

    const stationOptions =
      `<option value="-1"${this._selectedStation === -1 ? " selected" : ""}></option>` +
      stations
        .map(
          (s, i) =>
            `<option value="${i}"${i === this._selectedStation ? " selected" : ""}>${s.name}</option>`
        )
        .join("");

    const playerOptions =
      `<option value="-1"${this._selectedPlayer === -1 ? " selected" : ""}></option>` +
      players
        .map(
          (p, i) =>
            `<option value="${i}"${i === this._selectedPlayer ? " selected" : ""}>${p.name}</option>`
        )
        .join("");

    const playDisabled =
      this._selectedStation === -1 || this._selectedPlayer === -1
        ? " disabled"
        : "";
    const anyPlaying = players.some((p) => {
      const s = this._hass.states[p.entity];
      return s && s.state === "playing";
    });
    const anyPaused = players.some((p) => {
      const s = this._hass.states[p.entity];
      return s && s.state === "paused";
    });
    const isResumeMode = !anyPlaying && this._pausedEntities.length > 0;
    const stopDisabled =
      anyPlaying || anyPaused || this._pausedEntities.length > 0
        ? ""
        : " disabled";
    const pauseDisabled = anyPlaying || isResumeMode ? "" : " disabled";
    const pauseIcon = isResumeMode ? "mdi:play-pause" : "mdi:pause";
    const resetDisabled = players.some((p) => {
      const s = this._hass.states[p.entity];
      return s && (s.state === "playing" || s.state === "paused");
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
    this._escHandler = (e) => {
      if (
        e.key !== "Escape" ||
        document.querySelector(".pp-wrapper,.sp-wrapper,.dl-vol-wrapper")
      )
        return;
      const dlg = this._findHaEditDialog();
      if (!dlg) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (typeof dlg.closeDialog === "function") {
        // If no changes were made, reset HA's internal dirty flag to avoid the
        // "Unsaved Changes" confirmation appearing unnecessarily.
        if (!this._editorDirty) dlg._dirty = false;
        dlg.closeDialog();
        return;
      }
      const btn = dlg.shadowRoot?.querySelector(
        "ha-icon-button[slot='navigationIcon'], mwc-icon-button[slot='navigationIcon'], [dialogaction='close']"
      );
      if (btn) {
        btn.click();
        return;
      }
      (
        dlg.shadowRoot?.querySelector("ha-dialog") ??
        dlg.shadowRoot?.querySelector("dialog")
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
    const sel = "hui-dialog-edit-card,hui-edit-card-dialog";
    const q = (root) => root?.querySelector?.(sel) ?? null;
    // querySelector does NOT pierce shadow roots; walk each boundary manually.
    // HA path: document → home-assistant → home-assistant-main
    //          → ha-panel-lovelace / partial-panel-resolver → hui-root → dialog
    const ha = document.querySelector("home-assistant");
    const haR = ha?.shadowRoot;
    const main = haR?.querySelector("home-assistant-main");
    const mainR = main?.shadowRoot;
    const panel =
      mainR?.querySelector("ha-panel-lovelace") ??
      mainR?.querySelector("partial-panel-resolver");
    const panelR = panel?.shadowRoot;
    const huiRoot = panelR?.querySelector("hui-root");
    return (
      q(document) ??
      q(haR) ??
      q(mainR) ??
      q(panelR) ??
      q(huiRoot?.shadowRoot) ??
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
      stations: (config.stations || []).map((s) => ({ ...s })),
      players: (config.players || []).map((p) => ({ ...p })),
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

  _esc(str) {
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
        const r = node.getBoundingClientRect();
        if (r.width > 100) return r;
      }
      const r = node.getBoundingClientRect();
      if (
        r.width > editorRect.width + 100 &&
        r.width < window.innerWidth * 0.99 &&
        r.height > 300
      )
        return r;
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
    const s = this._config.stations || [];
    const p = this._config.players || [];

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; padding-bottom: 16px; }
        .section-title { font-weight: bold; font-size: 0.95em; margin: 16px 0 6px; color: var(--primary-text-color); padding: 0 16px; display: flex; align-items: center; justify-content: space-between; }
        .sort-btn { background: transparent; border: none; cursor: pointer; color: var(--secondary-text-color); padding: 4px; display: flex; align-items: center; border-radius: 4px; }
        .sort-btn:hover { color: var(--primary-text-color); background: rgba(128,128,128,0.15); }
        .sort-btn ha-icon { --mdc-icon-size: 18px; pointer-events: none; }
        .item { display: flex; align-items: flex-end; gap: 8px; padding: 4px 16px; }
        .item.drag-over { outline: 2px solid ${CLR_ACCENT}; border-radius: 4px; background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.08); }
        .field { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .field-label { font-size: 0.75em; color: var(--secondary-text-color); }
        .left-col { flex: 1; display: flex; align-items: flex-end; gap: 8px; min-width: 0; }
        .left-col .field { flex: 1; }
        input[type="text"], input[type="number"] {
          width: 100%; height: 36px; padding: 0 10px; box-sizing: border-box;
          border: 1px solid var(--divider-color, #555); border-radius: 4px;
          background: var(--secondary-background-color, #1c1c1c);
          color: var(--primary-text-color); font-size: 0.9em;
        }
        input[type="text"]:focus, input[type="number"]:focus { outline: none; border-color: ${CLR_ACCENT}; }
        input[type="number"] { -moz-appearance: textfield; }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; }
        .del-btn  { background: transparent; border: none; cursor: pointer; color: var(--error-color, #c00); padding: 6px; flex-shrink: 0; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; }
        .del-btn ha-icon { --mdc-icon-size: 20px; pointer-events: none; }
        .drag-btn { background: transparent; border: none; cursor: grab; color: var(--secondary-text-color); padding: 6px; flex-shrink: 0; width: 28px; height: 36px; display: flex; align-items: center; justify-content: center; touch-action: none; }
        .drag-btn:active { cursor: grabbing; }
        .drag-btn ha-icon { --mdc-icon-size: 18px; pointer-events: none; }
        .add-btn { display: block; width: calc(100% - 32px); margin: 8px 16px 0; padding: 10px;
          background: transparent; border: 1px dashed var(--divider-color, #555); border-radius: 5px;
          color: var(--secondary-text-color); cursor: pointer; font-size: 0.9em; text-align: center; box-sizing: border-box; }
        .add-btn:hover { background: rgba(128,128,128,0.1); }
      </style>

      <div class="section-title">Beschriftungen</div>
      <div class="item">
        <div class="field">
          <div class="field-label">Linkes Label</div>
          <input type="text" id="station-label" value="${this._esc(this._config.stationLabel)}">
        </div>
        <div class="field">
          <div class="field-label">Rechtes Label</div>
          <input type="text" id="player-label" value="${this._esc(this._config.playerLabel)}">
        </div>
      </div>

      <div class="section-title">Lautstärke</div>
      <div class="item">
        <div class="field">
          <div class="field-label">Max. Lautstärke (1–100)</div>
          <input type="number" id="max-volume" min="1" max="100" value="${this._config.maxVolume}">
        </div>
        <div class="field">
          <div class="field-label">Reset-Lautstärke (0–100)</div>
          <input type="number" id="reset-volume" min="0" max="100" value="${this._config.resetVolume}">
        </div>
      </div>

      <div class="section-title">
        <span>Sender</span>
        <button class="sort-btn" data-section="stations" title="Alphabetisch sortieren"><ha-icon icon="mdi:sort-alphabetical-ascending"></ha-icon></button>
      </div>
      ${s
        .map(
          (st, i) => `
        <div class="item" draggable="true" data-drag-section="stations" data-drag-index="${i}">
          <button class="drag-btn"><ha-icon icon="mdi:drag"></ha-icon></button>
          <div class="left-col">
            <div class="field">
              <div class="field-label">Name</div>
              <input type="text" class="st-name" data-index="${i}" value="${this._esc(st.name)}">
            </div>
          </div>
          <div class="field">
            <div class="field-label">URL</div>
            <input type="text" class="st-url" data-index="${i}" value="${this._esc(st.url)}">
          </div>
          <button class="del-btn" data-section="stations" data-index="${i}"><ha-icon icon="mdi:delete"></ha-icon></button>
        </div>
      `
        )
        .join("")}
      <button class="add-btn" id="add-station">+ Sender hinzufügen</button>

      <div class="section-title">
        <span>Lautsprecher</span>
        <button class="sort-btn" data-section="players" title="Alphabetisch sortieren"><ha-icon icon="mdi:sort-alphabetical-ascending"></ha-icon></button>
      </div>
      ${p
        .map(
          (pl, i) => `
        <div class="item" draggable="true" data-drag-section="players" data-drag-index="${i}">
          <button class="drag-btn"><ha-icon icon="mdi:drag"></ha-icon></button>
          <div class="left-col">
            <div class="field">
              <div class="field-label">Entity ID</div>
              <input type="text" class="pl-entity" data-index="${i}" value="${this._esc(pl.entity)}" placeholder="media_player.name">
            </div>
          </div>
          <div class="field">
            <div class="field-label">Anzeigename</div>
            <input type="text" class="pl-name" data-index="${i}" value="${this._esc(pl.name)}">
          </div>
          <button class="del-btn" data-section="players" data-index="${i}"><ha-icon icon="mdi:delete"></ha-icon></button>
        </div>
      `
        )
        .join("")}
      <button class="add-btn" id="add-player">+ Lautsprecher hinzufügen</button>
    `;

    this._bindEditorEvents();
  }

  _showPlayerPicker() {
    if (document.querySelector(".pp-wrapper")) return;

    const ref = this._getPickerRefRect();
    const added = new Set(this._config.players.map((p) => p.entity));
    const available = Object.entries(this._hass.states)
      .filter(([id]) => id.startsWith("media_player.") && !added.has(id))
      .map(([id, state]) => ({
        id,
        name: state.attributes.friendly_name || id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const dialog = document.createElement("dialog");
    dialog.className = "pp-wrapper";
    dialog.style.cssText =
      "display:block;padding:0;margin:0;border:none;background:transparent;overflow:visible;max-width:none;max-height:none;pointer-events:none";
    dialog.innerHTML = `
      <style>
        dialog.pp-wrapper::backdrop { display: none; }
        .pp-overlay  { position: fixed; left: ${ref.left}px; top: ${ref.top}px; width: ${ref.width}px; height: ${ref.height}px; background: transparent; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: all; box-sizing: border-box; }
        .pp-popup    { background: var(--card-background-color, #2d2d2d); border-radius: 12px; min-width: 300px; max-width: 420px; max-height: 60vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
        .pp-header   { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--divider-color, #444); flex-shrink: 0; }
        .pp-title    { font-weight: normal; font-size: var(--dialog-heading-font-size, 1.5rem); color: var(--primary-text-color, #fff); }
        .pp-close    { background: transparent; border: none; cursor: pointer; color: var(--secondary-text-color); padding: 4px; display: flex; }
        .pp-close ha-icon { --mdc-icon-size: 20px; pointer-events: none; }
        .pp-list     { overflow-y: auto; flex: 1; }
        .pp-item     { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid var(--divider-color, #333); }
        .pp-item:last-child { border-bottom: none; }
        .pp-item:hover { background: rgba(128,128,128,0.12); }
        .pp-item ha-icon   { --mdc-icon-size: 22px; color: var(--secondary-text-color); flex-shrink: 0; }
        .pp-item-info      { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .pp-item-name      { font-size: 0.95em; color: var(--primary-text-color, #fff); }
        .pp-item-id        { font-size: 0.78em; color: var(--secondary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pp-empty    { padding: 24px 16px; text-align: center; color: var(--secondary-text-color); font-size: 0.9em; }
      </style>
      <div class="pp-overlay">
        <div class="pp-popup">
          <div class="pp-header">
            <span class="pp-title">Lautsprecher auswählen</span>
            <button class="pp-close"><ha-icon icon="mdi:close"></ha-icon></button>
          </div>
          <div class="pp-list">
            ${
              available.length === 0
                ? '<div class="pp-empty">Keine weiteren Lautsprecher verfügbar</div>'
                : available
                    .map(
                      (e) => `
                  <div class="pp-item" data-entity="${e.id}" data-name="${this._esc(e.name)}">
                    <ha-icon icon="mdi:speaker"></ha-icon>
                    <div class="pp-item-info">
                      <div class="pp-item-name">${this._esc(e.name)}</div>
                      <div class="pp-item-id">${e.id}</div>
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
    const onEsc = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onEsc, { capture: true });
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });

    dialog.querySelector(".pp-close").addEventListener("click", close);
    dialog.querySelector(".pp-overlay").addEventListener("click", (e) => {
      if (e.target === dialog.querySelector(".pp-overlay")) close();
    });

    dialog.querySelectorAll(".pp-item").forEach((item) => {
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
    if (document.querySelector(".sp-wrapper")) return;

    const ref = this._getPickerRefRect();
    const added = new Set(this._config.stations.map((s) => s.url));

    const dialog = document.createElement("dialog");
    dialog.className = "sp-wrapper";
    dialog.style.cssText =
      "display:block;padding:0;margin:0;border:none;background:transparent;overflow:visible;max-width:none;max-height:none;pointer-events:none";
    dialog.innerHTML = `
      <style>
        dialog.sp-wrapper::backdrop { display: none; }
        .sp-overlay    { position: fixed; left: ${ref.left}px; top: ${ref.top}px; width: ${ref.width}px; height: ${ref.height}px; background: transparent; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: all; box-sizing: border-box; }
        .sp-popup      { background: var(--card-background-color, #2d2d2d); border-radius: 12px; width: 420px; max-width: calc(100% - 32px); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
        .sp-header     { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--divider-color, #444); flex-shrink: 0; }
        .sp-title      { font-weight: normal; font-size: var(--dialog-heading-font-size, 1.5rem); color: var(--primary-text-color, #fff); }
        .sp-close      { background: transparent; border: none; cursor: pointer; color: var(--secondary-text-color); padding: 4px; display: flex; }
        .sp-close ha-icon { --mdc-icon-size: 20px; pointer-events: none; }
        .sp-search-wrap { padding: 10px 16px; border-bottom: 1px solid var(--divider-color, #444); flex-shrink: 0; }
        .sp-search     { width: 100%; height: 36px; padding: 0 10px; box-sizing: border-box; border: 1px solid var(--divider-color, #555); border-radius: 4px; background: var(--secondary-background-color, #1c1c1c); color: var(--primary-text-color); font-size: 0.9em; outline: none; }
        .sp-search:focus { border-color: ${CLR_ACCENT}; }
        .sp-list       { overflow-y: auto; height: calc(6 * 48px); }
        .sp-item       { display: flex; align-items: center; gap: 12px; padding: 10px 16px; cursor: pointer; border-bottom: 1px solid var(--divider-color, #333); min-height: 48px; box-sizing: border-box; }
        .sp-item:last-child { border-bottom: none; }
        .sp-item:hover { background: rgba(128,128,128,0.12); }
        .sp-item ha-icon   { --mdc-icon-size: 22px; color: var(--secondary-text-color); flex-shrink: 0; }
        .sp-item-info      { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
        .sp-item-name      { font-size: 0.95em; color: var(--primary-text-color, #fff); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sp-item-sub       { font-size: 0.78em; color: var(--secondary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sp-status     { height: 100%; display: flex; align-items: center; justify-content: center; color: var(--secondary-text-color); font-size: 0.9em; }
        .sp-spinner    { width: 32px; height: 32px; border: 3px solid var(--divider-color, #444); border-top-color: ${CLR_ACCENT}; border-radius: 50%; animation: sp-spin 0.8s linear infinite; }
        @keyframes sp-spin { to { transform: rotate(360deg); } }
      </style>
      <div class="sp-overlay">
        <div class="sp-popup">
          <div class="sp-header">
            <span class="sp-title">Sender auswählen</span>
            <button class="sp-close"><ha-icon icon="mdi:close"></ha-icon></button>
          </div>
          <div class="sp-search-wrap">
            <input type="text" class="sp-search" placeholder="Sender suchen...">
          </div>
          <div class="sp-list"><div class="sp-status"><div class="sp-spinner"></div></div></div>
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
    const onEsc = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onEsc, { capture: true });
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });

    dialog.querySelector(".sp-close").addEventListener("click", close);
    dialog.querySelector(".sp-overlay").addEventListener("click", (e) => {
      if (e.target === dialog.querySelector(".sp-overlay")) close();
    });

    const list = dialog.querySelector(".sp-list");

    const renderList = (stations) => {
      const filtered = stations.filter(
        (s) => !added.has("media-source://radio_browser/" + s.stationuuid)
      );
      if (filtered.length === 0) {
        list.innerHTML = '<div class="sp-status">Keine Sender gefunden</div>';
        return;
      }
      list.innerHTML = filtered
        .map(
          (s) => `
        <div class="sp-item" data-name="${this._esc(s.name)}" data-url="media-source://radio_browser/${s.stationuuid}">
          <ha-icon icon="mdi:radio"></ha-icon>
          <div class="sp-item-info">
            <div class="sp-item-name">${this._esc(s.name)}</div>
            ${s.country ? `<div class="sp-item-sub">${this._esc(s.country)}</div>` : ""}
          </div>
        </div>`
        )
        .join("");
      list.querySelectorAll(".sp-item").forEach((item) => {
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
        '<div class="sp-status"><div class="sp-spinner"></div></div>';
      try {
        const url = query
          ? `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}&limit=100&order=votes&reverse=true&hidebroken=true`
          : `https://de1.api.radio-browser.info/json/stations/topvote/100`;
        const resp = await fetch(url);
        renderList(await resp.json());
      } catch {
        list.innerHTML =
          '<div class="sp-status">Fehler beim Laden der Sender</div>';
      }
    };

    fetchStations();

    let debounceTimer;
    dialog.querySelector(".sp-search").addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(
        () => fetchStations(e.target.value.trim()),
        300
      );
    });
  }

  _bindLabelEvents() {
    this.shadowRoot
      .getElementById("station-label")
      .addEventListener("change", (e) => {
        this._config.stationLabel = e.target.value;
        this._fire();
      });
    this.shadowRoot
      .getElementById("player-label")
      .addEventListener("change", (e) => {
        this._config.playerLabel = e.target.value;
        this._fire();
      });
    this.shadowRoot
      .getElementById("max-volume")
      .addEventListener("change", (e) => {
        const val = Math.min(
          100,
          Math.max(1, parseInt(e.target.value) || MAX_VOLUME)
        );
        e.target.value = val;
        this._config.maxVolume = val;
        this._fire();
      });
    this.shadowRoot
      .getElementById("reset-volume")
      .addEventListener("change", (e) => {
        const val = Math.min(
          100,
          Math.max(0, parseInt(e.target.value) || RESET_VOLUME)
        );
        e.target.value = val;
        this._config.resetVolume = val;
        this._fire();
      });
  }

  _bindFieldEvents() {
    const on = (sel, evt, fn) =>
      this.shadowRoot
        .querySelectorAll(sel)
        .forEach((el) => el.addEventListener(evt, fn));
    on(".st-name", "change", (e) => {
      this._config.stations[+e.target.dataset.index].name = e.target.value;
      this._fire();
    });
    on(".st-url", "change", (e) => {
      this._config.stations[+e.target.dataset.index].url = e.target.value;
      this._fire();
    });
    on(".pl-entity", "change", (e) => {
      this._config.players[+e.target.dataset.index].entity = e.target.value;
      this._fire();
    });
    on(".pl-name", "change", (e) => {
      this._config.players[+e.target.dataset.index].name = e.target.value;
      this._fire();
    });
    on(".del-btn", "click", (e) => {
      const btn = e.currentTarget;
      this._config[btn.dataset.section].splice(+btn.dataset.index, 1);
      this._render();
      this._fire();
    });
    on(".sort-btn", "click", (e) => {
      const section = e.currentTarget.dataset.section;
      this._config[section].sort((a, b) => a.name.localeCompare(b.name));
      this._render();
      this._fire();
    });
  }

  _bindDragEvents() {
    const on = (sel, evt, fn) =>
      this.shadowRoot
        .querySelectorAll(sel)
        .forEach((el) => el.addEventListener(evt, fn));
    let dragSrc = null;
    on(".item[draggable]", "dragstart", (e) => {
      if (e.target.tagName === "INPUT") {
        e.preventDefault();
        return;
      }
      dragSrc = e.currentTarget;
      e.dataTransfer.effectAllowed = "move";
      setTimeout(
        () => dragSrc && dragSrc.style.setProperty("opacity", "0.4"),
        0
      );
    });
    on(".item[draggable]", "dragend", (e) => {
      e.currentTarget.style.removeProperty("opacity");
      this.shadowRoot
        .querySelectorAll(".item.drag-over")
        .forEach((el) => el.classList.remove("drag-over"));
      dragSrc = null;
    });
    on(".item[draggable]", "dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    on(".item[draggable]", "dragenter", (e) => {
      e.currentTarget.classList.add("drag-over");
    });
    on(".item[draggable]", "dragleave", (e) => {
      e.currentTarget.classList.remove("drag-over");
    });
    on(".item[draggable]", "drop", (e) => {
      e.preventDefault();
      const dst = e.currentTarget;
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
