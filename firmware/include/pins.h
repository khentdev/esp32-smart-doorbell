#pragma once

// Single source of truth for the wiring.
// Must match the pin map in docs/esp32-smart-door/Hardware Setup Guide.md §1.

// OLED SSD1306 (I2C, powered from 3V3)
#define PIN_OLED_SDA 21
#define PIN_OLED_SCL 22
#define OLED_I2C_ADDR 0x3C
#define OLED_WIDTH 128
#define OLED_HEIGHT 64

// Fingerprint sensor on UART2 (powered from 5V/VIN). TX/RX cross:
// sensor TX -> PIN_FP_RX, sensor RX -> PIN_FP_TX.
// WROVER boards: GPIO16/17 are used by PSRAM — change to 4/5.
#define PIN_FP_RX 16
#define PIN_FP_TX 17
#define FP_BAUD 57600

// Relay IN1 -> solenoid. Most 5V relay modules are active-LOW.
#define PIN_RELAY 26
#define RELAY_ON LOW
#define RELAY_OFF HIGH

// MG996R servo signal only; its power comes from the separate USB charger.
#define PIN_SERVO 18
#define SERVO_CLOSED_DEG 0
#define SERVO_OPEN_DEG 60

// Local feedback
#define PIN_BUZZER 25
#define PIN_LED_GREEN 32
#define PIN_LED_RED 33

// Onboard LED on most ESP32 DevKit boards
#define PIN_ONBOARD_LED 2

// Latch retract time before the servo opens (also the relay hwtest pulse). During unlock the
// solenoid then stays energized until the servo has closed.
#define SOLENOID_PULSE_MS 1000
