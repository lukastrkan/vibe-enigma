# ⚡ Vibe Lounge Enigma Decoder (DevFest Prague 2026)

A real-time cyber-noir Enigma I simulator and radio transmission interceptor built for the DevFest Prague 2026 Vibe Lounge challenge.

Pair-programmed live with **Gemini** & **Google Antigravity**.

---

## 📻 Features

1. **Live Radio / Transmission Interceptor**:
   - Polls `GET https://devfest-vibe-lounge.web.app/api/transmissions` every 10 seconds.
   - Automatically decodes the encrypted agenda using each transmission's rotor start position.
   - Parses talk titles, speakers, rooms (`MOONSHINE`, `SPEAKEASY`, `CRIME LAB`), and time slots.
   - Instant "Load in Enigma" button to load any intercepted message directly into the physical simulator.

2. **Accurate Hardware Simulation (Enigma I)**:
   - Rotors I, II, III with standard double-stepping mechanics.
   - Reflector B (`YRUHQSLDPXNGOKMIEBFZCWVJAT`).
   - Plugboard (Steckerbrett) pre-configured with DevFest plugs (`DE`, `VF`, `ST`), fully editable.
   - Tactile turning rotor tumblers with live window readout.
   - Illuminated glowing lampboard with filament animation.
   - Clickable mechanical keyboard + physical keyboard input listener.
   - Full electrical signal path visualizer (`Key -> Plugboard -> III -> II -> I -> UKW-B -> I -> II -> III -> Plugboard -> Lamp`).
   - Audio synthesizer using the Web Audio API for authentic mechanical clicks and rotor stepping.

3. **Kubernetes & Cloud Ready**:
   - Packaged in lightweight `nginx:alpine` via [Dockerfile](Dockerfile).
   - Complete Kubernetes manifests in [k8s/deployment.yaml](k8s/deployment.yaml) with Deployment, Service, and Ingress with TLS.

---

## 🛠️ Local Development

Run with any static web server:

```bash
# Using python
python3 -m http.server 8080

# Or using npx
npx serve .
```

Open `http://localhost:8080` in your browser.

---

## ☸️ Kubernetes Deployment

Build & run container:

```bash
docker build -t vibe-enigma:latest .
docker run -p 8080:80 vibe-enigma:latest
```

Apply to Kubernetes cluster:

```bash
kubectl apply -f k8s/deployment.yaml
```
