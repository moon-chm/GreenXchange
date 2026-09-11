#include <SoftwareSerial.h>
#include <math.h>

// ======================================================
// PIN CONFIGURATION
// ======================================================

// Gas sensors
#define MQ135_PIN A0
#define MQ7_PIN   A1
#define MQ2_PIN   A2

// Buzzer
#define BUZZER_PIN 8

// SIM800L
#define SIM800_RX 2
#define SIM800_TX 3

SoftwareSerial sim800(SIM800_RX, SIM800_TX);

// ======================================================
// SENSOR CONFIGURATION
// ======================================================

#define RL_VALUE 10.0
#define VCC 5.0

// Calibration values
float Ro135 = 76.63;
float Ro7   = 27.5;
float Ro2   = 9.83;

// ======================================================
// SENSOR CONFIGURATION
// ======================================================

const unsigned long SENSOR_INTERVAL = 30000UL;

// AQI threshold for buzzer
const int AQI_ALERT_LEVEL = 140;

// ======================================================
// TIMERS
// ======================================================

unsigned long lastSensorRead = 0;

// Current AQI
int currentAQI = 0;

// Buzzer timer
unsigned long lastBuzzerToggle = 0;

bool buzzerState = false;

// Buzzer beep interval
const unsigned long BUZZER_INTERVAL = 1000UL;

// ======================================================
// READ SENSOR RESISTANCE
// ======================================================

float readRs(int pin)
{
    int raw = analogRead(pin);

    float voltage = raw * (VCC / 1023.0);

    // Avoid division by zero
    if (voltage < 0.01)
    {
        voltage = 0.01;
    }

    float rs = ((VCC - voltage) / voltage) * RL_VALUE;

    return rs;
}

// ======================================================
// READ AVERAGE RS
// ======================================================

float readAverageRs(int pin, int samples)
{
    float total = 0;

    for (int i = 0; i < samples; i++)
    {
        total += readRs(pin);

        delay(20);
    }

    return total / samples;
}

// ======================================================
// PPM CALCULATION
// ======================================================

float getPPM(float ratio, float a, float b)
{
    if (ratio <= 0)
    {
        return 0;
    }

    return a * pow(ratio, b);
}

// ======================================================
// GAS CALCULATIONS
// ======================================================

float getCO2()
{
    float rs = readAverageRs(MQ135_PIN, 10);

    float ratio = rs / Ro135;

    return getPPM(
        ratio,
        116.6020682,
        -2.769034857
    );
}

// ======================================================
// CO CALCULATION
// ======================================================

float getCO()
{
    float rs = readAverageRs(MQ7_PIN, 10);

    float ratio = rs / Ro7;

    return getPPM(
        ratio,
        99.042,
        -1.518
    );
}

// ======================================================
// SMOKE CALCULATION
// ======================================================

float getSmoke()
{
    float rs = readAverageRs(MQ2_PIN, 10);

    float ratio = rs / Ro2;

    return getPPM(
        ratio,
        574.25,
        -2.222
    );
}

// ======================================================
// CO AQI
// ======================================================

int calcAQI_CO(float co)
{
    struct Breakpoint
    {
        float cLo;
        float cHi;
        int iLo;
        int iHi;
    };

    Breakpoint bp[] =
    {
        {0.0, 4.4,   0,   50},
        {4.5, 9.4,   51,  100},
        {9.5, 12.4,  101, 150},
        {12.5, 15.4, 151, 200},
        {15.5, 30.4, 201, 300},
        {30.5, 40.4, 301, 400},
        {40.5, 50.4, 401, 500}
    };

    int size = sizeof(bp) / sizeof(bp[0]);

    for (int i = 0; i < size; i++)
    {
        if (co >= bp[i].cLo && co <= bp[i].cHi)
        {
            float aqi =
                ((float)(bp[i].iHi - bp[i].iLo) /
                 (bp[i].cHi - bp[i].cLo))
                * (co - bp[i].cLo)
                + bp[i].iLo;

            return round(aqi);
        }
    }

    if (co > 50.4)
    {
        return 500;
    }

    return 0;
}

// ======================================================
// SMOKE AQI
// ======================================================

