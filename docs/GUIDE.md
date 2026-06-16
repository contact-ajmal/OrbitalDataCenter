# Orbital Datacenter Operator Manual & System Guide

Welcome to the SpaceX AI1 Orbital Compute Constellation simulator documentation. This manual provides a comprehensive reference covering the science, physics, controls, and sandbox features implemented in the simulation.

---

## 1. Project Overview & System Context
The SpaceX AI1 program (unveiled in 2026) represents a paradigm shift in global compute infrastructure: placing GPU-accelerated servers directly in low-Earth orbit (LEO). By positioning computing power in space, the network bypasses terrestrial fiber bottlenecks, utilizes direct sunlit solar energy, and cools processors using vacuum radiation panels.

### Key Hardware Specifications
* **Satellite Model**: AI1 Space Compute Node
* **Deployed Wingspan**: 70 meters (larger than a Boeing 747-8 wing span)
* **Onboard Power**: ~150 kW peak generation via high-density sun-tracking solar arrays.
* **Compute Payload**: Liquid-cooled NVIDIA Rubin / GB300 graphics processing architectures (120 kW average workload).
* **Thermal System**: Dual redundant cooling loops feeding up to 110 m² of space radiator panels.
* **Orbit Profile**: Sun-synchronous retrograde orbit at ~600 km altitude (97.6° inclination), traveling at 7.56 km/s with an orbital period of 96.7 minutes.
* **Communications**: Optical Laser Inter-Satellite Links (ISLs) and Earth-facing optical laser/RF downlinks.

---

## 2. Visual & Simulation Physics Engine

### 🌐 Day/Night Earth Shader
The Earth is rendered using a custom three-dimensional `ShaderMaterial` designed to maximize visual fidelity:
* **Terminator Transition**: Features a realistic warm orange glow along the twilight zone (terminator line).
* **Bump Mapping**: Incorporates high-resolution topographic relief data, projecting realistic shadows on mountains along the terminator.
* **Ocean Specular Glints**: Renders dynamic sunlight reflections only on water surfaces based on ocean mask boundaries.
* **City Lights**: Integrates 16K nocturnal lights that fade out on the sunlit side of the planet.
* **Fresnel Atmospheric Rim**: Projects a soft blue atmospheric glow around the limb of the planet.

### 🔋 Orbital Shadow & Power Operations
Satellites require continuous solar exposure to power their massive compute blocks:
* **Eclipse Shadow Cylinder**: The simulation checks whether a satellite enters the Earth's shadow cone. 
* **Battery Discharge**: While eclipsed, solar wings stop generating power, and batteries discharge at `-8%/s` (simulation time).
* **Recharging**: Once the satellite exits eclipse, its sun-tracking panels charge the battery at `+15%/s`.
* **Low Power Mode**: If battery charge drops to `0%`, the satellite shuts down non-essential systems (entering Low Power Mode), which severs all lasers and downlinks. It resumes operations once recharged to `20%`.
* **Yoke Array Swivelling**: The solar wings dynamically swivel on their axes to remain perpendicular to the Sun vector. During eclipses, they lay flat (`0°`) to minimize aerodynamic drag from upper-atmospheric traces.

---

## 3. Communication Network & Telemetry

### 🔗 Laser Inter-Satellite Links (ISLs)
Satellites organize themselves into a **Walker Constellation** topology:
* **Rings & Ladders**: Satellites connect to their immediate neighbors in the same orbital plane (ring links) and adjacent orbital planes (ladder links).
* **High-Frequency Telemetry**: Telemetry coordinates (xyz world coordinates, eclipse status, etc.) are written directly to a flat `Float32Array` singleton buffer. This bypasses React's render loops, allowing 60 FPS performance even with 2,400 active satellites.
* **Data Pulses**: Animated light pulses stream along active laser paths, representing data packets moving at the speed of light.

### 📡 Ground-Station Downlink Beams
Four key global telemetry stations are simulated on the Earth's surface:
1. **Bastrop (Texas, USA)**
2. **York (England, UK)**
3. **Tokyo (Japan)**
4. **Sydney (Australia)**
As the Earth rotates, satellites dynamically hand off violet laser downlinks to the closest ground station in line-of-sight.

### ☁ Adaptive Weather Attenuation
Ground optical downlinks are subject to weather interference:
* **Clear Skies**: Downlink channels use high-frequency violet optical laser beams capable of **10 Gbps** transfers.
* **Cloudy Skies**: If cloud cover is simulated, the system automatically falls back to rain-resistant amber Radio Frequency (RF) backup beams, throttled to **100 Mbps**. Beacons and laser colors transition dynamically to indicate this state.

---

## 4. Advanced Network & Physics Operations

### 📡 Lunar Deep-Space Relay
* **Mechanism**: Simulates a high-bandwidth connection between the orbital constellation and deep space.
* **Telemetry**: Computes the Moon's coordinates using its orbital radius (1450 units), tilt angle (5.1°), and orbital velocity.
* **Targeting**: The simulation performs a real-time vector search to select the satellite with the optimal line-of-sight to the Moon. A thick, pulsating violet laser link is projected from the Moon to this selected satellite.
* **Visuals**: A floating text banner `📡 Lunar Deep-Link` follows the selected satellite in 3D space.

