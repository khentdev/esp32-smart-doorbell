## Hardware Requirements

### Overview

| Field | Details |
|---|---|
| **Controller** | ESP32 Development Board |
| **Input** | Fingerprint scanner (R307/AS608 class, UART) |
| **Outputs** | 12V solenoid lock (via relay), MG996R servo, OLED display, buzzer, LED |
| **Power domains** | 5V (ESP32 + sensor), 5V separate (servo), 12V (solenoid) |
| **Connectivity** | WiFi 2.4GHz only (ESP32 limitation) — phone hotspot supported |

---

### 1. Components Purchased

#### Fingerprint Scanner (R307 / AS608 class)
**Function:** The sole input trigger of the system. Captures a fingerprint image, matches it against templates stored in its own onboard flash, and reports the result to the ESP32 over UART. Replaces the push button from the original design.

| Spec | Value | Why it matters |
|---|---|---|
| Supply voltage | 3.8 – 7.0V | Must use the ESP32's **5V** pin, not 3.3V — 3.3V falls below the minimum |
| Current draw | <60mA operating, <85mA peak | Low enough to run off the ESP32's 5V rail without a separate supply |
| Interface | UART (TTL), 57600 bps default | Wired to ESP32 hardware serial (UART2) — sensor TX → ESP32 RX, sensor RX → ESP32 TX (**they cross**) |
| Storage capacity | 240 templates | Templates live on the sensor, **not** in PostgreSQL — this is why no fingerprint data appears in the database schema |
| Image input time | <0.5s | Scan feels instant to the user |
| Search time | <220ms (1:240 avg) | Matching latency is negligible compared to the door mechanism |
| Security level | 3 (of 5) | Default; FAR <0.001%, FRR <1.0% |

**Design consequence of FRR <1.0%:** roughly 1 in 100 legitimate scans will be falsely rejected. This is inherent to fingerprint sensors, not a defect. The access flow must allow immediate rescan rather than treating a single failed read as a final denial — and it is the reason the old 3-second debounce rule (written for a mashed button) is **removed** from this design.

**Library:** Adafruit Fingerprint Sensor Library (Arduino IDE → Library Manager).

---

#### 12V Solenoid Lock
**Function:** Physically releases the door latch when energized. First actuator in the unlock sequence.

| Spec | Value | Why it matters |
|---|---|---|
| Voltage | 12V DC | Separate power domain — cannot be driven by ESP32 GPIO |
| Current | 0.6A | Comfortably within the 12V 3A supply |
| Unlocking time | ~1s | Code must hold the relay closed ~1s for the latch to fully retract |
| **Energized form** | **Intermittent** | **Must not be left powered.** Rated for <10s continuous — longer risks overheating the coil |
| Latch travel | 10mm | Strike plate alignment must be accurate within a few mm; mockup should use slotted holes for adjustability |
| Size / weight | 53 × 26 × 23mm, 142g | Cabinet-scale lock — suited to a demo door mockup, not a full household door |

**Design consequence of the intermittent rating:** the solenoid is energized only during the moment of release, then de-energized while the servo takes over. Once the door has physically swung open, the latch re-extends into empty air and needs no holding power.

---

#### MG996R Servo Motor (Metal Gear, 180°)
**Function:** Swings the door open after the solenoid has released the latch, and swings it closed again before re-locking. Second actuator in the sequence.

| Spec | Value | Why it matters |
|---|---|---|
| Rotation | 180° (positional) | **Not** the 360° continuous-rotation variant — positional control is required to command "open" and "closed" angles |
| Stall torque | 9.4 kg·cm (4.8V) / 11 kg·cm (6.0V) | Sufficient for a lightweight demo door; torque drops with lever-arm length, so mount the horn close to the hinge |
| Operating voltage | 4.8 – 6V | **Requires its own 5V supply** — current spikes under load will brown out the ESP32 if run from its 5V pin |
| Gear type | Metal | Survives shock loads (door catching, hitting end stops) that strip plastic gears irreversibly |
| Operating speed | 0.15 – 0.19 s/60° | Full door swing completes in well under a second |

**Wiring:** red → separate 5V supply, brown/black → ground **shared with the ESP32** (common ground is required for the PWM signal to have a reference), orange/yellow → ESP32 GPIO (signal only).

---

#### 12V 3A Power Adapter
**Function:** Dedicated supply for the solenoid's 12V domain, isolated from the ESP32's logic power.

| Spec | Value | Why it matters |
|---|---|---|
| Output | 12V DC, 3A | 0.6A is the solenoid's steady draw; the headroom covers inrush at switch-on and leaves room to step down for the servo later |
| Input | 100–240V AC | Standard mains |
| Connector | 5.5 × 2.1mm barrel (male) | Requires a female barrel-to-screw-terminal adapter to connect to the relay and solenoid |
| Protections | Short circuit, overload, overheat | Relevant since this is the only mains-connected part of the build |

---