int calcAQI_Smoke(float smoke)
{
    struct Breakpoint
    {
        float cLo;
        float cHi;
        int iLo;
        int iHi;
    };

    Breakpoint bp[] =
    {
        {0.0,   30.0,  0,   50},
        {30.1,  60.0,  51,  100},
        {60.1,  90.0,  101, 200},
        {90.1,  120.0, 201, 300},
        {120.1, 250.0, 301, 400},
        {250.1, 500.0, 401, 500}
    };

    int size = sizeof(bp) / sizeof(bp[0]);

    for (int i = 0; i < size; i++)
    {
        if (smoke >= bp[i].cLo && smoke <= bp[i].cHi)
        {
            float aqi =
                ((float)(bp[i].iHi - bp[i].iLo) /
                 (bp[i].cHi - bp[i].cLo))
                * (smoke - bp[i].cLo)
                + bp[i].iLo;

            return round(aqi);
        }
    }

    if (smoke > 500)
    {
        return 500;
    }

    return 0;
}

// ======================================================
// BUZZER ON / OFF
// ======================================================

void buzzerOn()
{
    if (millis() - lastBuzzerToggle >= BUZZER_INTERVAL)
    {
        lastBuzzerToggle = millis();

        buzzerState = !buzzerState;

        digitalWrite(BUZZER_PIN, buzzerState);

        if (buzzerState)
        {
            Serial.println("BUZZER: ON");
        }
        else
        {
            Serial.println("BUZZER: OFF");
        }
    }
}

// ======================================================
// BUZZER OFF
// ======================================================

void buzzerOff()
{
    buzzerState = false;

    digitalWrite(BUZZER_PIN, LOW);
}

// ======================================================
// SETUP
// ======================================================

void setup()
{
    Serial.begin(9600);

    // Initialize buzzer
    pinMode(BUZZER_PIN, OUTPUT);

    // Keep buzzer OFF initially
    digitalWrite(BUZZER_PIN, LOW);

    delay(2000);

    Serial.println();
    Serial.println("==============================");
    Serial.println("     AIR QUALITY MONITOR");
    Serial.println("==============================");

    Serial.println("Buzzer initialized.");
    Serial.println("AQI Alert Level: 140");
    Serial.println("System ready.");
    Serial.println();
}

// ======================================================
// LOOP
// ======================================================

void loop()
{
    // ==================================================
    // SENSOR READING
    // ==================================================

    if (millis() - lastSensorRead >= SENSOR_INTERVAL)
    {
        lastSensorRead = millis();

        Serial.println();
        Serial.println("--------------------------------");

        // ==============================================
        // READ GAS SENSORS
        // ==============================================

        float co2 = getCO2();

        float co = getCO();

        float smoke = getSmoke();

        // ==============================================
        // CALCULATE AQI
        // ==============================================

        int aqiCO = calcAQI_CO(co);

        int aqiSmoke = calcAQI_Smoke(smoke);

        // Overall AQI
        currentAQI = max(aqiCO, aqiSmoke);

        // ==============================================
        // SERIAL OUTPUT
        // ==============================================

        Serial.print("MQ-135 CO2 : ");
        Serial.print(co2, 2);
        Serial.println(" ppm");

        Serial.print("MQ-7 CO    : ");
        Serial.print(co, 2);
        Serial.println(" ppm");

        Serial.print("MQ-2 Smoke : ");
        Serial.print(smoke, 2);
        Serial.println(" ppm");

        Serial.print("CO AQI     : ");
        Serial.println(aqiCO);

        Serial.print("Smoke AQI  : ");
        Serial.println(aqiSmoke);

        Serial.print("Overall AQI: ");
        Serial.println(currentAQI);

        // ==============================================
        // AQI CATEGORY
        // ==============================================

        if (currentAQI <= 50)
        {
            Serial.println("Air Quality: GOOD");
        }
        else if (currentAQI <= 100)
        {
            Serial.println("Air Quality: MODERATE");
        }
        else if (currentAQI <= 150)
        {
            Serial.println(
                "Air Quality: UNHEALTHY FOR SENSITIVE GROUPS"
            );
        }
        else if (currentAQI <= 200)
        {
            Serial.println("Air Quality: UNHEALTHY");
        }
        else if (currentAQI <= 300)
        {
            Serial.println("Air Quality: VERY UNHEALTHY");
        }
        else
        {
            Serial.println("Air Quality: HAZARDOUS");
        }

        Serial.println("--------------------------------");
    }

    // ==================================================
    // BUZZER CONTROL
    // ==================================================

    if (currentAQI > AQI_ALERT_LEVEL)
    {
        // AQI > 140
        buzzerOn();
    }
    else
    {
        // AQI <= 140
        buzzerOff();
    }
}