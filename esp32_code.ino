/*
 * =====================================================================
 * PROJECT: ORVYXA
 * AUTONOMOUS SPACECRAFT MONITORING SYSTEM
 * File: esp32_code.ino
 * Target Board: ESP32 Dev Module / NodeMCU-32S
 * Baud Rate: 115200 bps
 * Communication: USB Serial (Web Serial API)
 * =====================================================================
 * SENSOR HARDWARE CONNECTIONS:
 * 1. DHT11 (Temperature & Humidity)
 *    - VCC  -> 3.3V / 5V
 *    - GND  -> GND
 *    - DATA -> GPIO 4
 *
 * 2. INA219 (Voltage, Current & Power)
 *    - VCC  -> 3.3V / 5V
 *    - GND  -> GND
 *    - SDA  -> GPIO 21 (Default ESP32 I2C SDA)
 *    - SCL  -> GPIO 22 (Default ESP32 I2C SCL)
 *
 * 3. HC-SR04 (Ultrasonic Distance Sensor)
 *    - VCC  -> 5V
 *    - GND  -> GND
 *    - TRIG -> GPIO 5
 *    - ECHO -> GPIO 18 (Use voltage divider or 3.3V safe pin)
 *
 * 4. MPU6050 (6-Axis IMU: Accelerometer & Gyroscope)
 *    - VCC  -> 3.3V
 *    - GND  -> GND
 *    - SDA  -> GPIO 21 (Shared I2C Bus)
 *    - SCL  -> GPIO 22 (Shared I2C Bus)
 *    * NOTE: Currently has hardware I2C issue on physical setup.
 *      The sketch gracefully detects I2C status and reports fault.
 * =====================================================================
 */

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <Adafruit_INA219.h>

// --- PIN DEFINITIONS ---
#define DHTPIN 4
#define DHTTYPE DHT11

#define TRIG_PIN 5
#define ECHO_PIN 18

#define I2C_SDA 21
#define I2C_SCL 22

// --- SENSOR OBJECTS ---
DHT dht(DHTPIN, DHTTYPE);
Adafruit_INA219 ina219;

// --- STATUS FLAGS ---
bool ina219_connected = false;
bool mpu6050_connected = false;

// --- TIMING VARIABLES ---
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 1000; // Send telemetry every 1000ms

// --- FUNCTION PROTOTYPES ---
void initSensors();
bool checkI2CDevice(byte address);
float measureDistance();

void setup() {
  // Initialize USB Serial communication at 115200 baud
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==================================================");
  Serial.println("      ORVYXA SPACECRAFT TELEMETRY INITIALIZING     ");
  Serial.println("   USB SERIAL PROTOCOL: 115200 BAUD               ");
  Serial.println("==================================================");

  // Initialize I2C Bus
  Wire.begin(I2C_SDA, I2C_SCL);

  // Initialize Sensors
  initSensors();

  Serial.println("[SYSTEM] Initialization Complete. Streaming Telemetry...");
  Serial.println("--------------------------------------------------");
}