#### DC Barrel Jack Adapter (Female, 5.5 × 2.1mm, screw terminal)
**Function:** Converts the power adapter's barrel plug into bare screw terminals so the 12V line can be wired into the relay and solenoid.

Without it the barrel plug has nothing to connect to — the relay has screw terminals and the solenoid has bare leads. Using the adapter instead of cutting the plug off keeps the supply reusable and removes a chance of reversing polarity at the 12V stage, the one point in this build where a wiring mistake can destroy components.

---

#### 1N4007 Flyback Diode
**Function:** Protects the relay contacts from the voltage spike generated when the solenoid is de-energized.

When power is cut to the solenoid, its collapsing magnetic field produces a reverse voltage spike. The diode gives that spike a loop to dissipate in rather than arcing across the relay contacts, which degrades them over time.

**Wiring:** placed **across the solenoid's two terminals**, reverse-biased — striped end (cathode) to the **+12V** side, plain end (anode) to the **ground** side. It does nothing during normal operation and conducts only during the spike. Installed backwards it shorts the 12V supply the moment the relay closes, so stripe orientation must be verified before first power-up.

Rated 1000V / 1A — far beyond what a 0.6A coil demands. (1N4001 and 1N4005 are the same part at lower voltage ratings; 1N4007 is specified for maximum headroom at identical cost.)

---

### 2. Components Reused from Starter Kit

#### ESP32 Development Board
**Function:** The system's controller. Reads the fingerprint sensor over UART, drives the relay, servo, OLED, buzzer and LED, and sends access events to the backend over WiFi.

Chosen over a separate Arduino because WiFi is built in — no shield or bridge board required. Note: **2.4GHz WiFi only**; it cannot connect to 5GHz networks, including phone hotspots set to 5GHz.

#### 0.96" OLED Display (SSD1306, I2C)
**Function:** On-device status display. The fingerprint module has no screen of its own, so the OLED carries all local user-facing text: scan prompts, enrollment instructions ("place finger", "remove finger", "place same finger again"), and access results ("Access granted", "Access denied").

Promoted from unused kit part to a core component — it is the primary feedback channel during enrollment, which cannot be driven by LED blink patterns alone.

**Wiring:** VCC → 3.3V, GND → GND, SDA → GPIO21, SCL → GPIO22 (ESP32 default I2C pins).
**Libraries:** Adafruit SSD1306 + Adafruit GFX.

#### 5V 2-Channel Relay Module
**Function:** Switches the 12V solenoid circuit under ESP32 control. The ESP32's GPIO cannot supply 12V or the solenoid's current; the relay isolates the logic side from the power side, letting a 3.3V signal switch a 12V load.

One channel is used for the solenoid; the second remains unused.

#### Active Buzzer
**Function:** Audible feedback at the door — distinct patterns for scan accepted, scan rejected, and enrollment step completion. Complements the OLED for users not looking directly at the screen.

#### LEDs + 220Ω Resistors
**Function:** At-a-glance visual status (e.g. green for granted, red for denied). Resistors limit current to protect the LEDs.

#### Breadboard + Dupont Cables (M-M, M-F, F-F)
**Function:** Solderless prototyping of all connections. The F-M cables are needed for module-to-breadboard connections (fingerprint sensor, OLED, relay all have male header pins).

---

### 3. Components Not Used

Included in the starter kit but outside this project's scope: obstacle avoidance module, photosensitive resistor module, DHT11 temperature/humidity module, HC-SR501 PIR motion sensor, potentiometer, passive buzzer, RGB LEDs, button switches.

The button switches are explicitly retired — the fingerprint scanner replaces the push button as the system's trigger.

---

### 4. Power Architecture

Three separate power domains share a common ground:

| Domain | Source | Powers |
|---|---|---|
| 5V (logic) | USB or 5V adapter → ESP32 | ESP32, fingerprint sensor, OLED, relay coil, buzzer, LED |
| 5V (motor) | Separate 5V supply | MG996R servo only |
| 12V | 12V 3A adapter → barrel adapter → relay | Solenoid lock only |

**Common ground is mandatory.** All three domains must share a ground reference, or the PWM signal to the servo and the trigger signal to the relay have no reference level and will behave unpredictably.

**Why the servo is isolated:** at 9.4–11 kg·cm stall torque, the current spike when the servo starts moving or meets resistance will brown out the ESP32 if they share a rail — causing a reset mid-unlock, the worst possible moment for one.

---

### 5. Known Constraints

- **Scale:** the solenoid is a cabinet-grade lock and the servo is a hobby-grade actuator. Together they suit a lightweight demo door mockup, not a real household door.
- **Mounting tolerance:** the 10mm latch travel leaves little margin for misalignment. The mockup should allow adjustment (slotted screw holes) rather than fixing the strike plate rigidly on the first attempt.
- **Door weight:** usable servo force falls as the lever arm lengthens. The door mockup should be built as light as practical, with the servo horn mounted close to the hinge.
- **Network:** ESP32 supports 2.4GHz WiFi only. A phone hotspot works as the demo network provided it is not set to 5GHz.
