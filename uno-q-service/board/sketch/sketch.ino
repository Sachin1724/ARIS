
#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <Arduino_RouterBridge.h>
#include <math.h>

#include "bme69x.h"

// ======================================
// AERIS - BOSCH BME690 DRIVER
// Arduino UNO Q + Python Bridge
// ======================================

#define MQ135_PIN A0
#define FC22_PIN  A1

// D3 -> normally-open pushbutton -> GND. Internal pull-up enabled.
#define AERIS_PAGE_BUTTON_PIN 3
#define AERIS_BUTTON_DEBOUNCE_MS 45UL
#define AERIS_OLED_REFRESH_MS 100UL
#define AERIS_PAIR_HOLD_MS 3000UL
#define AERIS_PAIR_WINDOW_MS 180000UL
// Held well past the pairing hold: ask Linux for a clean poweroff, so the SD
// card is not corrupted by the supply being pulled.
#define AERIS_POWEROFF_HOLD_MS 8000UL

#define READ_INTERVAL_MS 2000UL

#define GAS_HEATER_TEMP 300
#define GAS_HEATER_TIME 100

// OLED: CLK=13 MOSI=11 CS=10 DC=9 RST=8
U8G2_SSD1306_128X64_NONAME_F_4W_SW_SPI oled(
    U8G2_R0, 13, 11, 10, 9, 8
);

// ======================================
// BOSCH DRIVER VARIABLES
// ======================================

struct bme69x_dev bme;
struct bme69x_conf bmeConf;
struct bme69x_heatr_conf heaterConf;

uint8_t bmeAddress = 0;

bool bmeReady = false;
bool bmeReadingOK = false;
bool pressureOK = false;
bool gasOK = false;

float temperatureC = NAN;
float humidityRH = NAN;
float pressureHPa = NAN;
float gasKOhm = NAN;

int mq135ADC = 0;
int fc22ADC = 0;

// AERIS_GP2Y_SENSOR_V1
// GP2Y1010AU0F optical dust sensor
#define AERIS_DUST_ADC_PIN A2
#define AERIS_DUST_LED_PIN 2

// SAFETY LOCK: set true ONLY after verifying
// A2 voltage divider and correct LED-control wiring.
static const bool AERIS_DUST_ENABLED = true;

// 22k top and 10k bottom voltage divider.
static const float AERIS_DUST_DIVIDER = 3.2f;

// Set from a measured clean-air voltage later.
// Negative = not calibrated.
static const float AERIS_DUST_ZERO_V = -1.0f;

// Typical sensitivity: 0.5 V per 0.1 mg/m3.
// This is an optical dust approximation, NOT PM2.5.
static const float AERIS_DUST_SENS_V_PER_MG_M3 = 5.0f;

static int aerisDustADC = -1;
static float aerisDustVoltage = -1.0f;
static unsigned long aerisDustLastPulse = 0;


int lastBoschResult = 0;
int lastFieldCount = 0;
int lastFieldStatus = 0;

unsigned long lastRead = 0;
// D3 short-press: cycles 5 OLED pages. 3-second hold: BLE discovery window.
// 8-second hold: request a clean Linux shutdown.
// The MCU does NOT control Wi-Fi; Linux decides whether to advertise.
static uint8_t aerisPage = 0;
static bool aerisButtonLastRaw = HIGH;
static bool aerisButtonStable = HIGH;
static bool aerisLongPressHandled = false;
static bool aerisPowerOffRequested = false;
static unsigned long aerisButtonChangedAt = 0;
static unsigned long aerisPressStartedAt = 0;
static unsigned long aerisDiscoveryStartedAt = 0;
static bool aerisDiscoveryRequested = false;
static unsigned long aerisLastOLEDRefresh = 0;
static unsigned long aerisPairCode = 0;

// Prototype: code rotates on each D3 discovery activation, expires after 3 min.
// Replace MCU PRNG with Linux cryptographic enrollment before production.
float getAerisPairCode() {
    return getAerisDiscoveryRemaining() > 0 ? (float)aerisPairCode : 0.0f;
}


float getAerisPowerOffRequest() {
    return aerisPowerOffRequested ? 1.0f : 0.0f;
}


float getAerisDiscoveryRemaining() {
    if (!aerisDiscoveryRequested) return 0.0f;
    unsigned long elapsed = (unsigned long)(millis() - aerisDiscoveryStartedAt);
    if (elapsed >= AERIS_PAIR_WINDOW_MS) {
        aerisDiscoveryRequested = false;
        return 0.0f;
    }
    return (float)(AERIS_PAIR_WINDOW_MS - elapsed) / 1000.0f;
}

