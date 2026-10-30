// Real door firmware: fingerprint -> local unlock sequence -> POST /door/access,
// plus GET /door/commands polling for dashboard unlocks and fingerprint enroll/delete jobs.
// The physical action always runs first so a slow or dead backend never delays the door.
#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_Fingerprint.h>
#include <ESP32Servo.h>
#include "pins.h"
#include "secrets.h"

const unsigned long HOLD_OPEN_MS = 5000;
const unsigned long WIFI_TIMEOUT_MS = 15000;
const unsigned long COMMAND_POLL_MS = 3000;
const unsigned long ENROLL_STEP_TIMEOUT_MS = 20000;  // well inside the backend's 120 s job timeout
const uint16_t HTTP_TIMEOUT_MS = 5000;

HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
Servo servo;
bool hasDisplay = false;
unsigned long lastPollMs = 0;

enum CommandType { CMD_NONE, CMD_UNLOCK, CMD_ENROLL, CMD_DELETE };

struct Command {
  CommandType type = CMD_NONE;
  String jobId;
  int slot = 0;
};

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

void connectWifi() {
  show("Connecting WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) delay(250);
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WiFi connected, IP %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("WiFi failed, running offline");
  }
}

bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.reconnect();
  return false;
}

// POSTs a JSON body to the backend and returns the HTTP status (negative on a network error).
int postJson(const String &path, const char *body) {
  if (!ensureWifi()) return -1;
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(String(API_BASE_URL) + path);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", DEVICE_API_KEY);
  int code = http.POST(body);
  http.end();
  return code;
}

// Reports an access event. slot < 0 omits fingerprintSlot (DENIED / ADMIN_UNLOCK).
void postAccess(const char *outcome, int slot) {
  char body[128];
  if (slot >= 0) {
    snprintf(body, sizeof(body), "{\"deviceId\":\"%s\",\"outcome\":\"%s\",\"fingerprintSlot\":%d}",
             DEVICE_ID, outcome, slot);
  } else {
    snprintf(body, sizeof(body), "{\"deviceId\":\"%s\",\"outcome\":\"%s\"}", DEVICE_ID, outcome);
  }
  Serial.printf("POST /door/access %s -> %d\n", outcome, postJson("/door/access", body));
}

// Reports a fingerprint job step or result. Returns false if the backend gave up on the job
// (409 FINGERPRINT_JOB_NOT_ACTIVE), so the flow should stop. Network errors don't stop it.
bool reportStep(const String &jobId, const char *step, const char *error = nullptr) {
  char body[128];
  if (error) {
    snprintf(body, sizeof(body), "{\"deviceId\":\"%s\",\"step\":\"%s\",\"error\":\"%s\"}",
             DEVICE_ID, step, error);
  } else {
    snprintf(body, sizeof(body), "{\"deviceId\":\"%s\",\"step\":\"%s\"}", DEVICE_ID, step);
  }
  int code = postJson("/door/jobs/" + jobId + "/progress", body);
  Serial.printf("job %s %s -> %d\n", jobId.c_str(), step, code);
  return code != 409 && code != 404;
}

Command pollCommand() {
  Command cmd;
  if (!ensureWifi()) return cmd;
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(String(API_BASE_URL) + "/door/commands?deviceId=" + DEVICE_ID);
  http.addHeader("X-API-Key", DEVICE_API_KEY);
  int code = http.GET();
  if (code == 200) {
    JsonDocument doc;
    if (deserializeJson(doc, http.getString()) == DeserializationError::Ok) {
      const char *type = doc["command"] | "";
      if (strcmp(type, "UNLOCK") == 0) cmd.type = CMD_UNLOCK;
      else if (strcmp(type, "ENROLL") == 0) cmd.type = CMD_ENROLL;
      else if (strcmp(type, "DELETE") == 0) cmd.type = CMD_DELETE;
      cmd.jobId = doc["jobId"] | "";
      cmd.slot = doc["slot"] | 0;
    }
  } else {
    Serial.printf("GET /door/commands -> %d\n", code);
  }
  http.end();
  return cmd;
}

// The servo is attached only while it moves: a fresh PWM channel on every unlock, so nothing
// during a long idle stretch (WiFi, HTTP) can leave it without a signal, and no holding current.
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

