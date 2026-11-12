/**
 * =====================================================================
 * PROJECT: ORVYXA
 * AUTONOMOUS SPACECRAFT MONITORING SYSTEM
 * File: script.js
 * Engine: Native Vanilla JavaScript (ES6+)
 * Protocol: Web Serial API (USB 115200 Baud)
 * =====================================================================
 */

// Application State
const state = {
  // Connection
  port: null,
  reader: null,
  readableStreamClosed: null,
  isConnected: false,
  isDemoMode: false,
  demoTimer: null,
  packetCount: 0,
  lastPacketTime: null,
  baudRate: 115200,

  // Hardware Sensor Data (Physical ESP32 Telemetry)
  telemetry: {
    temperature: null,
    humidity: null,
    voltage: null,
    current: null,
    power: null,
    distance: null,
    mpuStatus: 'I2C_FAULT'
  },

  // Simulated Telemetry (MPU6050 fault fallback & Pressure)
  simulated: {
    accelX: 0.02,
    accelY: -0.01,
    accelZ: 0.98,
    gyroX: -0.15,
    gyroY: 0.22,
    gyroZ: 0.04,
    pressureKPa: 101.32,
    pressureHPa: 1013.2,
    pitch: 0,
    roll: 0
  },

  // History Buffers for Waveform Charts (60 samples)
  history: {
    temp: [],
    hum: [],
    voltage: [],
    power: []
  },

  // Audio Telemetry Feedback
  audioEnabled: false,
  audioCtx: null,

  // Mission Elapsed Time (MET)
  missionStartTime: Date.now()
};

// DOM Cache
const dom = {
  // Connection & Controls
  btnConnect: document.getElementById('btn-connect'),
  btnDisconnect: document.getElementById('btn-disconnect'),
  btnDemoToggle: document.getElementById('btn-demo-toggle'),
  connStatusPill: document.getElementById('conn-status-pill'),
  connStatusText: document.getElementById('conn-status-text'),
  baudTag: document.getElementById('baud-tag'),
  missionModeIndicator: document.getElementById('mission-mode-indicator'),
  browserWarning: document.getElementById('browser-warning-banner'),

  // Ribbon
  metClock: document.getElementById('met-clock'),
  lastUpdateTime: document.getElementById('last-update-time'),
  packetCounter: document.getElementById('packet-counter'),
  btnAudioToggle: document.getElementById('btn-audio-toggle'),
  audioIcon: document.getElementById('audio-icon'),
  audioStateText: document.getElementById('audio-state-text'),

  // Health Status Badges
  badgeTemp: document.getElementById('badge-temp-status'),
  badgePower: document.getElementById('badge-power-status'),
  badgeComm: document.getElementById('badge-comm-status'),
  badgeSonar: document.getElementById('badge-sonar-status'),
  badgeMpu: document.getElementById('badge-mpu-status'),
  detailTemp: document.getElementById('health-temp-detail'),
  detailPower: document.getElementById('health-power-detail'),
  detailComm: document.getElementById('health-comm-detail'),
  detailSonar: document.getElementById('health-sonar-detail'),
  detailMpu: document.getElementById('health-mpu-detail'),
  barTemp: document.getElementById('bar-temp'),
  barPower: document.getElementById('bar-power'),
  barComm: document.getElementById('bar-comm'),
  barSonar: document.getElementById('bar-sonar'),
  barMpu: document.getElementById('bar-mpu'),

  // Telemetry DHT11
  valTemp: document.getElementById('val-temp'),
  valHum: document.getElementById('val-hum'),
  gaugeTemp: document.getElementById('gauge-temp'),
  gaugeHum: document.getElementById('gauge-hum'),
  stateTemp: document.getElementById('state-temp'),
  stateHum: document.getElementById('state-hum'),
  tempFEquiv: document.getElementById('temp-f-equiv'),
  dewpointCalc: document.getElementById('dewpoint-calc'),

  // Telemetry INA219
  valVolt: document.getElementById('val-volt'),
  valCurr: document.getElementById('val-curr'),
  valPwr: document.getElementById('val-pwr'),
  gaugeVolt: document.getElementById('gauge-volt'),
  gaugeCurr: document.getElementById('gauge-curr'),
  gaugePwr: document.getElementById('gauge-pwr'),
  stateVolt: document.getElementById('state-volt'),
  stateCurr: document.getElementById('state-curr'),
  statePwr: document.getElementById('state-pwr'),

  // Telemetry HC-SR04
  valDist: document.getElementById('val-dist'),
  valDistStatus: document.getElementById('val-dist-status'),
  gaugeDist: document.getElementById('gauge-dist'),
  boxSonarStatus: document.getElementById('box-sonar-status'),
  distInchEquiv: document.getElementById('dist-inch-equiv'),
  radarTargetBlip: document.getElementById('radar-target-blip'),

  // Telemetry MPU6050 (Simulated)
  valAccX: document.getElementById('val-acc-x'),
  valAccY: document.getElementById('val-acc-y'),
  valAccZ: document.getElementById('val-acc-z'),
  barAccX: document.getElementById('bar-accel-x'),
  barAccY: document.getElementById('bar-accel-y'),
  barAccZ: document.getElementById('bar-accel-z'),
  valGyroX: document.getElementById('val-gyro-x'),
  valGyroY: document.getElementById('val-gyro-y'),
  valGyroZ: document.getElementById('val-gyro-z'),
  barGyroX: document.getElementById('bar-gyro-x'),
  barGyroY: document.getElementById('bar-gyro-y'),
  barGyroZ: document.getElementById('bar-gyro-z'),
  gimbalHorizon: document.getElementById('gimbal-horizon'),

  // Pressure (Simulated)
  valPress: document.getElementById('val-press'),
  valPressHPa: document.getElementById('val-press-hpa'),
  gaugePress: document.getElementById('gauge-press'),

  // Terminal Log
  terminalBody: document.getElementById('terminal-body'),
  chkAutoscroll: document.getElementById('chk-autoscroll'),
  btnClearTerminal: document.getElementById('btn-clear-terminal'),
  termPortName: document.getElementById('term-port-name'),

  // Canvases
  chartDht: document.getElementById('chart-dht'),
  chartPower: document.getElementById('chart-power'),
  spaceCanvas: document.getElementById('space-canvas')
};

