// Stage 4a — fingerprint sensor: detect it, then report match/no-match per scan.
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
    Serial.println("Did not find fingerprint sensor — check power and that TX/RX are crossed");
    while (true) delay(1000);
  }
  Serial.println("Found fingerprint sensor!");
  finger.getTemplateCount();
  Serial.printf("Enrolled templates: %d\n", finger.templateCount);
  Serial.println("Place a finger...");
}

void loop() {
  if (finger.getImage() != FINGERPRINT_OK) {
    delay(50);
    return;
  }
  if (finger.image2Tz() != FINGERPRINT_OK) {
    Serial.println("Bad image, try again");
    return;
  }
  if (finger.fingerSearch() == FINGERPRINT_OK) {
    Serial.printf("MATCH slot %d (confidence %d)\n", finger.fingerID, finger.confidence);
  } else {
    Serial.println("NO MATCH");
  }
  while (finger.getImage() != FINGERPRINT_NOFINGER) delay(50);  // wait for lift
}
