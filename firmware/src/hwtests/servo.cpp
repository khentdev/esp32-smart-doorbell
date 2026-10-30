// Stage 5 — servo on charger power: sweeps closed <-> open every 2 s.
// Run before attaching the horn to the door.
#include <Arduino.h>
#include <ESP32Servo.h>
#include "pins.h"

Servo servo;

void setup() {
  Serial.begin(115200);
  servo.setPeriodHertz(50);
  servo.attach(PIN_SERVO, 500, 2400);
}

void loop() {
  Serial.printf("-> %d deg\n", SERVO_OPEN_DEG);
  servo.write(SERVO_OPEN_DEG);
  delay(2000);
  Serial.printf("-> %d deg\n", SERVO_CLOSED_DEG);
  servo.write(SERVO_CLOSED_DEG);
  delay(2000);
}