// =====================================================================
// 1. INITIALIZATION & BROWSER CHECKS
// =====================================================================
window.addEventListener('DOMContentLoaded', () => {
  initStarfield();
  initMissionClock();
  initChartBuffers();
  setupEventListeners();
  checkWebSerialSupport();
  startSimulationLoops();
  logTerminal('[SYSTEM READY] ORVYXA Aerospace Telemetry Core Activated.', 'sys');
});

/**
 * Check if the browser supports Web Serial API
 */
function checkWebSerialSupport() {
  if (!('serial' in navigator)) {
    if (dom.browserWarning) {
      dom.browserWarning.classList.remove('hidden');
    }
    logTerminal('[WARNING] Web Serial API not detected. Use Chrome, Edge, or enable Simulator Mode.', 'warn');
  } else {
    logTerminal('[USB LINK] Web Serial API is supported by this browser.', 'sys');
    // Listen for device disconnection (unplugging USB cable)
    navigator.serial.addEventListener('disconnect', (event) => {
      logTerminal('[ALERT] ESP32 USB cable physically disconnected.', 'err');
      handleDisconnection();
    });
  }
}

// =====================================================================
// 2. WEB SERIAL USB CONNECTION LOGIC
// =====================================================================
function setupEventListeners() {
  // Connect ESP32
  dom.btnConnect.addEventListener('click', connectESP32);

  // Disconnect ESP32
  dom.btnDisconnect.addEventListener('click', disconnectESP32);

  // Demo / Simulator Mode Toggle
  dom.btnDemoToggle.addEventListener('click', toggleDemoMode);

  // Clear Terminal Log
  dom.btnClearTerminal.addEventListener('click', () => {
    dom.terminalBody.innerHTML = '';
    logTerminal('[TERMINAL] Log buffer cleared.', 'info');
  });

  // Audio Synth Toggle
  dom.btnAudioToggle.addEventListener('click', toggleAudio);

  // Smooth Navigation
  document.querySelectorAll('.header-nav a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      document.querySelectorAll('.header-nav a').forEach(a => a.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

/**
 * Connect to ESP32 using Web Serial API
 */
async function connectESP32() {
  if (!('serial' in navigator)) {
    alert('Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    return;
  }

  // If running in demo mode, stop demo mode first
  if (state.isDemoMode) {
    toggleDemoMode();
  }

  try {
    logTerminal('[USB] Requesting serial port selection...', 'sys');
    playBeep(650, 0.08);

    // 1. Request port from user
    state.port = await navigator.serial.requestPort();

    // 2. Open port with 115200 baud
    logTerminal(`[USB] Opening serial port at ${state.baudRate} baud...`, 'sys');
    await state.port.open({ baudRate: state.baudRate });

    state.isConnected = true;
    updateConnectionUI(true, 'CONNECTED');
    dom.termPortName.textContent = 'ESP32 (USB-COM)';
    logTerminal('[USB CONNECTED] Port opened successfully at 115200 baud.', 'rx');
    playBeep(980, 0.15);

    // 3. Read serial stream continuously
    readSerialStream();

  } catch (err) {
    console.error('Serial connection error:', err);
    logTerminal(`[CONNECTION ERROR] ${err.message}`, 'err');
    handleDisconnection();
  }
}

/**
 * Continuously read serial data from the ESP32
 */
async function readSerialStream() {
  const textDecoder = new TextDecoderStream();
  state.readableStreamClosed = state.port.readable.pipeTo(textDecoder.writable);
  state.reader = textDecoder.readable.getReader();

  let lineBuffer = '';

  try {
    while (state.isConnected && state.reader) {
      const { value, done } = await state.reader.read();
      if (done) {
        logTerminal('[STREAM CLOSED] Reader reached end of stream.', 'warn');
        break;
      }

      if (value) {
        lineBuffer += value;
        // Split on newlines to parse complete lines
        const lines = lineBuffer.split(/\r?\n/);
        // Retain uncompleted chunk in buffer
        lineBuffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length > 0) {
            handleSerialLine(trimmed);
          }
        }
      }
    }
  } catch (err) {
    if (state.isConnected) {
      console.error('Serial read error:', err);
      logTerminal(`[SERIAL READ FAULT] ${err.message}`, 'err');
    }
  } finally {
    if (state.reader) {
      try {
        state.reader.releaseLock();
      } catch (e) {}
    }
  }
}

/**
 * Disconnect ESP32
 */
async function disconnectESP32() {
  logTerminal('[USB] Initiating disconnect sequence...', 'warn');
  playBeep(420, 0.1);
  await handleDisconnection();
  logTerminal('[USB DISCONNECTED] Serial port closed and released.', 'sys');
}

/**
 * Cleanup port and reset state
 */
async function handleDisconnection() {
  state.isConnected = false;

  if (state.reader) {
    try {
      await state.reader.cancel();
      state.reader.releaseLock();
    } catch (e) {}
    state.reader = null;
  }

  if (state.readableStreamClosed) {
    try {
      await state.readableStreamClosed.catch(() => {});
    } catch (e) {}
    state.readableStreamClosed = null;
  }

  if (state.port) {
    try {
      await state.port.close();
    } catch (e) {}
    state.port = null;
  }

  updateConnectionUI(false, 'DISCONNECTED');
  dom.termPortName.textContent = 'DISCONNECTED';
  resetSensorDisplays();
}

/**
 * Update Header and Status Badge UI based on connection status
 */
function updateConnectionUI(connected, label) {
  if (connected) {
    dom.btnConnect.classList.add('hidden');
    dom.btnDisconnect.classList.remove('hidden');
    dom.connStatusPill.className = 'connection-pill status-connected';
    dom.connStatusText.textContent = label;
    dom.missionModeIndicator.textContent = 'LIVE TELEMETRY STREAM';
    dom.missionModeIndicator.className = 'r-val highlight-emerald';
    
    // Comm Health
    setHealthStatus(dom.badgeComm, dom.barComm, dom.detailComm, 'NORMAL', 'Active 115200 baud USB serial data stream', 100);
  } else {
    dom.btnConnect.classList.remove('hidden');
    dom.btnDisconnect.classList.add('hidden');
    dom.connStatusPill.className = 'connection-pill status-disconnected';
    dom.connStatusText.textContent = label;
    dom.missionModeIndicator.textContent = 'SYSTEM STANDBY';
    dom.missionModeIndicator.className = 'r-val highlight-cyan';

    // Comm Health
    setHealthStatus(dom.badgeComm, dom.barComm, dom.detailComm, 'NOT CONNECTED', 'Hardware serial stream disconnected', 0);
  }
}

// =====================================================================
// 3. TELEMETRY INGESTION & PARSING
// =====================================================================
/**
 * Ingest and parse incoming serial line from ESP32
 */
function handleSerialLine(line) {
  // Output to terminal
  logTerminal(`RX &gt; ${escapeHtml(line)}`, 'rx');

  // Update counters
  state.packetCount++;
  dom.packetCounter.textContent = state.packetCount;
  const now = new Date();
  state.lastPacketTime = now.toLocaleTimeString();
  dom.lastUpdateTime.textContent = state.lastPacketTime;

  // Audio chirp
  if (state.audioEnabled) {
    playBeep(880, 0.03);
  }

  // Attempt JSON parsing (primary format sent by esp32_code.ino)
  if (line.startsWith('{') && line.endsWith('}')) {
    try {
      const data = JSON.parse(line);
      parseTelemetryData(data);
      return;
    } catch (e) {
      // Continue to regex fallback
    }
  }

  // Fallback: Regex parsing for key-value telemetry lines
  parseRegexTelemetry(line);
}

/**
 * Parse structured JSON data
 */
function parseTelemetryData(data) {
  // 1. DHT11 (Temperature & Humidity)
  if (typeof data.temp !== 'undefined') {
    state.telemetry.temperature = parseFloat(data.temp);
  }
  if (typeof data.hum !== 'undefined') {
    state.telemetry.humidity = parseFloat(data.hum);
  }

  // 2. INA219 (Voltage, Current, Power)
  if (typeof data.volt !== 'undefined') {
    state.telemetry.voltage = parseFloat(data.volt);
  }
  if (typeof data.curr !== 'undefined') {
    state.telemetry.current = parseFloat(data.curr);
  }
  if (typeof data.pwr !== 'undefined') {
    state.telemetry.power = parseFloat(data.pwr);
  }

  // 3. HC-SR04 (Distance)
  if (typeof data.dist !== 'undefined') {
    state.telemetry.distance = parseFloat(data.dist);
  }

  // 4. MPU Status
  if (typeof data.mpu !== 'undefined') {
    state.telemetry.mpuStatus = data.mpu;
  }

  // Update DOM displays
  renderTelemetry();
}

/**
 * Robust Regex Fallback Parser for freeform serial prints
 */
function parseRegexTelemetry(line) {
  let matched = false;

  // Temperature
  const tMatch = line.match(/(?:temp|temperature)\s*[:=]\s*([-\d.]+)/i);
  if (tMatch) {
    state.telemetry.temperature = parseFloat(tMatch[1]);
    matched = true;
  }

  // Humidity
  const hMatch = line.match(/(?:hum|humidity)\s*[:=]\s*([-\d.]+)/i);
  if (hMatch) {
    state.telemetry.humidity = parseFloat(hMatch[1]);
    matched = true;
  }

  // Voltage
  const vMatch = line.match(/(?:volt|voltage|vbus)\s*[:=]\s*([-\d.]+)/i);
  if (vMatch) {
    state.telemetry.voltage = parseFloat(vMatch[1]);
    matched = true;
  }

  // Current
  const cMatch = line.match(/(?:curr|current)\s*[:=]\s*([-\d.]+)/i);
  if (cMatch) {
    state.telemetry.current = parseFloat(cMatch[1]);
    matched = true;
  }

  // Power
  const pMatch = line.match(/(?:pwr|power)\s*[:=]\s*([-\d.]+)/i);
  if (pMatch) {
    state.telemetry.power = parseFloat(pMatch[1]);
    matched = true;
  }

  // Distance
  const dMatch = line.match(/(?:dist|distance|sonar)\s*[:=]\s*([-\d.]+)/i);
  if (dMatch) {
    state.telemetry.distance = parseFloat(dMatch[1]);
    matched = true;
  }

  if (matched) {
    renderTelemetry();
  }
}

// =====================================================================
// 4. TELEMETRY RENDERING & STATUS MATRIX
// =====================================================================
function renderTelemetry() {
  const { temperature, humidity, voltage, current, power, distance } = state.telemetry;

  // -------------------------------------------------------------
  // A. DHT11 SENSOR (Temperature & Humidity)
  // -------------------------------------------------------------
  if (temperature !== null && !isNaN(temperature)) {
    dom.valTemp.textContent = temperature.toFixed(1);
    const fahrenheit = (temperature * 9 / 5 + 32).toFixed(1);
    dom.tempFEquiv.textContent = `${fahrenheit} °F`;

    // Percentage gauge (scale: 0 to 50 °C)
    const tempPct = Math.min(Math.max((temperature / 50) * 100, 0), 100);
    dom.gaugeTemp.style.width = `${tempPct}%`;

    // Health & Status evaluation
    if (temperature >= 18 && temperature <= 28) {
      dom.stateTemp.textContent = 'OPTIMAL';
      dom.stateTemp.className = 'text-bright highlight-emerald';
      setHealthStatus(dom.badgeTemp, dom.barTemp, dom.detailTemp, 'NORMAL', `Cabin temperature nominal at ${temperature.toFixed(1)} °C`, 100);
    } else if ((temperature >= 10 && temperature < 18) || (temperature > 28 && temperature <= 38)) {
      dom.stateTemp.textContent = 'THERMAL DRIFT';
      dom.stateTemp.className = 'text-bright highlight-gold';
      setHealthStatus(dom.badgeTemp, dom.barTemp, dom.detailTemp, 'WARNING', `Thermal deviation detected (${temperature.toFixed(1)} °C)`, 60);
    } else {
      dom.stateTemp.textContent = 'CRITICAL THERMAL';
      dom.stateTemp.className = 'text-bright highlight-crimson';
      setHealthStatus(dom.badgeTemp, dom.barTemp, dom.detailTemp, 'CRITICAL', `Cabin temperature out of bounds (${temperature.toFixed(1)} °C)`, 30);
    }

    pushHistory(state.history.temp, temperature);
  }

  if (humidity !== null && !isNaN(humidity)) {
    dom.valHum.textContent = humidity.toFixed(1);
    dom.gaugeHum.style.width = `${Math.min(Math.max(humidity, 0), 100)}%`;

    // Calculate approximate dewpoint: T - ((100 - RH) / 5)
    if (temperature !== null) {
      const dew = (temperature - ((100 - humidity) / 5)).toFixed(1);
      dom.dewpointCalc.textContent = `Dew: ${dew} °C`;
    }

    if (humidity >= 30 && humidity <= 65) {
      dom.stateHum.textContent = 'NOMINAL';
    } else if (humidity < 30) {
      dom.stateHum.textContent = 'LOW MOISTURE';
    } else {
      dom.stateHum.textContent = 'HIGH MOISTURE';
    }

    pushHistory(state.history.hum, humidity);
  }

  // -------------------------------------------------------------
  // B. INA219 SENSOR (DC Voltage, Current, Power)
  // -------------------------------------------------------------
  if (voltage !== null && !isNaN(voltage)) {
    dom.valVolt.textContent = voltage.toFixed(2);
    // Gauge percentage (0 - 6V scale)
    const voltPct = Math.min(Math.max((voltage / 5.5) * 100, 0), 100);
    dom.gaugeVolt.style.width = `${voltPct}%`;

    if (voltage >= 3.0 && voltage <= 5.25) {
      dom.stateVolt.textContent = 'ONLINE';
    } else if (voltage > 0.5) {
      dom.stateVolt.textContent = 'UNDERVOLTAGE';
    } else {
      dom.stateVolt.textContent = 'BUS LOW';
    }

    pushHistory(state.history.voltage, voltage);
  }

  if (current !== null && !isNaN(current)) {
    dom.valCurr.textContent = current.toFixed(1);
    // Gauge percentage (0 - 500mA scale)
    const currPct = Math.min(Math.max((current / 500) * 100, 0), 100);
    dom.gaugeCurr.style.width = `${currPct}%`;
    dom.stateCurr.textContent = current > 450 ? 'PEAK LOAD' : 'NOMINAL';
  }

  if (power !== null && !isNaN(power)) {
    dom.valPwr.textContent = power.toFixed(1);
    // Gauge percentage (0 - 2500mW scale)
    const pwrPct = Math.min(Math.max((power / 2500) * 100, 0), 100);
    dom.gaugePwr.style.width = `${pwrPct}%`;

    const watts = (power / 1000).toFixed(2);
    dom.statePwr.textContent = `${watts} W`;

    // Power Subsystem Health Evaluation
    if (voltage !== null && voltage >= 3.0 && voltage <= 5.25 && current < 480) {
      setHealthStatus(dom.badgePower, dom.barPower, dom.detailPower, 'NORMAL', `DC power bus stable at ${voltage.toFixed(2)}V (${power.toFixed(0)} mW)`, 100);
    } else if (voltage !== null && (voltage < 3.0 || current >= 480)) {
      setHealthStatus(dom.badgePower, dom.barPower, dom.detailPower, 'WARNING', `Power bus strain: ${voltage.toFixed(2)}V, load ${current.toFixed(0)}mA`, 50);
    }

    pushHistory(state.history.power, power);
  }

  // -------------------------------------------------------------
  // C. HC-SR04 ULTRASONIC SENSOR (Distance & Proximity)
  // -------------------------------------------------------------
  if (distance !== null && !isNaN(distance)) {
    if (distance < 0) {
      dom.valDist.textContent = 'OUT';
      dom.valDistStatus.textContent = 'ECHO TIMEOUT / NO TARGET';
      dom.distInchEquiv.textContent = '-- in';
      dom.boxSonarStatus.className = 'proximity-status-box';
      setHealthStatus(dom.badgeSonar, dom.barSonar, dom.detailSonar, 'NORMAL', 'No targets within 400cm sonar radar sweep', 90);
    } else {
      dom.valDist.textContent = distance.toFixed(1);
      const inches = (distance * 0.393701).toFixed(1);
      dom.distInchEquiv.textContent = `${inches} in`;

      // Gauge percentage (0 - 200cm range)
      const distPct = Math.min(Math.max((distance / 200) * 100, 0), 100);
      dom.gaugeDist.style.width = `${distPct}%`;

      // Radar Blip position calculation
      const blipX = Math.min(Math.max(50 + (Math.sin(Date.now() / 800) * (distance / 4)), 15), 85);
      const blipY = Math.min(Math.max(50 + (Math.cos(Date.now() / 800) * (distance / 4)), 15), 85);
      dom.radarTargetBlip.style.left = `${blipX}%`;
      dom.radarTargetBlip.style.top = `${blipY}%`;

      // Proximity range status assessment
      if (distance > 100) {
        dom.valDistStatus.textContent = 'DOCKING PATH CLEAR';
        dom.boxSonarStatus.className = 'proximity-status-box';
        setHealthStatus(dom.badgeSonar, dom.barSonar, dom.detailSonar, 'NORMAL', `Clear approach corridor (${distance.toFixed(1)} cm)`, 100);
      } else if (distance > 35) {
        dom.valDistStatus.textContent = 'APPROACH VECTOR ACTIVE';
        dom.boxSonarStatus.className = 'proximity-status-box';
        setHealthStatus(dom.badgeSonar, dom.barSonar, dom.detailSonar, 'NORMAL', `Target proximity acquired at ${distance.toFixed(1)} cm`, 85);
      } else if (distance > 15) {
        dom.valDistStatus.textContent = 'PROXIMITY WARNING - DECELERATE';
        dom.boxSonarStatus.className = 'proximity-status-box proximity-warning';
        setHealthStatus(dom.badgeSonar, dom.barSonar, dom.detailSonar, 'WARNING', `Close proximity warning: ${distance.toFixed(1)} cm`, 45);
      } else {
        dom.valDistStatus.textContent = 'CRITICAL PROXIMITY - BRAKE ENGAGED';
        dom.boxSonarStatus.className = 'proximity-status-box proximity-critical';
        setHealthStatus(dom.badgeSonar, dom.barSonar, dom.detailSonar, 'CRITICAL', `Collision hazard proximity: ${distance.toFixed(1)} cm!`, 20);
      }
    }
  }

  // Draw updated rolling waveforms
  drawWaveformCharts();
}

/**
 * Reset displays when disconnected
 */
function resetSensorDisplays() {
  dom.valTemp.textContent = '--.-';
  dom.valHum.textContent = '--.-';
  dom.valVolt.textContent = '-.--';
  dom.valCurr.textContent = '---.-';
  dom.valPwr.textContent = '----.-';
  dom.valDist.textContent = '---.-';
  dom.valDistStatus.textContent = 'AWAITING SONAR ECHO';
  dom.gaugeTemp.style.width = '0%';
  dom.gaugeHum.style.width = '0%';
  dom.gaugeVolt.style.width = '0%';
  dom.gaugeCurr.style.width = '0%';
  dom.gaugePwr.style.width = '0%';
  dom.gaugeDist.style.width = '0%';

  dom.stateTemp.textContent = 'STANDBY';
  dom.stateHum.textContent = 'STANDBY';
  dom.stateVolt.textContent = 'OFFLINE';
  dom.stateCurr.textContent = 'OFFLINE';
  dom.statePwr.textContent = '0.00 W';

  setHealthStatus(dom.badgeTemp, dom.barTemp, dom.detailTemp, 'NOT CONNECTED', 'Awaiting live telemetry from thermal sensor probe', 0);
  setHealthStatus(dom.badgePower, dom.barPower, dom.detailPower, 'NOT CONNECTED', 'Electrical bus voltage and load monitoring idle', 0);
  setHealthStatus(dom.badgeSonar, dom.barSonar, dom.detailSonar, 'NOT CONNECTED', 'Docking radar and obstacle telemetry standby', 0);

  // MPU remains in simulated fault notice state
  setHealthStatus(dom.badgeMpu, dom.barMpu, dom.detailMpu, 'WARNING', 'Hardware fault detected on I2C bus; synthetic gyro vector active', 75);
}

/**
 * Health Status Matrix Setter
 * Valid statuses: NORMAL (Green), WARNING (Yellow), CRITICAL (Red), NOT CONNECTED (Grey)
 */
function setHealthStatus(badgeEl, barEl, detailEl, status, detailMsg, barPct) {
  if (!badgeEl) return;

  badgeEl.className = 'health-badge';
  barEl.className = 'health-bar-fill';

  switch (status) {
    case 'NORMAL':
      badgeEl.classList.add('badge-green');
      badgeEl.textContent = 'NORMAL';
      barEl.style.backgroundColor = 'var(--accent-emerald)';
      break;
    case 'WARNING':
      badgeEl.classList.add('badge-yellow');
      badgeEl.textContent = 'WARNING';
      barEl.classList.add('warning-fill');
      break;
    case 'CRITICAL':
      badgeEl.classList.add('badge-red');
      badgeEl.textContent = 'CRITICAL';
      barEl.classList.add('critical-fill');
      break;
    case 'NOT CONNECTED':
    default:
      badgeEl.classList.add('badge-grey');
      badgeEl.textContent = 'NOT CONNECTED';
      barEl.classList.add('grey-fill');
      break;
  }

  if (detailEl && detailMsg) {
    detailEl.textContent = detailMsg;
  }
  if (barEl && typeof barPct === 'number') {
    barEl.style.width = `${barPct}%`;
  }
}

// =====================================================================
// 5. SIMULATED SENSORS: MPU6050 (I2C Fault) & CABIN PRESSURE
// =====================================================================
/**
 * Drives realistic microgravity attitude oscillations and barometric cabin updates
 */
function startSimulationLoops() {
  setInterval(() => {
    const t = Date.now() / 1000;

    // Simulate gentle spacecraft microgravity attitude oscillation
    const accX = (0.02 + Math.sin(t * 0.7) * 0.05).toFixed(2);
    const accY = (-0.01 + Math.cos(t * 0.9) * 0.04).toFixed(2);
    const accZ = (0.98 + Math.sin(t * 0.4) * 0.02).toFixed(2);

    const gyroX = (-0.15 + Math.sin(t * 1.1) * 0.35).toFixed(2);
    const gyroY = (0.22 + Math.cos(t * 0.8) * 0.4).toFixed(2);
    const gyroZ = (0.04 + Math.sin(t * 0.5) * 0.15).toFixed(2);

    // Update Simulated IMU DOM
    dom.valAccX.textContent = `${accX >= 0 ? '+' : ''}${accX} g`;
    dom.valAccY.textContent = `${accY >= 0 ? '+' : ''}${accY} g`;
    dom.valAccZ.textContent = `${accZ >= 0 ? '+' : ''}${accZ} g`;

    dom.barAccX.style.width = `${Math.min(Math.max(50 + accX * 50, 0), 100)}%`;
    dom.barAccY.style.width = `${Math.min(Math.max(50 + accY * 50, 0), 100)}%`;
    dom.barAccZ.style.width = `${Math.min(Math.max(accZ * 80, 0), 100)}%`;

    dom.valGyroX.textContent = `${gyroX >= 0 ? '+' : ''}${gyroX} °/s`;
    dom.valGyroY.textContent = `${gyroY >= 0 ? '+' : ''}${gyroY} °/s`;
    dom.valGyroZ.textContent = `${gyroZ >= 0 ? '+' : ''}${gyroZ} °/s`;

    dom.barGyroX.style.width = `${Math.min(Math.max(50 + gyroX * 40, 0), 100)}%`;
    dom.barGyroY.style.width = `${Math.min(Math.max(50 + gyroY * 40, 0), 100)}%`;
    dom.barGyroZ.style.width = `${Math.min(Math.max(50 + gyroZ * 40, 0), 100)}%`;

    // Pitch & Roll Horizon Gimbal visualization
    const pitchPx = gyroY * 8;
    const rollDeg = gyroX * 12;
    if (dom.gimbalHorizon) {
      dom.gimbalHorizon.style.transform = `rotate(${rollDeg}deg) translateY(${pitchPx}px)`;
    }

    // Simulated Cabin Pressure slight fluctuations (101.32 +/- 0.04 kPa)
    const pressureKPa = (101.32 + Math.sin(t * 0.3) * 0.04).toFixed(2);
    const pressureHPa = (pressureKPa * 10).toFixed(1);
    dom.valPress.textContent = pressureKPa;
    dom.valPressHPa.textContent = `${pressureHPa} hPa`;
  }, 100);
}

// =====================================================================
// 6. DEMO / SIMULATION MODE (FOR TESTING WITHOUT PHYSICAL HARDWARE)
// =====================================================================
function toggleDemoMode() {
  if (state.isConnected) {
    alert('Please disconnect the live ESP32 USB port before enabling Demo Mode.');
    return;
  }

  state.isDemoMode = !state.isDemoMode;

  if (state.isDemoMode) {
    dom.btnDemoToggle.classList.add('active');
    dom.connStatusPill.className = 'connection-pill status-demo';
    dom.connStatusText.textContent = 'SIMULATOR ACTIVE';
    dom.missionModeIndicator.textContent = 'SYNTHETIC ORBIT DEMO';
    dom.missionModeIndicator.className = 'r-val highlight-gold';
    dom.termPortName.textContent = 'SIMULATOR (VIRTUAL)';
    logTerminal('[SIMULATOR] Synthetic telemetry engine started. Generating realistic sensor packets.', 'sim');
    playBeep(700, 0.1);

    // Ingest simulated sensor packets every 1000ms
    let demoStep = 0;
    state.demoTimer = setInterval(() => {
      demoStep++;
      const simulatedTemp = (24.2 + Math.sin(demoStep * 0.15) * 3.5).toFixed(1);
      const simulatedHum = (52.0 + Math.cos(demoStep * 0.1) * 8.0).toFixed(1);
      const simulatedVolt = (3.31 + Math.sin(demoStep * 0.2) * 0.08).toFixed(2);
      const simulatedCurr = (118.0 + Math.sin(demoStep * 0.3) * 22.0).toFixed(1);
      const simulatedPwr = (simulatedVolt * simulatedCurr).toFixed(1);
      const simulatedDist = (45.0 + Math.sin(demoStep * 0.25) * 30.0).toFixed(1);

      const packet = JSON.stringify({
        temp: parseFloat(simulatedTemp),
        hum: parseFloat(simulatedHum),
        volt: parseFloat(simulatedVolt),
        curr: parseFloat(simulatedCurr),
        pwr: parseFloat(simulatedPwr),
        dist: parseFloat(simulatedDist),
        mpu: "I2C_FAULT"
      });

      handleSerialLine(packet);
    }, 1000);

  } else {
    clearInterval(state.demoTimer);
    state.demoTimer = null;
    dom.btnDemoToggle.classList.remove('active');
    dom.connStatusPill.className = 'connection-pill status-disconnected';
    dom.connStatusText.textContent = 'DISCONNECTED';
    dom.missionModeIndicator.textContent = 'SYSTEM STANDBY';
    dom.missionModeIndicator.className = 'r-val highlight-cyan';
    dom.termPortName.textContent = 'DISCONNECTED';
    resetSensorDisplays();
    logTerminal('[SIMULATOR] Synthetic telemetry stopped.', 'info');
  }
}

// =====================================================================
// 7. REAL-TIME WAVEFORM CHARTS (HTML5 Canvas Sparklines)
// =====================================================================
function initChartBuffers() {
  const maxSamples = 50;
  for (let i = 0; i < maxSamples; i++) {
    state.history.temp.push(24);
    state.history.hum.push(50);
    state.history.voltage.push(3.3);
    state.history.power.push(390);
  }
  drawWaveformCharts();
}

function pushHistory(array, val) {
  array.push(val);
  if (array.length > 50) {
    array.shift();
  }
}

/**
 * Draw neon aesthetic waveforms without external libraries
 */
function drawWaveformCharts() {
  // Chart 1: DHT11 (Temp & Humidity)
  drawSparkline(dom.chartDht, [
    { data: state.history.temp, color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.4)', min: 10, max: 40, label: 'Temp' },
    { data: state.history.hum, color: '#818cf8', glow: 'rgba(129, 140, 248, 0.4)', min: 20, max: 90, label: 'Humidity' }
  ]);

  // Chart 2: INA219 (Voltage & Power)
  drawSparkline(dom.chartPower, [
    { data: state.history.voltage, color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', min: 0, max: 6, label: 'Volt' },
    { data: state.history.power, color: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)', min: 0, max: 1500, label: 'Power' }
  ]);
}

function drawSparkline(canvas, seriesList) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Clear background
  ctx.clearRect(0, 0, w, h);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 15; y < h; y += 20) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // Draw each series
  seriesList.forEach(series => {
    const { data, color, glow, min, max } = series;
    if (!data || data.length < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    ctx.beginPath();
    const step = w / (data.length - 1);
    const range = max - min || 1;

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      const normalized = Math.min(Math.max((val - min) / range, 0), 1);
      const x = i * step;
      const y = h - (normalized * (h - 16) + 8);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  });
}

// =====================================================================
// 8. ANIMATED STARFIELD & DEEP SPACE BACKGROUND
// =====================================================================
function initStarfield() {
  const canvas = dom.spaceCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // Generate multi-depth star particles
  const starCount = 140;
  const stars = [];

  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.8 + 0.4,
      speed: Math.random() * 0.25 + 0.05,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      opacity: Math.random() * 0.8 + 0.2,
      color: Math.random() > 0.3 ? '#e0f2fe' : (Math.random() > 0.5 ? '#7dd3fc' : '#c084fc')
    });
  }

  // Shooting star state
  let meteor = null;
  function spawnMeteor() {
    meteor = {
      x: Math.random() * width,
      y: Math.random() * (height * 0.4),
      length: Math.random() * 90 + 40,
      speedX: -(Math.random() * 10 + 8),
      speedY: Math.random() * 6 + 4,
      life: 1.0,
      decay: Math.random() * 0.02 + 0.015
    };
  }

  // Periodic meteors
  setInterval(() => {
    if (!meteor && Math.random() > 0.4) {
      spawnMeteor();
    }
  }, 4000);

  function renderStars() {
    ctx.clearRect(0, 0, width, height);

    // Draw twinkling stars
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.y -= s.speed;
      if (s.y < 0) s.y = height;

      s.opacity += Math.sin(Date.now() * s.twinkleSpeed) * 0.015;
      const alpha = Math.min(Math.max(s.opacity, 0.15), 0.95);

      ctx.fillStyle = s.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    // Draw shooting star meteor if active
    if (meteor) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = meteor.life;

      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(meteor.x - meteor.length * (meteor.speedX / 12), meteor.y - meteor.length * (meteor.speedY / 12));
      ctx.stroke();
      ctx.restore();

      meteor.x += meteor.speedX;
      meteor.y += meteor.speedY;
      meteor.life -= meteor.decay;

      if (meteor.life <= 0 || meteor.x < 0 || meteor.y > height) {
        meteor = null;
      }
    }

    ctx.globalAlpha = 1.0;
    requestAnimationFrame(renderStars);
  }

  requestAnimationFrame(renderStars);
}

