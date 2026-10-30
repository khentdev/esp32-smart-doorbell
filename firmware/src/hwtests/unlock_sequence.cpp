// Stage 8 — full local sequence, no WiFi:
// scan -> (match) relay on -> servo open -> hold -> servo close -> relay off.
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_Fingerprint.h>
#include <ESP32Servo.h>
#include "pins.h"

const unsigned long HOLD_OPEN_MS = 5000;

HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
Servo servo;
bool hasDisplay = false;

void show(const char *msg) {
  Serial.println(msg);
  if (!hasDisplay) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(msg);
  display.display();
}

void beep(int ms) {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(ms);
  digitalWrite(PIN_BUZZER, LOW);
}

// Same as app: attach only while moving.
void attachServo() {
  int channel = servo.attach(PIN_SERVO, 500, 2400);
  Serial.printf("servo attach -> channel %d (attached=%d)\n", channel, servo.attached());
}

void moveServo(int deg) {
  servo.write(deg);
  Serial.printf("servo -> %d deg (attached=%d)\n", deg, servo.attached());
}

void unlockSequence() {
  digitalWrite(PIN_LED_GREEN, HIGH);
  show("Access granted");
  beep(100);
  attachServo();

  digitalWrite(PIN_RELAY, RELAY_ON);  // solenoid retracts the latch
  delay(SOLENOID_PULSE_MS);           // let the latch clear before the servo pushes
  moveServo(SERVO_OPEN_DEG);

  delay(HOLD_OPEN_MS);
  moveServo(SERVO_CLOSED_DEG);
  delay(1000);                        // close travel
  digitalWrite(PIN_RELAY, RELAY_OFF); // latch re-engages with the door shut
  servo.detach();

  digitalWrite(PIN_LED_GREEN, LOW);
  show("Scan your finger");
}

void denied() {
  digitalWrite(PIN_LED_RED, HIGH);
  show("Access denied");
  beep(600);
  delay(1000);
  digitalWrite(PIN_LED_RED, LOW);
  show("Scan your finger");
}

void setup() {
  Serial.begin(115200);
  digitalWrite(PIN_RELAY, RELAY_OFF);
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);

  for (int timer = 0; timer < 4; timer++) ESP32PWM::allocateTimer(timer);
  servo.setPeriodHertz(50);
  attachServo();
  moveServo(SERVO_CLOSED_DEG);  // start closed
  delay(500);
  servo.detach();

  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  hasDisplay = display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR);

  fpSerial.begin(FP_BAUD, SERIAL_8N1, PIN_FP_RX, PIN_FP_TX);
  finger.begin(FP_BAUD);
  if (!finger.verifyPassword()) {
    show("Fingerprint sensor not found");
    while (true) delay(1000);
  }
  show("Scan your finger");
}

void loop() {
  if (finger.getImage() != FINGERPRINT_OK) {
    delay(50);
    return;
  }
  if (finger.image2Tz() != FINGERPRINT_OK) {
    show("Bad read, try again");
    return;
  }
  if (finger.fingerSearch() == FINGERPRINT_OK) {
    Serial.printf("match slot %d\n", finger.fingerID);
    unlockSequence();
  } else {
    denied();
  }
  while (finger.getImage() != FINGERPRINT_NOFINGER) delay(50);
}