void aerisPollPageButton() {
    bool raw = digitalRead(AERIS_PAGE_BUTTON_PIN);
    unsigned long now = millis();
    if (raw != aerisButtonLastRaw) {
        aerisButtonLastRaw = raw;
        aerisButtonChangedAt = now;
    }
    if ((unsigned long)(now - aerisButtonChangedAt) >= AERIS_BUTTON_DEBOUNCE_MS
            && raw != aerisButtonStable) {
        aerisButtonStable = raw;
        if (raw == LOW) {
            aerisPressStartedAt = now;
            aerisLongPressHandled = false;
            aerisPowerOffRequested = false;
        } else if (!aerisLongPressHandled) {
            if (aerisDiscoveryRequested) {
                // The overlay pre-empts the pages, so a press here means
                // "dismiss", not "next page".
                aerisCloseDiscovery();
            } else {
                aerisPage = (uint8_t)((aerisPage + 1) % 5);
                aerisLastOLEDRefresh = 0;
            }
        }
    }
    if (aerisButtonStable == LOW && !aerisLongPressHandled
            && (unsigned long)(now - aerisPressStartedAt) >= AERIS_PAIR_HOLD_MS) {
        // Seeded from human button-release timing; prototype, NOT a secure RNG.
        randomSeed((unsigned long)micros() ^ ((unsigned long)now << 11));
        aerisPairCode = (unsigned long)random(100000L, 1000000L);
        aerisDiscoveryRequested = true;
        aerisDiscoveryStartedAt = now;
        aerisLongPressHandled = true;
        aerisLastOLEDRefresh = 0;
    }
    // The pairing block above latches aerisLongPressHandled, so this needs its
    // own flag rather than reusing it.
    if (aerisButtonStable == LOW && !aerisPowerOffRequested
            && (unsigned long)(now - aerisPressStartedAt) >= AERIS_POWEROFF_HOLD_MS) {
        aerisPowerOffRequested = true;
        aerisLastOLEDRefresh = 0;
    }
}

// ======================================
// ARDUINO I2C CALLBACKS FOR BOSCH
// ======================================

int8_t bmeI2CRead(
    uint8_t reg,
    uint8_t *data,
    uint32_t len,
    void *intf_ptr
) {
    if (intf_ptr == nullptr || data == nullptr) {
        return -1;
    }

    uint8_t address = *((uint8_t *)intf_ptr);
    uint32_t offset = 0;

    while (offset < len) {
        uint8_t chunk = (uint8_t)min(
            (uint32_t)28,
            len - offset
        );

        Wire.beginTransmission(address);
        Wire.write((uint8_t)(reg + offset));

        if (Wire.endTransmission(false) != 0) {
            return -1;
        }

        uint8_t received = Wire.requestFrom(
            address, chunk
        );

        if (received != chunk) {
            return -1;
        }

        for (uint8_t i = 0; i < chunk; i++) {
            if (!Wire.available()) {
                return -1;
            }
            data[offset + i] = Wire.read();
        }

        offset += chunk;
    }

    return 0;
}

int8_t bmeI2CWrite(
    uint8_t reg,
    const uint8_t *data,
    uint32_t len,
    void *intf_ptr
) {
    if (intf_ptr == nullptr || data == nullptr) {
        return -1;
    }

    uint8_t address = *((uint8_t *)intf_ptr);
    uint32_t offset = 0;

    while (offset < len) {
        uint8_t chunk = (uint8_t)min(
            (uint32_t)28,
            len - offset
        );

        Wire.beginTransmission(address);
        Wire.write((uint8_t)(reg + offset));

        for (uint8_t i = 0; i < chunk; i++) {
            Wire.write(data[offset + i]);
        }

        if (Wire.endTransmission(true) != 0) {
            return -1;
        }

        offset += chunk;
    }

    return 0;
}

void bmeDelayUS(
    uint32_t period,
    void *intf_ptr
) {
    (void)intf_ptr;

    if (period >= 1000) {
        delay(period / 1000);
    }

    uint32_t remainder = period % 1000;

    if (remainder > 0) {
        delayMicroseconds(remainder);
    }
}

// ======================================
// FIND SENSOR I2C ADDRESS
// ======================================

bool addressPresent(uint8_t address) {
    Wire.beginTransmission(address);
    return Wire.endTransmission() == 0;
}

// ======================================
// BOSCH BME690 INITIALIZATION
// ======================================

bool initializeBME() {

    bmeReady = false;

    if (addressPresent(0x76)) {
        bmeAddress = 0x76;
    }
    else if (addressPresent(0x77)) {
        bmeAddress = 0x77;
    }
    else {
        Serial.println("BME690 NOT FOUND");
        lastBoschResult = -100;
        return false;
    }

    memset(&bme, 0, sizeof(bme));
    memset(&bmeConf, 0, sizeof(bmeConf));
    memset(&heaterConf, 0, sizeof(heaterConf));

    bme.intf = BME69X_I2C_INTF;
    bme.intf_ptr = &bmeAddress;

    bme.read = bmeI2CRead;
    bme.write = bmeI2CWrite;
    bme.delay_us = bmeDelayUS;

    bme.amb_temp = 25;

    int8_t result = bme69x_init(&bme);

    lastBoschResult = result;

    Serial.print("Bosch init result: ");
    Serial.println(result);

    Serial.print("Chip ID: 0x");
    Serial.println(bme.chip_id, HEX);

    Serial.print("Variant ID: 0x");
    Serial.println(bme.variant_id, HEX);

    if (result != BME69X_OK) {
        return false;
    }

    if (
        bme.chip_id != 0x61 ||
        bme.variant_id != 0x02
    ) {
        Serial.println(
            "WARNING: Unexpected BME variant"
        );
        return false;
    }

    bmeConf.filter = BME69X_FILTER_OFF;
    bmeConf.odr = BME69X_ODR_NONE;

    bmeConf.os_hum = BME69X_OS_2X;
    bmeConf.os_pres = BME69X_OS_4X;
    bmeConf.os_temp = BME69X_OS_8X;

    result = bme69x_set_conf(&bmeConf, &bme);
    lastBoschResult = result;

    if (result != BME69X_OK) {
        Serial.println("BME CONFIG FAILED");
        return false;
    }

    // Gas heater enabled again using Bosch API
    heaterConf.enable = BME69X_ENABLE;
    heaterConf.heatr_temp = GAS_HEATER_TEMP;
    heaterConf.heatr_dur = GAS_HEATER_TIME;

    result = bme69x_set_heatr_conf(
        BME69X_FORCED_MODE,
        &heaterConf,
        &bme
    );

    lastBoschResult = result;

    if (result != BME69X_OK) {
        Serial.println("BME HEATER CONFIG FAILED");
        return false;
    }

    bmeReady = true;

    Serial.println("BOSCH BME690 READY");

    return true;
}

