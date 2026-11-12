# ORVYXA | Autonomous Spacecraft Monitoring Dashboard
**Mission Control & Telemetry System**

---

## 1. Project Introduction

**ORVYXA** is an autonomous spacecraft telemetry and health monitoring dashboard designed with a futuristic NASA / deep-space mission control aesthetic. It establishes a direct, high-speed hardware-in-the-loop downlink with an onboard **ESP32 microcontroller** through a physical USB connection using the modern **Web Serial API**.

The mission dashboard visualizes real-time environmental cabin metrics, high-side power distribution, and ultrasonic docking proximity. In alignment with aerospace flight protocols, sensors experiencing hardware degradation (such as the MPU6050 I2C bus) and non-equipped telemetry channels (barometric cabin pressure) are explicitly segregated and designated with high-visibility **SIMULATED DATA** indicators.

### Architecture Highlights:
- **Zero Cloud / Zero External API Dependency**: Runs 100% locally on your computer with complete data privacy and sub-millisecond response latency.
- **Physical USB Serial Link**: Communicates directly through browser Web Serial API over COM port at **115200 Baud**.
- **Pure Native Frontend**: Built strictly with standard HTML5, CSS3, and modern vanilla JavaScript (no React, Node.js, Python server, or database needed).
- **Aerospace UI / UX**: Deep-space starry canvas, realistic cratered lunar body, SVG spacecraft vector with solar arrays, glassmorphism telemetry HUD, and synthetic attitude horizon director.

---

## 2. Hardware Components

| Component | Function / Subsystem | Interface | Operating Voltage |
| :--- | :--- | :--- | :--- |
| **ESP32 Dev Module / NodeMCU-32S** | Central Flight Computer & USB Serial Gateway | USB (UART Bridge) | 5V via USB / 3.3V Logic |
| **DHT11 Sensor** | Cabin Temperature & Relative Humidity | 1-Wire Digital (GPIO 4) | 3.3V – 5V |
| **INA219 High-Side Sensor** | Electrical Power System (EPS): Voltage, Current & Power | I2C (Address: `0x40`) | 3.3V – 5V |
| **HC-SR04 Ultrasonic Sensor** | Autonomous Proximity & Docking Radar | Digital Pulse (TRIG / ECHO) | 5V VCC (3.3V Echo) |
| **MPU6050 6-Axis IMU** | Inertial Guidance (*Hardware Fault / Simulated*) | I2C (Address: `0x68`) | 3.3V |
| **USB Data Cable** | Micro-USB or USB-C (High-speed data sync cable) | USB-A / USB-C to PC | 5V Power + Data Bus |

---

## 3. ESP32 Pin Connections & Wiring Diagram

Connect the sensor modules to your ESP32 board according to the pinout table below:

```
                  +-----------------------------------+
                  |           ESP32 DevKit            |
                  |                                   |
   DHT11 DATA --->| GPIO 4                            |
                  |                                   |
   INA219 SDA --->| GPIO 21 (I2C SDA)                 |
   INA219 SCL --->| GPIO 22 (I2C SCL)                 |
                  |                                   |
  HC-SR04 TRIG -->| GPIO 5                            |
  HC-SR04 ECHO -->| GPIO 18                           |
                  |                                   |
  *MPU6050 SDA -->| GPIO 21 (Shared I2C SDA)          |
  *MPU6050 SCL -->| GPIO 22 (Shared I2C SCL)          |
                  |                                   |
           GND ---| GND                               |
          3.3V ---| 3V3                               |
            5V ---| VIN / 5V                          |
                  +-----------------------------------+
```

### Detailed Wiring Table:

