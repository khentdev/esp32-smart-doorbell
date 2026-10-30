// Stage 3 — LEDs + buzzer: green, then red, then a beep, repeating.
#include <Arduino.h>
#include "pins.h"

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
}

void loop() {
  Serial.println("green");
  digitalWrite(PIN_LED_GREEN, HIGH);
  delay(700);
  digitalWrite(PIN_LED_GREEN, LOW);

  Serial.println("red");
  digitalWrite(PIN_LED_RED, HIGH);
  delay(700);
  digitalWrite(PIN_LED_RED, LOW);

  Serial.println("beep");
  digitalWrite(PIN_BUZZER, HIGH);
  delay(200);
  digitalWrite(PIN_BUZZER, LOW);
  delay(1000);
}
