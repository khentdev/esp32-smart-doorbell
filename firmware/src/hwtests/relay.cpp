// Stage 6/7 — relay (then solenoid): ON for SOLENOID_PULSE_MS, OFF 4 s, repeating.
// If the relay is on for 4 s and off for 1 s instead, your module is active-HIGH:
// swap RELAY_ON / RELAY_OFF in pins.h.
#include <Arduino.h>
#include "pins.h"

void setup() {
  Serial.begin(115200);
  digitalWrite(PIN_RELAY, RELAY_OFF);  // set level before enabling output so it doesn't blip on
  pinMode(PIN_RELAY, OUTPUT);
}

void loop() {
  Serial.printf("relay ON  (pin %s)\n", RELAY_ON == LOW ? "LOW" : "HIGH");
  digitalWrite(PIN_RELAY, RELAY_ON);
  delay(SOLENOID_PULSE_MS);
  Serial.println("relay OFF");
  digitalWrite(PIN_RELAY, RELAY_OFF);
  delay(4000);
}