### 🧲 Van Allen Radiation Belt & SAA Hazards
* **Visuals**: Renders a volumetric, glowing purple toroidal point cloud surrounding the Earth.
* **Effects**: Satellites entering this torus experience high levels of cosmic radiation (Single Event Upsets / SEUs). 
* **Visual Anomalies**: Affected satellites suffer data cross-talk, causing their connected laser lines to flicker with magenta/purple noise. Their inspector stats display a flashing `RADIATION BELT: DANGEROUS (ECC Active)` error.

### 🛡 Deflector Shield Generator
* **Mechanism**: Activates a constellation-wide magnetospheric shield to deflect space radiation.
* **Visuals**: Inspecting a satellite with shields active reveals a double-layered forcefield bubble. It consists of an outer geodesic wireframe dome (`icosahedronGeometry`) and an inner soft-glowing cyan glass sphere, both pulsating in scale and opacity.
* **Physics**: Absorbs radiation. When enabled, satellites passing through the Van Allen belt do not suffer SEUs, connected lasers do not flicker, and their details card displays `Radiation Belt: DEFLECTED` and `Deflector Shield: ACTIVE`.
* **Control**: Toggleable via the **HAZARDS** menu or key `S`.

### 🔑 QKD (Quantum Key Distribution) Encryption
* **Visuals**: Upgrades the laser mesh network. When activated, all lasers switch to vibrant, neon-emerald green paths, representing quantum-entangled security channels. Dotted data packets zip along the lines at double speed (2.0x velocity multiplier).
* **Control**: Toggleable via the **NETWORKS** menu.

### 🥇 Grok Consensus Pulse
* **Mechanism**: Simulates distributed model weight synchronization.
* **Visuals**: Triggering federated model training sweeps a golden consensus pulse wave outward across the entire constellation starting from Bastrop, TX. Satellites flash gold as they synchronize their weight parameters.

### 🚀 Active ADCS RCS Gas Plumes
* **Mechanism**: Simulates Active Attitude Determination and Control Systems.
* **Visuals**: Emits rapid vacuum bursts of blue cold-gas RCS thrusters from the corners of inspected satellites to maintain orbital orientation.

---

## 5. Constellation Hazards & Deorbit Sandbox

### ☀ Solar Storm (CME)
* **Event**: Simulates a Coronal Mass Ejection space weather storm.
* **Visuals**: Sweeps a dense field of hot orange solar wind particles across orbit space. Renders glowing neon-green **auroral rings** encircling both the North and South magnetic poles that pulse in scale.
* **Effects**: Satellites hit by the storm enter **Safe Mode** (compute load drops, thermal radiators dim, and panels go flat).

### ⚠ Conjunction Warning
* **Event**: Simulates a debris conjunction collision hazard.
* **Visuals**: Renders an amber target reticle on a threatened satellite.
* **Physics**: The threatened satellite performs an avoidance thruster burn (emitting active gas plumes) to alter its orbit, successfully avoiding the approaching piece of orbital debris.

### 💥 ASAT Kinetic Strike
* **Event**: Launches a kinetic anti-satellite missile from Starbase, TX.
* **Visuals**: Animate a glowing red homing missile trail targeting the selected satellite.
* **Effects**: Upon intercept, a bright amber explosion flashes, and the satellite is obliterated (marked as `burned`, removing its model and severing all communication).
* **Debris Drift**: Spawns **60 Keplerian-drifting debris particles** that drift based on height offsets (lower debris orbits faster, higher debris orbits slower), naturally stretching into a debris ring over time.

### ☄ Deorbit Sequence
* **Event**: Initiates atmospheric reentry.
* **Visuals**: Generates a glowing, orange-to-red plasma drag trail that tapers behind the satellite.
* **Effects**: Decreases orbital altitude until the satellite reaches the atmosphere, triggers a reentry warning, and burns up.

---

## 6. Dashboard Controls & Keyboard Shortcuts

All features are accessible via the glassmorphic collapsible Control Dock at the bottom of the screen:
1. **NETWORKS**: Toggle layers (Lasers, Downlinks, Orbits, Starlink overlay, Traffic routing, Heatmap workloads), Cloud Weather simulation, and **QKD Encryption**.
2. **FLEET**: Adjust active satellite count (60 to 2400), toggle view modes (Overview, Chase, Inspect), trigger Starship launch (+60 sats), toggle 10⁶ point-cloud vision, and enable ADCS plumes.
3. **COMPUTE**: Trigger individual AI routing packet runs and launch consensus model training.
4. **HAZARDS**: Trigger Solar Storm, Conjunction Warning, ASAT Kinetic Strike (requires selected satellite), and **Deflector Shield**.
5. **SYSTEM**: Adjust simulation time-warp speed (1x to 600x), and toggle utilities (Reset camera, Pause, Screenshot, Economics panel, Roadmap timeline, Thermal view, Cinematic tour, Audio, Performance mode, Photo mode, and Share permalink).
6. **HELP**: Opens the interactive Operator Manual built directly into the dock.

### Keyboard Shortcuts Cheatsheet
* `Space` — Pause / Resume simulation
* `R` — Reset camera position & orientation
* `1` — Overview camera mode
* `2` — Chase camera mode
* `3` — Inspect camera mode
* `L` — Launch Starship with 60 satellites
* `J` — Run single AI compute job
* `T` — Toggle cinematic tour
* `S` — Save high-resolution viewport snapshot
* `V` — Toggle 1,000,000 satellite point cloud vision
* `I` — Toggle side information modal
* `Esc` — Close cards/modals, blur inputs, cancel active tours