| Sensor Module | Sensor Pin | ESP32 Board Pin | Notes |
| :--- | :--- | :--- | :--- |
| **DHT11** | VCC | `3V3` or `VIN` | Connect to 3.3V or 5V |
| | DATA | `GPIO 4` | Digital I/O |
| | GND | `GND` | Common Ground |
| **INA219** | VCC | `3V3` | 3.3V Logic Safe |
| | GND | `GND` | Common Ground |
| | SDA | `GPIO 21` | ESP32 Hardware I2C SDA |
| | SCL | `GPIO 22` | ESP32 Hardware I2C SCL |
| | VIN+ / VIN- | Load in series | Measure DC voltage across load |
| **HC-SR04** | VCC | `VIN` (5V) | Ultrasonic transducer requires 5V |
| | TRIG | `GPIO 5` | Trigger Pulse Output |
| | ECHO | `GPIO 18` | Echo Pulse Input (3.3V safe) |
| | GND | `GND` | Common Ground |
| **MPU6050** | VCC | `3V3` | 3.3V Power |
| | GND | `GND` | Common Ground |
| | SDA / SCL | `GPIO 21` / `GPIO 22` | *Reported as I2C Fault; Simulated on Dashboard* |

> [!NOTE]
> The physical MPU6050 sensor currently experiences an I2C communication hardware fault. The ESP32 sketch cleanly detects I2C state and flags `"mpu":"I2C_FAULT"`. The ORVYXA dashboard seamlessly runs high-fidelity synthetic attitude guidance vectors while explicitly displaying **[SIMULATED DATA]** badges.

---

## 4. Arduino Library Installation

Before compiling `esp32_code.ino`, install the following official libraries via the **Arduino IDE Library Manager** (`Ctrl + Shift + I` or `Sketch -> Include Library -> Manage Libraries`):

1. **DHT sensor library** (by *Adafruit*)
   - *Dependency*: Install **Adafruit Unified Sensor** if prompted.
2. **Adafruit INA219** (by *Adafruit*)
3. **Wire** (Built-in with ESP32 board package)

---

## 5. ESP32 Code Upload Instructions

1. Connect your ESP32 board to your computer using a reliable USB data cable.
2. Launch the **Arduino IDE** (v1.8.x or v2.x).
3. Open `esp32_code.ino` from this folder:
   ```
   d:\Project Works\ORVYXA(sanjay aids)\esp32_code.ino
   ```
4. Select your board under **Tools -> Board -> ESP32 Arduino -> ESP32 Dev Module** (or your specific board model).
5. Select the corresponding COM Port under **Tools -> Port** (e.g., `COM3`, `COM4`, etc.).
6. Click the **Upload** arrow button (or press `Ctrl + U`).
7. Wait for compilation and flashing to display `Done uploading`.
8. *Important*: **Close the Arduino Serial Monitor** before connecting to the web dashboard. A serial COM port can only be held open by one application at a time.

---

## 6. Website Execution Instructions

The Web Serial API requires the web application to be hosted over **localhost** or a secure **HTTPS** origin (or accessed via supported modern browsers with Web Serial enabled).

### Option A: VS Code Live Server (Recommended)
1. Open this project directory in **Visual Studio Code**.
2. Right-click on `index.html` and select **"Open with Live Server"**.
3. Your browser will automatically launch at `http://127.0.0.1:5500/index.html`.

### Option B: Built-in Python Local Server
Run a single command in your terminal inside this directory:
```bash
# Python 3
python -m http.server 8000
```
Then navigate to:
```
http://localhost:8000
```

### Option C: Direct File Opening
In modern Google Chrome or Microsoft Edge, opening `index.html` directly may prompt permission for Web Serial. However, running through a local server (`localhost`) ensures unrestricted Web Serial access.

---

## 7. USB Connection Instructions

1. Open the dashboard in **Google Chrome** or **Microsoft Edge**.
2. Click the prominent glowing **"CONNECT ESP32"** button in the header.
3. The browser will open a native serial port selection popup listing detected USB devices (e.g., *CP2102 USB to UART Bridge Controller*, *CH340*, or *USB Serial Port*).
4. Select your ESP32 COM port and click **"Connect"**.
5. The connection status indicator will transition to **CONNECTED (115200 BAUD)** with a green glowing pulse.
6. Sensor telemetry will begin streaming immediately:
   - **DHT11**: Temperature (°C, °F) and Humidity (%) with dewpoint calculation.
   - **INA219**: Bus Voltage (V), Draw Current (mA), and Power (mW, W).
   - **HC-SR04**: Proximity Distance (cm, in) and real-time radar sweep tracking.
   - **Live Terminal**: The raw incoming serial packet log shows every transmission in real time.
