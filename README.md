# Live Delivery Rider Directions (Node.js + Leaflet + Socket.IO)

A small simulation with a moving rider, road-following directions from public OSRM, live updates every 500 ms, distance remaining, ETA, and a next-direction hint. All browser tabs share the same simulation.

## Run

Requires Node.js 18+ and internet for OpenStreetMap tiles and OSRM route calculation.

```bash
npm install
npm start
```

Open http://localhost:3000. Click **Start**, **Pause**, or **Reset**. Click the map to set a different destination; the route will restart from the rider's current location. If the OSRM demo routing server is unreachable on startup, an *explicitly labeled illustrative fallback* route is used (not verified to follow roads). Changing destinations requires OSRM connectivity.

## Architecture

- `server.js`: Express, Socket.IO, public OSRM route request, simulated constant-speed rider, progress calculations.
- `public/index.html`: Leaflet map with rider, destination, completed path, remaining distance, ETA, direction and controls.
- Server emits `init` with route and snapshot and broadcasts `location` every 500ms when moving.
- `POST /api/start`, `/api/pause`, `/api/reset` control the shared demo. `POST /api/route` accepts JSON `{ "destination": [latitude, longitude] }` to calculate a new route.

## Important

The rider **is simulated**, and the ETA assumes a fixed 24 km/h, not real road traffic. Public OSRM and OSM tile services are best-effort demo services, not guaranteed production APIs. For production, use a hosted routing service with suitable usage limits, your own OSRM instance, authentication, and actual rider GPS updates.