// ======================================
// READ ALL SENSORS
// ======================================

void readSensors() {

    mq135ADC = analogRead(MQ135_PIN);
    fc22ADC = analogRead(FC22_PIN);
    aerisUpdateDust();

    bmeReadingOK = false;
    pressureOK = false;
    gasOK = false;

    temperatureC = NAN;
    humidityRH = NAN;
    pressureHPa = NAN;
    gasKOhm = NAN;

    lastFieldCount = 0;
    lastFieldStatus = 0;

    if (!bmeReady) {
        return;
    }

    int8_t result = bme69x_set_op_mode(
        BME69X_FORCED_MODE,
        &bme
    );

    lastBoschResult = result;

    if (result != BME69X_OK) {
        Serial.println("SET MODE FAILED");
        return;
    }

    uint32_t measurementUS = bme69x_get_meas_dur(
        BME69X_FORCED_MODE,
        &bmeConf,
        &bme
    );

    uint32_t waitUS =
        measurementUS +
        ((uint32_t)GAS_HEATER_TIME * 1000UL) +
        10000UL;

    bmeDelayUS(waitUS, nullptr);

    struct bme69x_data data;
    memset(&data, 0, sizeof(data));

    uint8_t fieldCount = 0;

    result = bme69x_get_data(
        BME69X_FORCED_MODE,
        &data,
        &fieldCount,
        &bme
    );

    lastBoschResult = result;
    lastFieldCount = fieldCount;

    if (result != BME69X_OK || fieldCount == 0) {
        Serial.println("NO VALID BME DATA");
        return;
    }

    lastFieldStatus = data.status;

    // Bosch FPU mode:
    // Temperature in Celsius
    // Humidity in %
    // Pressure in Pa
    // Gas resistance in Ohms

    temperatureC = data.temperature;
    humidityRH = data.humidity;
    pressureHPa = data.pressure / 100.0f;

    bmeReadingOK =
        isfinite(temperatureC) &&
        isfinite(humidityRH) &&
        temperatureC > -40.0f &&
        temperatureC < 85.0f &&
        humidityRH >= 0.0f &&
        humidityRH <= 100.0f;

    // Broad atmospheric sanity check
    pressureOK =
        bmeReadingOK &&
        isfinite(pressureHPa) &&
        pressureHPa >= 300.0f &&
        pressureHPa <= 1100.0f;

    bool gasValid =
        (data.status & BME69X_GASM_VALID_MSK) != 0;

    bool heaterStable =
        (data.status & BME69X_HEAT_STAB_MSK) != 0;

    gasOK =
        gasValid &&
        heaterStable &&
        isfinite(data.gas_resistance) &&
        data.gas_resistance > 0;

    if (gasOK) {
        gasKOhm = data.gas_resistance / 1000.0f;
    }
}

// ======================================
// BRIDGE RPC METHODS
// ======================================

float getTemp() {
    return temperatureC;
}

float getHumidity() {
    return humidityRH;
}

float getPressure() {
    return pressureHPa;
}

float getGas() {
    return gasKOhm;
}

int getMQ135() {
    return mq135ADC;
}

int getFC22() {
    return fc22ADC;
}


// ======================================
// AERIS ANALOG GAS CALIBRATION
// ======================================

// Existing sketch uses analogReadResolution(10).
// ADC values therefore range from 0 to 1023.
//
// Confirm electrical ADC reference and
// actual module output divider before relying
// on reconstructed voltage measurements.

static const float AERIS_ADC_REF_V = 3.3f;
static const float AERIS_ADC_MAX = 1023.0f;

// SENSOR AO VOLTAGE / ACTUAL ADC PIN VOLTAGE.
// Use 1.0 only when AO is safely within the
// permitted analog input range and no
// external divider is installed.
static const float MQ135_DIVIDER = 3.2f;
static const float MG811_DIVIDER = 3.2f;

// MQ135: baseline voltage comparison, NOT ppm.
static const bool MQ135_BASELINE_SET = false;
static const float MQ135_BASELINE_V = 0.0f;

// MG811: must have TWO independently measured
// reference CO2 concentrations and AO voltages.
// Calibration remains off by default.
static const bool MG811_CAL_SET = false;