// Waits for a finger and converts the image into char buffer `buffer` (1 or 2).
// Returns nullptr on success, or the backend error code.
const char *capture(uint8_t buffer) {
  unsigned long start = millis();
  while (finger.getImage() != FINGERPRINT_OK) {
    if (millis() - start > ENROLL_STEP_TIMEOUT_MS) return "TIMEOUT";
    delay(50);
  }
  if (finger.image2Tz(buffer) != FINGERPRINT_OK) return "BAD_IMAGE";
  return nullptr;
}

bool waitForLift() {
  unsigned long start = millis();
  while (finger.getImage() != FINGERPRINT_NOFINGER) {
    if (millis() - start > ENROLL_STEP_TIMEOUT_MS) return false;
    delay(50);
  }
  return true;
}

void enrollFailed(const String &jobId, const char *error, const char *msg) {
  digitalWrite(PIN_LED_RED, HIGH);
  show(msg);
  beep(600);
  reportStep(jobId, "FAILED", error);
  delay(1500);
  digitalWrite(PIN_LED_RED, LOW);
  show("Scan your finger");
}

// Dashboard enrollment: same two-scan flow as the old USB tool, reporting each step.
void enrollFlow(const String &jobId, int slot) {
  Serial.printf("Enrolling into slot %d\n", slot);

  show("Place finger");
  if (!reportStep(jobId, "PLACE_FINGER")) return show("Scan your finger");
  const char *err = capture(1);
  if (err) return enrollFailed(jobId, err, strcmp(err, "TIMEOUT") == 0 ? "No finger, try again" : "Bad read, try again");
  beep(100);

  show("Remove finger");
  if (!reportStep(jobId, "REMOVE_FINGER")) return show("Scan your finger");
  if (!waitForLift()) return enrollFailed(jobId, "TIMEOUT", "Finger not removed");

  show("Place same finger again");
  if (!reportStep(jobId, "PLACE_AGAIN")) return show("Scan your finger");
  err = capture(2);
  if (err) return enrollFailed(jobId, err, strcmp(err, "TIMEOUT") == 0 ? "No finger, try again" : "Bad read, try again");
  beep(100);
  waitForLift();

  if (finger.createModel() != FINGERPRINT_OK) return enrollFailed(jobId, "MISMATCH", "Prints did not match");
  if (finger.storeModel(slot) != FINGERPRINT_OK) return enrollFailed(jobId, "STORE_FAILED", "Store failed");

  digitalWrite(PIN_LED_GREEN, HIGH);
  show("Enrolled!");
  beep(100);
  delay(100);
  beep(100);
  reportStep(jobId, "SUCCEEDED");
  delay(1500);
  digitalWrite(PIN_LED_GREEN, LOW);
  show("Scan your finger");
}

void deleteFlow(const String &jobId, int slot) {
  Serial.printf("Deleting slot %d\n", slot);
  if (finger.deleteModel(slot) == FINGERPRINT_OK) {
    reportStep(jobId, "SUCCEEDED");
  } else {
    reportStep(jobId, "FAILED", "DELETE_FAILED");
  }
}

void runCommand(const Command &cmd) {
  switch (cmd.type) {
    case CMD_UNLOCK:
      unlockSequence();
      postAccess("ADMIN_UNLOCK", -1);
      break;
    case CMD_ENROLL:
      enrollFlow(cmd.jobId, cmd.slot);
      break;
    case CMD_DELETE:
      deleteFlow(cmd.jobId, cmd.slot);
      break;
    case CMD_NONE:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  digitalWrite(PIN_RELAY, RELAY_OFF);
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);

  // Reserve the LEDC timers for servo PWM up front, as the ESP32Servo examples do.
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

  connectWifi();
  show("Scan your finger");
}

void loop() {
  if (finger.getImage() != FINGERPRINT_OK) {
    // No finger on the sensor: a good moment to check for a dashboard command.
    if (millis() - lastPollMs >= COMMAND_POLL_MS) {
      lastPollMs = millis();
      Command cmd = pollCommand();
      if (cmd.type != CMD_NONE) {
        runCommand(cmd);
        lastPollMs = millis();
      }
    }
    delay(50);
    return;
  }
  if (finger.image2Tz() != FINGERPRINT_OK) {
    show("Bad read, try again");
    return;
  }
  if (finger.fingerSearch() == FINGERPRINT_OK) {
    int slot = finger.fingerID;
    Serial.printf("match slot %d\n", slot);
    unlockSequence();
    postAccess("GRANTED", slot);
  } else {
    denied();
    postAccess("DENIED", -1);
  }
  while (finger.getImage() != FINGERPRINT_NOFINGER) delay(50);
}