// =====================================================================
// 9. MISSION CLOCK (MET)
// =====================================================================
function initMissionClock() {
  setInterval(() => {
    const elapsed = Date.now() - state.missionStartTime;
    const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
    const hours = Math.floor((elapsed / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
    const seconds = Math.floor((elapsed / 1000) % 60);

    const pad = (n) => String(n).padStart(2, '0');
    dom.metClock.textContent = `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }, 1000);
}

// =====================================================================
// 10. TERMINAL & UTILITY FUNCTIONS
// =====================================================================
function logTerminal(message, type = 'rx') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const time = new Date().toLocaleTimeString();
  line.innerHTML = `<span style="opacity:0.5;">[${time}]</span> ${message}`;

  dom.terminalBody.appendChild(line);

  // Maintain max 150 lines
  if (dom.terminalBody.childElementCount > 150) {
    dom.terminalBody.removeChild(dom.terminalBody.firstChild);
  }

  // Auto-scroll to bottom if checked
  if (dom.chkAutoscroll.checked) {
    dom.terminalBody.scrollTop = dom.terminalBody.scrollHeight;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// =====================================================================
// 11. WEB AUDIO SYNTH TELEMETRY CHIRP
// =====================================================================
function toggleAudio() {
  state.audioEnabled = !state.audioEnabled;

  if (state.audioEnabled) {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
    dom.btnAudioToggle.classList.add('active');
    dom.audioIcon.textContent = '🔊';
    dom.audioStateText.textContent = 'ON';
    playBeep(880, 0.08);
  } else {
    dom.btnAudioToggle.classList.remove('active');
    dom.audioIcon.textContent = '🔇';
    dom.audioStateText.textContent = 'OFF';
  }
}

function playBeep(freq = 880, duration = 0.05) {
  if (!state.audioEnabled || !state.audioCtx) return;

  try {
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, state.audioCtx.currentTime);

    gain.gain.setValueAtTime(0.04, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(state.audioCtx.destination);

    osc.start();
    osc.stop(state.audioCtx.currentTime + duration);
  } catch (e) {}
}