static const float MG811_LOW_PPM = 0.0f;
static const float MG811_LOW_V = 0.0f;
static const float MG811_HIGH_PPM = 0.0f;
static const float MG811_HIGH_V = 0.0f;

// GP2Y pulse measurement.
// Pin 3 LED input is active LOW with the
// recommended Sharp circuit.
void aerisUpdateDust() {
    if (!AERIS_DUST_ENABLED) return;

    // At least 10ms between LED pulse beginnings.
    unsigned long now = micros();
    if ((unsigned long)(now - aerisDustLastPulse)
        < 10000UL) return;

    aerisDustLastPulse = now;

    // AERIS_GP2Y_TIMING_FIX_V1
    // Sharp GP2Y1010AU0F:
    // Start ADC sampling around 280 us.
    // End LED pulse around 320 us.
    unsigned long pulseStart = micros();

    digitalWrite(AERIS_DUST_LED_PIN, LOW);

    while (
        (unsigned long)(micros() - pulseStart)
        < 280UL
    ) {
        // Wait for ADC sample point.
    }

    int raw = analogRead(AERIS_DUST_ADC_PIN);

    // Do not add 40 us on top of ADC duration.
    // If ADC already took too long, turn LED off
    // immediately.
    while (
        (unsigned long)(micros() - pulseStart)
        < 320UL
    ) {
        // Wait for pulse end.
    }

    digitalWrite(AERIS_DUST_LED_PIN, HIGH);

    aerisDustADC = raw;

    // 10-bit ADC and nominal 3.3V reference.
    aerisDustVoltage = raw * 3.3f
        * AERIS_DUST_DIVIDER / 1023.0f;
}

int getAerisDustEnabled() {
    return AERIS_DUST_ENABLED ? 1 : 0;
}

int getAerisDustADC() {
    return aerisDustADC;
}

float getAerisDustVoltage() {
    return aerisDustVoltage;
}

int getAerisDustCalOK() {
    return AERIS_DUST_ENABLED &&
        AERIS_DUST_ZERO_V >= 0.0f &&
        AERIS_DUST_SENS_V_PER_MG_M3 > 0.0f;
}

float getAerisDustDensity() {
    if (!getAerisDustCalOK() ||
        aerisDustVoltage < 0.0f) return -1.0f;

    float mg_m3 =
        (aerisDustVoltage - AERIS_DUST_ZERO_V) /
        AERIS_DUST_SENS_V_PER_MG_M3;

    if (mg_m3 < 0.0f) mg_m3 = 0.0f;

    // Indicative total optical dust density.
    // Do not use as PM2.5 or PM10.
    return mg_m3 * 1000.0f;
}

float getMQ135Voltage() {
    return mq135ADC * AERIS_ADC_REF_V
           * MQ135_DIVIDER / AERIS_ADC_MAX;
}

float getMG811Voltage() {
    return fc22ADC * AERIS_ADC_REF_V
           * MG811_DIVIDER / AERIS_ADC_MAX;
}

int getMG811ADC() {
    return fc22ADC;
}

int getMQ135CalOK() {
    return (
        MQ135_BASELINE_SET &&
        MQ135_BASELINE_V > 0.0f
    ) ? 1 : 0;
}

float getMQ135Relative() {
    if (!getMQ135CalOK())
        return 0.0f;

    return getMQ135Voltage() /
           MQ135_BASELINE_V;
}

int getCO2CalOK() {
    return (
        MG811_CAL_SET &&
        MG811_LOW_PPM > 0.0f &&
        MG811_HIGH_PPM > MG811_LOW_PPM &&
        MG811_LOW_V > MG811_HIGH_V &&
        MG811_HIGH_V > 0.0f
    ) ? 1 : 0;
}

int getCO2RangeOK() {
    if (!getCO2CalOK())
        return 0;

    float v = getMG811Voltage();

    return (
        v <= MG811_LOW_V &&
        v >= MG811_HIGH_V
    ) ? 1 : 0;
}

float getCO2PPM() {
    // No fabricated ppm when uncalibrated
    // or outside the measured voltage range.
    // Python must check calibration/range flags.
    if (!getCO2RangeOK())
        return 0.0f;

    // Two-point semi-log interpolation.
    // This is a calibration approximation,
    // not a universal MG811 transfer curve.
    float v = getMG811Voltage();

    float fraction =
        (MG811_LOW_V - v) /
        (MG811_LOW_V - MG811_HIGH_V);

    float logppm =
        log10f(MG811_LOW_PPM) +
        fraction * (
            log10f(MG811_HIGH_PPM) -
            log10f(MG811_LOW_PPM)
        );

    float ppm = powf(10.0f, logppm);

    return isfinite(ppm) ? ppm : 0.0f;
}

int getStatus() {
    return bmeReadingOK ? 1 : 0;
}

int getPressureOK() {
    return pressureOK ? 1 : 0;
}

int getGasOK() {
    return gasOK ? 1 : 0;
}

int getChipID() {
    return bme.chip_id;
}

int getVariantID() {
    return (int)bme.variant_id;
}

int getAddress() {
    return bmeAddress;
}

