// Stage 1 — ESP32 alone: onboard LED blinks, Serial prints "alive".
#include <Arduino.h>
#include "pins.h"

void setup() {
  Serial.begin(115200);
  pinMode(PIN_ONBOARD_LED, OUTPUT);
}

void loop() {
  digitalWrite(PIN_ONBOARD_LED, HIGH);
  Serial.println("alive");
  delay(500);
  digitalWrite(PIN_ONBOARD_LED, LOW);
  delay(500);
}