void loop() {
  unsigned long currentMillis = millis();

  // Send telemetry stream at regular intervals
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = currentMillis;

    // 1. Read DHT11
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      temperature = 0.0;
      humidity = 0.0;
    }

    // 2. Read INA219 (Voltage, Current, Power)
    float busVoltage_V = 0.0;
    float current_mA = 0.0;
    float power_mW = 0.0;

    if (ina219_connected) {
      busVoltage_V = ina219.getBusVoltage_V();
      current_mA = ina219.getCurrent_mA();
      power_mW = ina219.getPower_mW();
      
      // Filter out slight noise / negative values if disconnected
      if (busVoltage_V < 0.0) busVoltage_V = 0.0;
      if (current_mA < 0.0) current_mA = 0.0;
      if (power_mW < 0.0) power_mW = 0.0;
    }

    // 3. Read HC-SR04 Ultrasonic Distance
    float distance_cm = measureDistance();

    // 4. MPU6050 Status check (Hardware I2C Fault handling)
    // Physical sensor has I2C issue; web dashboard handles simulation fallback
    const char* mpuStatus = mpu6050_connected ? "OK" : "I2C_FAULT";

    // -------------------------------------------------------------
    // SERIAL TELEMETRY TRANSMISSION (JSON FORMAT FOR WEB SERIAL API)
    // -------------------------------------------------------------
    // Example: {"temp":26.4,"hum":52.0,"volt":3.32,"curr":118.5,"pwr":393.4,"dist":34.2,"mpu":"I2C_FAULT"}
    Serial.print("{\"temp\":");
    Serial.print(temperature, 1);
    Serial.print(",\"hum\":");
    Serial.print(humidity, 1);
    Serial.print(",\"volt\":");
    Serial.print(busVoltage_V, 2);
    Serial.print(",\"curr\":");
    Serial.print(current_mA, 1);
    Serial.print(",\"pwr\":");
    Serial.print(power_mW, 1);
    Serial.print(",\"dist\":");
    Serial.print(distance_cm, 1);
    Serial.print(",\"mpu\":\"");
    Serial.print(mpuStatus);
    Serial.println("\"}");

    // Also output human-readable debug telemetry format for Arduino Serial Monitor
    /*
    Serial.print("[TELEM] Temp: "); Serial.print(temperature, 1); Serial.print(" C | ");
    Serial.print("Hum: "); Serial.print(humidity, 1); Serial.print(" % | ");
    Serial.print("Volt: "); Serial.print(busVoltage_V, 2); Serial.print(" V | ");
    Serial.print("Curr: "); Serial.print(current_mA, 1); Serial.print(" mA | ");
    Serial.print("Dist: "); Serial.print(distance_cm, 1); Serial.print(" cm | ");
    Serial.print("MPU: "); Serial.println(mpuStatus);
    */
  }
}

// =====================================================================
// SENSOR INITIALIZATION AND DIAGNOSTICS
// =====================================================================
void initSensors() {
  // 1. Initialize DHT11
  dht.begin();
  Serial.println("[SENSOR] DHT11 Temperature & Humidity Initialized.");

  // 2. Initialize HC-SR04 Pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
  Serial.println("[SENSOR] HC-SR04 Ultrasonic Distance Sensor Initialized.");

  // 3. Initialize INA219 (Default I2C address: 0x40)
  if (ina219.begin()) {
    ina219_connected = true;
    Serial.println("[SENSOR] INA219 Power Monitor Detected (I2C 0x40).");
  } else {
    ina219_connected = false;
    Serial.println("[SENSOR][WARNING] INA219 not detected at I2C 0x40.");
  }

  // 4. Scan and Verify MPU6050 (Default I2C address: 0x68 or 0x69)
  if (checkI2CDevice(0x68) || checkI2CDevice(0x69)) {
    mpu6050_connected = true;
    Serial.println("[SENSOR] MPU6050 IMU Detected.");
  } else {
    mpu6050_connected = false;
    Serial.println("[SENSOR][NOTICE] MPU6050 I2C connection failed / not detected (Hardware I2C Fault). Dashboard will use simulated data.");
  }
}

// I2C Bus probe helper
bool checkI2CDevice(byte address) {
  Wire.beginTransmission(address);
  return (Wire.endTransmission() == 0);
}

// Distance Measurement Function (HC-SR04)
float measureDistance() {
  // Clear trigger pin
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  // Send 10us ultrasonic pulse
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Read echo duration (timeout at 30ms -> max ~5m)
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    // Out of range or sensor disconnected
    return -1.0;
  }

  // Calculate distance in cm (Speed of sound in air = 343 m/s = 0.0343 cm/us)
  float distance = (duration * 0.0343) / 2.0;
  return distance;
}