int getBoschResult() {
    return lastBoschResult;
}

int getFieldCount() {
    return lastFieldCount;
}

int getFieldStatus() {
    return lastFieldStatus;
}

// ======================================
// OLED DISPLAY
// ======================================

// AERIS OLED interface: expressive eyes plus clean sensor pages.
// Weather estimates and calibrated metadata live on Linux; do not
// invent CO2 or gas identities on the microcontroller screen.

static int8_t eyeOffsetX = 0;
static int8_t eyeOffsetY = 0;
static unsigned long lastSaccade = 0;

// Link state pushed in by Linux (devices connected, API/Wi-Fi health, board
// load). The MCU cannot see the network, so these are the only numbers it has.
static volatile int aerisLinkDevices = 0;
static volatile int aerisLinkSockets = 0;
static volatile int aerisLinkWifiOk = 0;
static volatile int aerisLinkCpuPct = -1;
static volatile int aerisLinkMemPct = -1;
static volatile int aerisLinkTempC = -1000;
static unsigned long aerisLinkUpdatedAt = 0;
static bool aerisLinkEverSeen = false;
static int aerisLastNoticedDevices = 0;
// Transient banner, same idea as the pairing-window overlay below.
static char aerisNoticeText[22] = {0};
static unsigned long aerisNoticeUntil = 0;

#define AERIS_LINK_STALE_MS 15000UL
#define AERIS_NOTICE_MS 4000UL

static void aerisShowNotice(const char *text) {
    snprintf(aerisNoticeText, sizeof(aerisNoticeText), "%s", text);
    aerisNoticeUntil = millis() + AERIS_NOTICE_MS;
}

/** Called from Linux every few seconds. Returns 1 so the caller can confirm. */
int setAerisLink(int devices, int sockets, int wifiOk, int cpuPct, int memPct, int tempC) {
    aerisLinkDevices = devices;
    aerisLinkSockets = sockets;
    aerisLinkWifiOk = wifiOk;
    aerisLinkCpuPct = cpuPct;
    aerisLinkMemPct = memPct;
    aerisLinkTempC = tempC;
    aerisLinkUpdatedAt = millis();

    if (!aerisLinkEverSeen) {
        aerisLinkEverSeen = true;
        aerisLastNoticedDevices = devices;
        return 1;
    }
    if (devices > aerisLastNoticedDevices) {
        // Connected: the PIN screen has served its purpose, close it.
        if (aerisDiscoveryRequested) {
            aerisCloseDiscovery();
        }
        if (devices == 1) {
            aerisShowNotice("PHONE CONNECTED");
        } else {
            char line[22];
            snprintf(line, sizeof(line), "%d DEVICES", devices);
            aerisShowNotice(line);
        }
        // Look up at whoever just arrived instead of drifting.
        eyeOffsetX = 0;
        eyeOffsetY = -2;
        lastSaccade = millis();
    } else if (devices < aerisLastNoticedDevices) {
        aerisShowNotice(devices == 0 ? "NO DEVICES" : "DEVICE LEFT");
    }
    aerisLastNoticedDevices = devices;
    return 1;
}

/** End the pairing window early: pairing is done, or the user dismissed it. */
int aerisCloseDiscovery() {
    aerisDiscoveryRequested = false;
    aerisPairCode = 0;
    aerisLastOLEDRefresh = 0;
    return 1;
}

static bool aerisLinkStale() {
    return !aerisLinkEverSeen ||
        (unsigned long)(millis() - aerisLinkUpdatedAt) > AERIS_LINK_STALE_MS;
}

static volatile int aerisMoodRequest = -1;
int getAerisMoodRequest() { return aerisMoodRequest; }
void setAerisMoodRequest(int m) { aerisMoodRequest = m; }
// AERIS Expressive Eye System
enum AerisMood {
    MOOD_NORMAL = 0, MOOD_HAPPY, MOOD_SAD,
    MOOD_SUSPICIOUS, MOOD_ANGRY, MOOD_SLEEPY, MOOD_COUNT
};

static AerisMood aerisMood = MOOD_NORMAL;
static unsigned long lastBlinkTime = 0;
static unsigned long blinkStartTime = 0;
static bool isBlinking = false;
static unsigned long nextSaccadeInterval = 2000;
static unsigned long nextBlinkInterval = 4000;

static uint8_t rng8 = 42;
static uint8_t fastRng() {
    rng8 ^= rng8 << 3; rng8 ^= rng8 >> 5; rng8 ^= rng8 << 4;
    return rng8;
}

int getAerisMood() { return (int)aerisMood; }
void setAerisMood(int m) {
    if (m >= 0 && m < MOOD_COUNT) aerisMood = (AerisMood)m;
}

