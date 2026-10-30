## Hardware Setup Guide

Step-by-step wiring and bring-up for the parts in [[hardware-requirements]]. Build and test **one stage at a time** (section 5) — never wire everything and power it all at once.

The ESP32 code lives in `firmware/` in this repo and is built with the **PlatformIO** VS Code extension (no Arduino IDE). Pin numbers are defined once in `firmware/include/pins.h`; if you change a pin, change it there and in the table below.

---

### 0. Safety Rules

- **Unplug everything before moving any wire.** Plug power in only after re-checking the wiring.
- **12V never touches the breadboard or the ESP32.** It only runs between the barrel adapter, the relay's screw terminals and the solenoid.
- **Grounds:** ESP32 GND and the servo charger's GND must be joined. The 12V side stays separate — the relay isolates it, so it needs no wire to the breadboard.
- Check the **1N4007 diode direction** before the first 12V power-up. Backwards, it shorts the 12V supply.

---

### 1. Pin Map

All pins are safe (non-boot) pins on an ESP32-WROOM DevKit board.

| Part | Part pin | Goes to |
|---|---|---|
| OLED SSD1306 | VCC / GND / SDA / SCL | **3V3** / GND / **GPIO21** / **GPIO22** |
| Fingerprint R307/AS608 | V+ (usually red) / GND (usually black) | **5V (VIN)** / GND |
| | TX (usually yellow) | **GPIO16** (ESP32 RX2) |
| | RX (usually green or white) | **GPIO17** (ESP32 TX2) |
| | Extra wires (Touch, 3.3VT), if any | Not connected — tape the ends |
| Relay module (5V, 2-channel) |` VCC / GND / IN1 | **5V (VIN)** / GND / **GPIO26** (IN2 unused) |
| Servo MG996R | Orange (signal) | **GPIO18** |
| | Red (+) / Brown (−) | **Charger red (+5V)** / **charger black + ESP32 GND** |
| Active buzzer | + (longer leg / marked +) / − | **GPIO25** / GND |
| Green LED | Long leg (anode) through 220Ω | **GPIO32**; short leg → GND |
| Red LED | Long leg (anode) through 220Ω | **GPIO33**; short leg → GND |

**Notes**
- Fingerprint wire colours vary by seller — trust the label on the sensor's PCB or the seller's diagram over the colours.
- TX/RX **cross**: sensor TX → ESP32 RX (GPIO16), sensor RX → ESP32 TX (GPIO17).
- Some AS608 clones are 3.3V-only. If the datasheet says so, use **3V3** instead of 5V.
- If the ESP32 module is labelled **WROVER**, GPIO16/17 are used internally — use GPIO4/5 and update `pins.h`.

---

### 2. Preparing the USB-A → USB-C Cable (servo power)

The servo is powered from a **separate** wall charger through a cut USB cable. The USB-A end plugs into the charger; the Type-C end is cut off.

1. **Where to cut:** about **10–15 cm from the Type-C plug**. Discard the short Type-C piece; keep the long USB-A side.
2. **Strip the outer jacket** about 3 cm back. Score it lightly with a cutter and peel it off so the wires inside aren't nicked.
3. **Identify the wires:** usually **red, black, white, green**, possibly foil or bare braided shielding, and on USB-C cables sometimes extra thin wires.
   - Keep **red (+5V)** and **black (GND)**.
   - Cut every other wire (white, green, shield, extras) short, at staggered lengths, and tape over them so they can't touch anything.
   - Some charge-only cables have just red and black — that's fine.
4. **Prepare the ends:** strip 5–8 mm off red and black and twist the strands tight. Best: solder each to a male header pin (or crimp a male Dupont pin) so it plugs firmly into the breadboard. A screw-terminal block also works. Avoid pushing bare twisted wire into the breadboard — it works loose under the servo's current.
5. **Verify with a multimeter before connecting the servo:** plug the USB-A end into the charger, set the meter to DC 20V, red probe on the red wire, black probe on the black wire. Expect **about +5V**. A reading of −5V means the colours are swapped — label them. Unplug the charger.
6. **Charger requirements:** 5V, **2A or more** (check the label), and **not** the same charger that powers the ESP32.

---

### 3. Breadboard Layout

- Seat the ESP32 across the centre gap. Most DevKit boards are too wide to leave free holes on both sides — use **two breadboards side by side**, or run F-M jumpers from the board's pins.
- Many breadboards split each power rail in the middle (a gap in the red/blue line). Check for it, or bridge it with a jumper.

| Rail | + connects to | − connects to | Feeds |
|---|---|---|---|
| **Rail A** (servo) | Charger red (+5V) | Charger black | Servo red/brown only |
| **Rail B** (logic) | ESP32 **5V/VIN** pin | ESP32 **GND** | Fingerprint V+, relay VCC, all GND returns |

- **Jumper Rail A − to Rail B −.** This is the common ground. Without it, the servo twitches randomly or ignores commands.
- **Never connect Rail A + to Rail B +.**
- The OLED's VCC goes straight to the ESP32 **3V3** pin, not to either 5V rail.
- Optional: a 470–1000µF electrolytic capacitor across Rail A + and −, close to the servo (striped/negative leg to −), to smooth start-up spikes.

---

### 4. VS Code + PlatformIO Setup (one time)

1. In VS Code, open the Extensions panel, search **"PlatformIO IDE"**, install it, and restart VS Code. The first start downloads the ESP32 toolchain, which takes a few minutes.
2. Open the firmware project: **File → Open Folder → `firmware/`**. To keep the web app open too, use **File → Add Folder to Workspace → `firmware/`** instead.
3. In the bottom status bar, use the **environment selector** (shows `env:…` / `Default`) to pick which program to build, then **→ (Upload)** to flash it and **🔌 (Serial Monitor)** to see its output. Libraries download automatically on the first build.
4. Plug the ESP32 into the laptop with a **data-capable** USB cable. If no COM port appears, install the USB driver for the chip next to the board's USB port (**CP210x** or **CH340**).
5. If an upload hangs at `Connecting…`, hold the board's **BOOT** button until the upload starts.

| Environment | Program | Stage |
|---|---|---|
| `test-blink` | Onboard LED blinks, prints `alive` | 1 |
| `test-oled` | Shows "Hello" + uptime | 2 |
| `test-leds-buzzer` | Green → red → beep, repeating | 3 |
| `test-fingerprint` | Detects the sensor, prints `MATCH slot N` / `NO MATCH` per scan | 4 |
| `test-servo` | Sweeps 0° ↔ 90° every 2 s | 5 |
| `test-relay` | Relay ON 1 s / OFF 4 s, repeating | 6–7 |
| `test-unlock-sequence` | Full local sequence: scan → solenoid → servo open → hold → close | 8 |
| `wipe-fingerprints` | One-time: clears every fingerprint stored on the sensor (type `y` in Serial Monitor) | 5b |
| `app` | The real door firmware: scans, dashboard unlock, dashboard enrollment | 5b |

Fingerprints are enrolled from the dashboard (Settings → Fingerprints), not from a firmware env.

---

### 5. Build Order

The ESP32 stays powered from the laptop's USB the whole time — that is also how code is uploaded.

1. **ESP32 alone.** Nothing wired. Upload `test-blink`. ✅ Onboard LED blinks; Serial Monitor prints `alive`.
2. **OLED.** Wire VCC/GND/SDA/SCL per the pin map. Upload `test-oled`. ✅ Screen shows "Hello".
3. **LEDs + buzzer.** Wire both LEDs (each through a 220Ω resistor) and the buzzer. Upload `test-leds-buzzer`. ✅ Green, red, beep.
4. **Fingerprint sensor.** Wire it to Rail B and GPIO16/17. Upload `test-fingerprint`. ✅ Prints `Found fingerprint sensor!` and the number of enrolled templates; any scan prints `NO MATCH` until someone is enrolled from the dashboard (5b).
5. **Servo (charger power).** Prepare the cable (section 2). Connect charger red/black to Rail A, servo red/brown to Rail A, servo orange to GPIO18, and add the **Rail A − ↔ Rail B − jumper**. Plug in the charger, then upload `test-servo`. ✅ Servo sweeps smoothly. Do this **before** fixing the servo horn to the door, and adjust `SERVO_OPEN_DEG` / `SERVO_CLOSED_DEG` in `pins.h` to suit the door.
6. **Relay, no 12V yet.** Wire VCC/GND/IN1. Upload `test-relay`. ✅ The relay clicks and its LED lights for 1 s, then is off for 4 s. If it's the other way round (on 4 s, off 1 s), the module is active-HIGH — swap `RELAY_ON`/`RELAY_OFF` in `pins.h`. Leave the module's **JD-VCC jumper** in place.
7. **Solenoid circuit (12V).** **Unplug everything first.**
   - 12V adapter → barrel jack adapter. Barrel **+** terminal → relay **COM1**.
   - Relay **NO1** → solenoid wire A. Solenoid wire B → barrel **−** terminal.
   - **1N4007 diode across the solenoid's two wires:** **striped end** on wire A (from NO1, the + side), **plain end** on wire B (the − side).
   - Re-check the diode direction, plug in the 12V adapter and the ESP32, and run `test-relay`. ✅ Latch pulls in for 1 s, then springs back. Never hold the solenoid on longer than ~10 s.
8. **Full sequence.** Upload `test-unlock-sequence` and scan any finger. ✅ An unknown finger shows "Access denied" with the red LED and a long beep. The granted path (OLED "Access granted" → solenoid releases → servo opens → holds 5 s → servo closes) needs an enrolled finger, so check it after 5b — or use the dashboard's **Unlock Door** button, which runs the same sequence.

The real firmware (WiFi + `POST /door/access` + command polling + enrollment) builds on stage 8 and lives in `firmware/src/app/`.

---

### 5b. Connecting to the backend (`env:app`)

1. Copy `firmware/include/secrets.h.example` to `firmware/include/secrets.h` (git-ignored) and fill in the WiFi name/password, the laptop's LAN IP in `API_BASE_URL` (`ipconfig`, **not** `localhost`), and `DEVICE_API_KEY` (same value as in `Backend-hono/.env`).
2. The ESP32 and the laptop must be on the same **2.4 GHz** WiFi. Networks with client isolation (common on school/campus WiFi) block the board from reaching the laptop; use a phone hotspot instead.
3. Allow the backend through Windows Firewall: Windows Security → Firewall → Allow an app, or run `New-NetFirewallRule -DisplayName "Door backend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private` in an admin PowerShell.
4. **One time only — clear old fingerprints.** Fingers enrolled over USB before dashboard enrollment existed aren't in the database. Upload `wipe-fingerprints`, open the Serial Monitor, type `y`, press Enter. ✅ `Sensor cleared`.
5. Start the backend and frontend, select `env:app`, upload, and open the Serial Monitor. Expect `WiFi connected, IP …`.
6. **Enroll from the dashboard.** Settings → Fingerprints → type a name → **Add fingerprint**. Within ~3 s the OLED says "Place finger" and Settings shows the same step. Scan, lift, scan again. ✅ OLED "Enrolled!" and the person appears in the list.
7. Scan the enrolled finger (GRANTED event showing their name), an unknown finger (DENIED event), and click **Unlock** in the dashboard (the door runs the sequence within ~3 s and logs ADMIN_UNLOCK).

The door action always runs before the network call, so scans still work if WiFi or the backend is down.

---

### 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| ESP32 resets when the servo moves | Servo + is on Rail B (ESP32 power), or the charger is under 2A |
| Servo jitters or doesn't move | Missing Rail A − ↔ Rail B − jumper, or a weak charger |
| `Did not find fingerprint sensor` | TX/RX not crossed, wrong pins in `pins.h`, or the sensor needs 3.3V instead of 5V (or vice versa) |
| OLED stays blank | SDA/SCL swapped, VCC on 5V instead of 3V3, or the address is `0x3D` (change `OLED_I2C_ADDR`) |
| No COM port / upload fails | Charge-only USB cable, missing CP210x/CH340 driver, or BOOT not held |
| Relay clicks but solenoid doesn't move | Wired to NC instead of NO, or solenoid wire B not on 12V − |
| 12V adapter cuts out when the relay closes | **Diode is backwards** — unplug immediately and flip it |