7. To end communication, click **"DISCONNECT"**.

> [!TIP]
> **No ESP32 connected right now?** Click the **"SIMULATOR MODE"** button in the header. It will generate authentic synthetic orbital telemetry streams so you can inspect and demonstrate all gauges, radar sweeps, attitude horizon gimbals, health matrices, and neon waveforms immediately.

---

## 8. Spacecraft Health Matrix Status Logic

| System | Nominal Range | Warning Range | Critical Range |
| :--- | :--- | :--- | :--- |
| **Thermal Subsystem (DHT11)** | 18.0 °C – 28.0 °C (`NORMAL`) | 10.0–18.0 °C or 28.0–38.0 °C (`WARNING`) | < 10.0 °C or > 38.0 °C (`CRITICAL`) |
| **Power Bus (INA219)** | 3.00 V – 5.25 V & Load < 450 mA (`NORMAL`) | 2.50–3.00 V or Load > 450 mA (`WARNING`) | < 2.50 V or Load > 500 mA (`CRITICAL`) |
| **Proximity Radar (HC-SR04)** | > 35.0 cm (`NORMAL`) | 15.0 cm – 35.0 cm (`WARNING`) | ≤ 15.0 cm (`CRITICAL`) |
| **Telemetry Link (Serial)** | Active Serial Data Stream (`NORMAL`) | Intermittent / Delays (`WARNING`) | Port Closed / Disconnected (`NOT CONNECTED`) |
| **IMU Guidance (MPU6050)** | Physical I2C Detected (`NORMAL`) | Hardware Fault detected (`WARNING / SIMULATED`) | Sensor Bus Total Failure (`CRITICAL`) |

---

## 9. Troubleshooting & FAQ

#### 1. "No compatible devices found" in serial popup
- Ensure your USB cable is a **data sync cable**, not a charge-only cable.
- Ensure the USB-to-UART driver for your ESP32 is installed:
  - **CP210x Driver**: Silicon Labs CP2102 USB to UART bridge driver.
  - **CH340/CH341 Driver**: WCH CH340 USB driver.
- Confirm your ESP32 is visible in Windows Device Manager under `Ports (COM & LPT)`.

#### 2. "Failed to open serial port" / Access Denied
- Ensure the **Arduino IDE Serial Monitor** or any other serial terminal (PuTTY, TeraTerm) is **closed**. Only one program can access a COM port at a time.

#### 3. Browser warning: "Web Serial API not detected"
- Web Serial API is natively supported in Chromium-based browsers: **Google Chrome**, **Microsoft Edge**, **Opera**, and **Brave**.
- Firefox and Safari do not natively support Web Serial API yet. Please use Chrome or Edge.

#### 4. DHT11 shows `--.-` or 0.0
- Check that the signal wire is connected to `GPIO 4`.
- Ensure DHT11 has adequate 3.3V or 5V power and solid ground.

#### 5. INA219 displays 0.00 V / 0.0 mA
- Check that SDA is wired to `GPIO 21` and SCL is wired to `GPIO 22`.
- Verify the I2C address on your INA219 breakout board (default is `0x40`).

---

## 10. Project File Structure

```
ORVYXA/
│
├── index.html         # Futuristic Mission Control Dashboard UI
├── style.css          # Aerospace Glassmorphism & Neon Visual Styling
├── script.js          # Web Serial API USB Communication & Telemetry Engine
├── esp32_code.ino     # Complete C++ Arduino Sketch for ESP32 Sensor Ingestion
└── README.md          # Comprehensive Hardware, Setup, and Execution Guide
```

---

*ORVYXA Autonomous Spacecraft Monitoring System*