void aerisDrawEyes() {
    unsigned long now = millis();

    // Random saccade
    if ((unsigned long)(now - lastSaccade) >= nextSaccadeInterval) {
        lastSaccade = now;
        uint8_t r = fastRng();
        eyeOffsetX = (int8_t)((r % 11) - 5);
        eyeOffsetY = (int8_t)(((r >> 4) % 7) - 3);
        nextSaccadeInterval = 1500 + (fastRng() % 3000);
    }

    // Blink trigger
    if (!isBlinking && (unsigned long)(now - lastBlinkTime) >= nextBlinkInterval) {
        isBlinking = true;
        blinkStartTime = now;
        nextBlinkInterval = 3000 + (fastRng() % 4000);
    }
    bool blinkClosed = false;
    if (isBlinking) {
        if ((unsigned long)(now - blinkStartTime) < 80) blinkClosed = true;
        else { isBlinking = false; lastBlinkTime = now; }
    }

    // Mood-based lid adjustments
    int8_t topLidL = 0, topLidR = 0, botLidL = 0, botLidR = 0, moodY = 0;
    switch (aerisMood) {
        case MOOD_HAPPY:    botLidL = 10; botLidR = 10; break;
        case MOOD_SAD:      topLidL = 8; topLidR = 8; moodY = 3; break;
        case MOOD_SUSPICIOUS: topLidL = 12; topLidR = 6; eyeOffsetX = -3; break;
        case MOOD_ANGRY:    topLidL = 10; topLidR = 10; moodY = -2; break;
        case MOOD_SLEEPY:   topLidL = 16; topLidR = 16; moodY = 4; break;
        default: break;
    }

    int py = 31 + eyeOffsetY + moodY;
    const int cxArr[2] = {37, 91};

    for (int eye = 0; eye < 2; eye++) {
        int cx = cxArr[eye];
        int fx = cx - 20, fy = 9;
        int8_t topLid = (eye == 0) ? topLidL : topLidR;
        int8_t botLid = (eye == 0) ? botLidL : botLidR;

        oled.drawRFrame(fx, fy, 40, 44, 14);

        if (blinkClosed) {
            oled.drawHLine(cx - 11, 31, 22);
        } else {
            int px = cx + eyeOffsetX;
            oled.drawDisc(px, py, 10);
            oled.setDrawColor(0);
            oled.drawDisc(px + 3, py - 4, 3);
            oled.setDrawColor(1);

            if (topLid > 0) {
                oled.setDrawColor(0);
                oled.drawBox(fx + 1, fy + 1, 38, topLid);
                oled.setDrawColor(1);
                oled.drawRFrame(fx, fy, 40, 44, 14);
            }
            if (botLid > 0) {
                oled.setDrawColor(0);
                oled.drawBox(fx + 1, fy + 44 - botLid - 1, 38, botLid);
                oled.setDrawColor(1);
                oled.drawRFrame(fx, fy, 40, 44, 14);
            }
        }
    }

    oled.setFont(u8g2_font_5x7_tf);
    oled.drawStr(44, 62, "AERIS");
}

