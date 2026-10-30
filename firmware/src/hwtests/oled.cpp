// Stage 2 — OLED: shows "Hello" and an uptime counter.
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "pins.h"

Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

void setup() {
  Serial.begin(115200);
  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    Serial.println("OLED not found — check SDA/SCL, or try address 0x3D in pins.h");
    while (true) delay(1000);
  }
  Serial.println("OLED OK");
}

void loop() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println("Hello");
  display.setTextSize(1);
  display.setCursor(0, 32);
  display.printf("uptime %lus", millis() / 1000);
  display.display();
  delay(1000);
}
