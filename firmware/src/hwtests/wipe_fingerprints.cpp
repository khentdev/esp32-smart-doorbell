// One-time reset (USB-serial): clears every template on the sensor so it matches the
// dashboard's empty fingerprint list. Type `y` in Serial Monitor to confirm.
#include <Arduino.h>
#include <Adafruit_Fingerprint.h>
#include "pins.h"

HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

void setup() {
  Serial.begin(115200);
  fpSerial.begin(FP_BAUD, SERIAL_8N1, PIN_FP_RX, PIN_FP_TX);
  finger.begin(FP_BAUD);
  if (!finger.verifyPassword()) {
    Serial.println("Fingerprint sensor not found");
    while (true) delay(1000);
  }
  finger.getTemplateCount();
  Serial.printf("Sensor has %d enrolled templates.\n", finger.templateCount);
  Serial.println("Type y and press Enter to delete ALL of them:");
}

void loop() {
  if (!Serial.available()) return delay(20);
  char c = Serial.read();
  while (Serial.available()) Serial.read();
  if (c != 'y' && c != 'Y') {
    Serial.println("Cancelled. Type y to wipe.");
    return;
  }
  if (finger.emptyDatabase() == FINGERPRINT_OK) {
    Serial.println("Sensor cleared. Upload env:app and enroll from the dashboard.");
  } else {
    Serial.println("Wipe failed, try again.");
  }
  while (true) delay(1000);
}