void updateOLED() {
    char line[32];
    oled.clearBuffer();
    // Short D3 press cycles pages; long press opens BLE discovery window.
    if (getAerisDiscoveryRemaining() > 0.0f) {
        oled.setFont(u8g2_font_6x10_tf);
        oled.drawStr(14, 15, "AERIS DISCOVERY");
        char pinLine[24];
        snprintf(pinLine, sizeof(pinLine), "PIN: %06lu", aerisPairCode);
        oled.drawStr(20, 35, pinLine);
        oled.setFont(u8g2_font_5x7_tf);
        oled.drawStr(4, 56, "Press D3 to dismiss");
        oled.sendBuffer();
        return;
    }
    // Transient banner wins over the pages, like the discovery overlay above.
    if (aerisNoticeUntil != 0) {
        if ((long)(millis() - aerisNoticeUntil) < 0) {
            oled.setFont(u8g2_font_6x10_tf);
            oled.drawStr(4, 28, aerisNoticeText);
            oled.setFont(u8g2_font_5x7_tf);
            if (aerisLinkSockets > aerisLinkDevices && aerisLinkDevices > 0) {
                snprintf(line, sizeof(line), "%d live streams", aerisLinkSockets);
                oled.drawStr(4, 46, line);
            } else {
                oled.drawStr(4, 46, "AERIS");
            }
            oled.sendBuffer();
            return;
        }
        aerisNoticeUntil = 0;
    }
    if (aerisPowerOffRequested) {
        oled.setFont(u8g2_font_6x10_tf);
        oled.drawStr(10, 28, "SHUTTING DOWN");
        oled.setFont(u8g2_font_5x7_tf);
        oled.drawStr(10, 46, "Release the button");
        oled.sendBuffer();
        return;
    }
    uint8_t page = aerisPage;
    if (page == 0) {
        aerisDrawEyes();
    } else {
        oled.setFont(u8g2_font_6x10_tf);
        oled.drawStr(0, 10, "AERIS | LIVE STATUS");
        oled.drawHLine(0, 13, 128);
        if (page == 1) {
            if (bmeReadingOK && isfinite(temperatureC) && isfinite(humidityRH)) {
                snprintf(line, sizeof(line), "Temp: %.1f C", temperatureC);
                oled.drawStr(0, 27, line);
                snprintf(line, sizeof(line), "Humidity: %.1f%%", humidityRH);
                oled.drawStr(0, 39, line);
            } else {
                oled.drawStr(0, 27, "BME690 unavailable");
            }
            if (pressureOK && isfinite(pressureHPa)) {
                snprintf(line, sizeof(line), "Pressure: %.0f hPa", pressureHPa);
                oled.drawStr(0, 52, line);
            } else {
                oled.drawStr(0, 52, "Pressure unavailable");
            }
            oled.setFont(u8g2_font_5x7_tf);
            oled.drawStr(0, 63, "LOCAL SENSOR VALUES");
        } else if (page == 2) {
            if (gasOK && isfinite(gasKOhm)) {
                snprintf(line, sizeof(line), "BME gas: %.1fkOhm", gasKOhm);
                oled.drawStr(0, 27, line);
            } else {
                oled.drawStr(0, 27, "BME gas unavailable");
            }
            oled.drawStr(0, 40, "MQ135: MIXED GAS");
            oled.drawStr(0, 52, "CO2: UNVERIFIED");
            oled.setFont(u8g2_font_5x7_tf);
            oled.drawStr(0, 63, "GP2Y: NOT READY");
        } else if (page == 3) {
            if (aerisLinkStale()) {
                oled.drawStr(0, 27, "Link to Linux: none");
                oled.setFont(u8g2_font_5x7_tf);
                oled.drawStr(0, 63, "AERIS | NETWORK");
            } else {
                snprintf(line, sizeof(line), "Devices: %d", (int)aerisLinkDevices);
                oled.drawStr(0, 27, line);
                snprintf(line, sizeof(line), "Streams: %d", (int)aerisLinkSockets);
                oled.drawStr(0, 39, line);
                float pairing = getAerisDiscoveryRemaining();
                if (pairing > 0.0f) {
                    snprintf(line, sizeof(line), "Pairing: %ds", (int)pairing);
                } else {
                    snprintf(line, sizeof(line), "API: %s",
                             aerisLinkWifiOk ? "reachable" : "unknown");
                }
                oled.drawStr(0, 52, line);
                oled.setFont(u8g2_font_5x7_tf);
                oled.drawStr(0, 63, "AERIS | NETWORK");
            }
        } else {
            if (aerisLinkStale()) {
                oled.drawStr(0, 27, "No data from Linux");
                oled.setFont(u8g2_font_5x7_tf);
                oled.drawStr(0, 63, "AERIS | SYSTEM");
            } else {
                if (aerisLinkCpuPct >= 0 && aerisLinkMemPct >= 0) {
                    snprintf(line, sizeof(line), "CPU %d%%  RAM %d%%",
                             (int)aerisLinkCpuPct, (int)aerisLinkMemPct);
                } else {
                    snprintf(line, sizeof(line), "CPU/RAM unavailable");
                }
                oled.drawStr(0, 27, line);
                if (aerisLinkTempC > -273) {
                    snprintf(line, sizeof(line), "Board: %d C", (int)aerisLinkTempC);
                } else {
                    snprintf(line, sizeof(line), "Board temp unknown");
                }
                oled.drawStr(0, 39, line);
                unsigned long age = (millis() - aerisLinkUpdatedAt) / 1000UL;
                snprintf(line, sizeof(line), "Updated %lus ago", age);
                oled.drawStr(0, 52, line);
                oled.setFont(u8g2_font_5x7_tf);
                oled.drawStr(0, 63, "AERIS | SYSTEM");
            }
        }
    }
    oled.sendBuffer();
}

// ======================================
// SERIAL DIAGNOSTICS
// ======================================

void printDiagnostics() {

    Serial.println();
    Serial.println("====== AERIS BOSCH ======");

    Serial.print("Chip ID: 0x");
    Serial.println(bme.chip_id, HEX);

    Serial.print("Variant: 0x");
    Serial.println(bme.variant_id, HEX);

    Serial.print("Bosch result: ");
    Serial.println(lastBoschResult);

    Serial.print("Field count: ");
    Serial.println(lastFieldCount);

    Serial.print("Field status: 0x");
    Serial.println(lastFieldStatus, HEX);

    Serial.print("Temperature: ");
    Serial.println(temperatureC);

    Serial.print("Humidity: ");
    Serial.println(humidityRH);

    Serial.print("Pressure hPa: ");
    Serial.println(pressureHPa);

    Serial.print("Gas kOhm: ");
    Serial.println(gasKOhm);

    Serial.print("MQ135 ADC: ");
    Serial.println(mq135ADC);

    Serial.print("FC22 ADC: ");
    Serial.println(fc22ADC);

    if (!pressureOK) {
        Serial.println("WARNING: PRESSURE INVALID");
    }

    if (!gasOK) {
        Serial.println("WARNING: GAS NOT VALID");
    }

    Serial.println("=========================");
}

// ======================================
// SETUP
// ======================================

void setup() {

    Serial.begin(115200);
    Wire.begin();

    analogReadResolution(10);

    pinMode(MQ135_PIN, INPUT);
    pinMode(FC22_PIN, INPUT);
    pinMode(AERIS_PAGE_BUTTON_PIN, INPUT_PULLUP);

    // Keep LED control high impedance until the
    // optical sensor wiring is verified.
    if (AERIS_DUST_ENABLED) {
        pinMode(AERIS_DUST_ADC_PIN, INPUT);
        digitalWrite(AERIS_DUST_LED_PIN, HIGH);
        pinMode(AERIS_DUST_LED_PIN, OUTPUT);
    } else {
        pinMode(AERIS_DUST_LED_PIN, INPUT);
    }

    oled.begin();

    oled.clearBuffer();
    oled.setFont(u8g2_font_6x10_tf);
    oled.drawStr(0, 30, "AERIS BOSCH START");
    oled.sendBuffer();

    initializeBME();
    readSensors();
    updateOLED();

    if (!Bridge.begin()) {
        Serial.println("BRIDGE START FAILED");
        return;
    }

    Monitor.begin(115200);

    bool ok = true;

    ok &= Bridge.provide("aeris_discovery_remaining", getAerisDiscoveryRemaining);
    ok &= Bridge.provide("aeris_pair_code", getAerisPairCode);
    ok &= Bridge.provide("aeris_poweroff_request", getAerisPowerOffRequest);
    ok &= Bridge.provide("aeris_temp", getTemp);
    ok &= Bridge.provide("aeris_humidity", getHumidity);
    ok &= Bridge.provide("aeris_pressure", getPressure);
    ok &= Bridge.provide("aeris_gas", getGas);
    ok &= Bridge.provide(
        "aeris_dust_enabled", getAerisDustEnabled
    );
    ok &= Bridge.provide(
        "aeris_dust_adc", getAerisDustADC
    );
    ok &= Bridge.provide(
        "aeris_dust_voltage", getAerisDustVoltage
    );
    ok &= Bridge.provide(
        "aeris_dust_cal_ok", getAerisDustCalOK
    );
    ok &= Bridge.provide(
        "aeris_dust_density", getAerisDustDensity
    );

    ok &= Bridge.provide("aeris_mq135", getMQ135);
    ok &= Bridge.provide("aeris_fc22", getFC22);

    ok &= Bridge.provide(
        "aeris_mg811", getMG811ADC
    );

    ok &= Bridge.provide(
        "aeris_mq135_voltage", getMQ135Voltage
    );

    ok &= Bridge.provide(
        "aeris_mg811_voltage", getMG811Voltage
    );

    ok &= Bridge.provide(
        "aeris_mq135_relative", getMQ135Relative
    );

    ok &= Bridge.provide(
        "aeris_co2_ppm", getCO2PPM
    );

    ok &= Bridge.provide(
        "aeris_mq135_cal_ok", getMQ135CalOK
    );

    ok &= Bridge.provide(
        "aeris_co2_cal_ok", getCO2CalOK
    );

    ok &= Bridge.provide(
        "aeris_co2_range_ok", getCO2RangeOK
    );

    ok &= Bridge.provide("aeris_status", getStatus);

    ok &= Bridge.provide(
        "aeris_pressure_ok", getPressureOK
    );

    ok &= Bridge.provide(
        "aeris_gas_ok", getGasOK
    );

    ok &= Bridge.provide(
        "aeris_chip_id", getChipID
    );

    ok &= Bridge.provide(
        "aeris_variant_id", getVariantID
    );

    ok &= Bridge.provide(
        "aeris_address", getAddress
    );

    ok &= Bridge.provide(
        "aeris_bosch_result", getBoschResult
    );

    ok &= Bridge.provide(
        "aeris_field_count", getFieldCount
    );

    ok &= Bridge.provide(
        "aeris_field_status", getFieldStatus
    );

    ok &= Bridge.provide("aeris_mood", getAerisMood);
    ok &= Bridge.provide("aeris_mood_request", getAerisMoodRequest);
    // Linux -> MCU. setAerisMoodRequest and setAerisLink are the only inbound
    // calls; the mood setter already existed but was never wired up.
    ok &= Bridge.provide("aeris_set_mood_request", setAerisMoodRequest);
    ok &= Bridge.provide("aeris_set_link", setAerisLink);
    ok &= Bridge.provide("aeris_close_discovery", aerisCloseDiscovery);

    Monitor.println(
        ok ? "BOSCH BRIDGE READY"
           : "RPC REGISTRATION FAILED"
    );
}

// ======================================
// MAIN LOOP
// ======================================

void loop() {
    aerisPollPageButton();
    // Check for mood change from Python
    if (aerisMoodRequest >= 0 && aerisMoodRequest < MOOD_COUNT) {
        aerisMood = (AerisMood)aerisMoodRequest;
        aerisMoodRequest = -1;
    }
    if ((unsigned long)(millis() - aerisLastOLEDRefresh) >= AERIS_OLED_REFRESH_MS) {
        aerisLastOLEDRefresh = millis();
        updateOLED(); // refresh blink and button changes independent of sensor sampling
    }

    if (
        millis() - lastRead >=
        READ_INTERVAL_MS
    ) {

        lastRead = millis();

        readSensors();

        // Auto-set eye mood from dust voltage
        if (aerisMoodRequest < 0 && AERIS_DUST_ENABLED && aerisDustVoltage >= 0) {
            if (aerisDustVoltage < 1.0f)       aerisMood = MOOD_HAPPY;
            else if (aerisDustVoltage < 2.0f)   aerisMood = MOOD_NORMAL;
            else if (aerisDustVoltage < 3.0f)   aerisMood = MOOD_SUSPICIOUS;
            else                                aerisMood = MOOD_ANGRY;
        }

        printDiagnostics();
    }
}
