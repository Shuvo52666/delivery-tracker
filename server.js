
// import express from "express";
// import http from "node:http";
// import { Server } from "socket.io";

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// const PORT = process.env.PORT || 3000;

// app.use(express.static("public"));
// app.use(express.json());

// const START = [23.7465, 90.3760];
// const END = [23.7582, 90.3930];

// const SPEED_KMH = 24;
// const TICK_MS = 500;
// const METERS_PER_TICK =
//   (SPEED_KMH * 1000 / 3600) * (TICK_MS / 1000);

// let route = [];
// let instructions = [];
// let routeSource = "loading";
// let cumulative = [0];
// let totalMeters = 0;
// let traveledMeters = 0;
// let running = false;
// let ready = false;
// let loadingRoute = false;

// function distance(a, b) {
//   const rad = Math.PI / 180;
//   const lat1 = a[0] * rad;
//   const lat2 = b[0] * rad;

//   const dLat = (b[0] - a[0]) * rad;
//   const dLon = (b[1] - a[1]) * rad;

//   const h =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(lat1) *
//       Math.cos(lat2) *
//       Math.sin(dLon / 2) ** 2;

//   return (
//     6371000 *
//     2 *
//     Math.atan2(
//       Math.sqrt(h),
//       Math.sqrt(Math.max(0, 1 - h))
//     )
//   );
// }

// function buildCumulative(points) {
//   const offsets = [0];

//   for (let i = 1; i < points.length; i++) {
//     offsets.push(
//       offsets[i - 1] +
//         distance(points[i - 1], points[i])
//     );
//   }

//   return offsets;
// }

// function setRoute(points, steps, source) {
//   if (points.length < 2) {
//     throw new Error("Route requires at least 2 points");
//   }

//   route = points;
//   cumulative = buildCumulative(route);
//   totalMeters = cumulative.at(-1);

//   instructions = steps;
//   routeSource = source;
//   traveledMeters = 0;
//   running = false;
//   ready = true;

//   io.emit("init", snapshot());
// }

// function pointAt(meters) {
//   if (!route.length) return null;

//   if (meters <= 0) return [...route[0]];
//   if (meters >= totalMeters) {
//     return [...route.at(-1)];
//   }

//   let lo = 0;
//   let hi = cumulative.length - 1;

//   while (lo + 1 < hi) {
//     const mid = (lo + hi) >> 1;

//     if (cumulative[mid] <= meters) {
//       lo = mid;
//     } else {
//       hi = mid;
//     }
//   }

//   const length = cumulative[hi] - cumulative[lo];
//   const t = length
//     ? (meters - cumulative[lo]) / length
//     : 0;

//   return route[lo].map(
//     (value, index) =>
//       value + (route[hi][index] - value) * t
//   );
// }

// function traveledPath() {
//   if (!route.length) return [];

//   const path = [];

//   for (let i = 0; i < route.length; i++) {
//     if (cumulative[i] <= traveledMeters) {
//       path.push(route[i]);
//     } else {
//       break;
//     }
//   }

//   const current = pointAt(traveledMeters);

//   if (current) path.push(current);

//   return path;
// }

// function upcomingStep() {
//   for (const step of instructions) {
//     if (step.metersFromStart > traveledMeters + 8) {
//       return step;
//     }
//   }

//   return instructions.at(-1) || null;
// }

// function snapshot() {
//   if (!ready) {
//     return {
//       ready: false,
//       running: false,
//       routeSource,
//     };
//   }

//   const delivered = traveledMeters >= totalMeters;
//   const remaining = Math.max(
//     0,
//     totalMeters - traveledMeters
//   );

//   return {
//     ready,
//     running,
//     delivered,
//     route,
//     position: pointAt(traveledMeters),
//     path: traveledPath(),
//     start: route[0],
//     destination: route.at(-1),
//     routeSource,
//     progress: totalMeters
//       ? Math.round((100 * traveledMeters) / totalMeters)
//       : 100,
//     remainingMeters: Math.round(remaining),
//     totalMeters: Math.round(totalMeters),
//     etaSeconds: Math.ceil(
//       remaining / (SPEED_KMH * 1000 / 3600)
//     ),
//     speedKmh: SPEED_KMH,
//     nextStep: delivered ? null : upcomingStep(),
//   };
// }

// function instructionText(maneuver, name) {
//   const road = name ? ` onto ${name}` : "";

//   switch (maneuver.type) {
//     case "depart":
//       return "Start your delivery";
//     case "arrive":
//       return "Arrive at customer destination";
//     case "turn":
//       return `Turn ${maneuver.modifier || "ahead"}${road}`;
//     case "new name":
//       return `Continue${road}`;
//     case "roundabout":
//       return `Enter roundabout${road}`;
//     case "merge":
//       return `Merge ${maneuver.modifier || ""}${road}`;
//     case "on ramp":
//       return `Take the ramp${road}`;
//     case "off ramp":
//       return `Exit the ramp${road}`;
//     case "fork":
//       return `Keep ${maneuver.modifier || "ahead"}${road}`;
//     case "end of road":
//       return `Turn ${maneuver.modifier || "ahead"}${road}`;
//     default:
//       return `Continue${road}`;
//   }
// }

// async function loadRoadRoute(start = START, end = END) {
//   if (loadingRoute) {
//     throw new Error("Route calculation in progress");
//   }

//   loadingRoute = true;

//   try {
//     const url =
//       "https://router.project-osrm.org/route/v1/driving/" +
//       `${start[1]},${start[0]};${end[1]},${end[0]}` +
//       "?overview=full&geometries=geojson&steps=true";

//     const response = await fetch(url, {
//       signal: AbortSignal.timeout(12000),
//     });

//     if (!response.ok) {
//       throw new Error(`OSRM HTTP ${response.status}`);
//     }

//     const json = await response.json();

//     if (
//       json.code !== "Ok" ||
//       !json.routes?.[0]?.geometry?.coordinates?.length
//     ) {
//       throw new Error("No drivable route found");
//     }

//     const trip = json.routes[0];

//     const points = trip.geometry.coordinates.map(
//       ([lng, lat]) => [lat, lng]
//     );

//     const offsets = buildCumulative(points);
//     const steps = [];

//     let routeCursor = 0;

//     for (const leg of trip.legs) {
//       for (const step of leg.steps) {
//         const [lng, lat] = step.maneuver.location;

//         let best = routeCursor;
//         let closest = Infinity;

//         for (
//           let i = routeCursor;
//           i < points.length;
//           i++
//         ) {
//           const d = distance(points[i], [lat, lng]);

//           if (d < closest) {
//             closest = d;
//             best = i;
//           }

//           if (closest < 3 && d > 30) break;
//         }

//         routeCursor = best;

//         steps.push({
//           text: instructionText(
//             step.maneuver,
//             step.name
//           ),
//           metersFromStart: offsets[best] ?? 0,
//         });
//       }
//     }

//     setRoute(points, steps, "OSRM road directions");
//   } finally {
//     loadingRoute = false;
//   }
// }

// function loadFallbackRoute() {
//   const stops = [
//     START,
//     [23.7469, 90.3782],
//     [23.7478, 90.3785],
//     [23.7483, 90.3811],
//     [23.7501, 90.3814],
//     [23.7504, 90.3843],
//     [23.7516, 90.3879],
//     [23.7541, 90.3898],
//     [23.7559, 90.3915],
//     END,
//   ];

//   setRoute(
//     stops,
//     [
//       {
//         text: "Follow the simulated route",
//         metersFromStart: 0,
//       },
//     ],
//     "Fallback illustration (not verified roads)"
//   );
// }

// io.on("connection", (socket) => {
//   socket.emit("init", snapshot());
// });

// app.get("/api/state", (_req, res) => {
//   res.json(snapshot());
// });

// for (const action of ["start", "pause", "reset"]) {
//   app.post(`/api/${action}`, (_req, res) => {
//     if (!ready || loadingRoute) {
//       return res.status(503).json({
//         error: "Route is not ready",
//       });
//     }

//     if (action === "start") {
//       if (traveledMeters >= totalMeters) {
//         traveledMeters = 0;
//       }

//       running = true;
//     } else if (action === "pause") {
//       running = false;
//     } else {
//       running = false;
//       traveledMeters = 0;
//     }

//     const state = snapshot();
//     io.emit("location", state);

//     return res.json(state);
//   });
// }

// app.post("/api/route", async (req, res) => {
//   const { destination } = req.body || {};

//   if (
//     !Array.isArray(destination) ||
//     destination.length !== 2 ||
//     !destination.every(Number.isFinite) ||
//     destination[0] < -90 ||
//     destination[0] > 90 ||
//     destination[1] < -180 ||
//     destination[1] > 180
//   ) {
//     return res.status(400).json({
//       error: "Expected destination [latitude, longitude]",
//     });
//   }

//   if (loadingRoute) {
//     return res.status(409).json({
//       error: "Route calculation already in progress",
//     });
//   }

//   try {
//     running = false;

//     const start = ready
//       ? pointAt(traveledMeters)
//       : START;

//     await loadRoadRoute(start, destination);

//     return res.json(snapshot());
//   } catch (error) {
//     return res.status(502).json({
//       error: error.message,
//     });
//   }
// });

// setInterval(() => {
//   if (!running || !ready) return;

//   traveledMeters = Math.min(
//     totalMeters,
//     traveledMeters + METERS_PER_TICK
//   );

//   if (traveledMeters >= totalMeters) {
//     running = false;
//   }

//   io.emit("location", snapshot());
// }, TICK_MS);

// server.listen(PORT, () => {
//   console.log(
//     `Delivery tracker: http://localhost:${PORT}`
//   );
// });

// loadRoadRoute().catch((error) => {
//   console.warn(
//     "OSRM unavailable; using fallback:",
//     error.message
//   );

//   loadFallbackRoute();
// });


// import express from "express";
// import http from "node:http";
// import { Server } from "socket.io";

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// const PORT = process.env.PORT || 3000;

// app.use(express.static("public"));
// app.use(express.json());

// // Destination stays unchanged.
// // START is only a legacy fallback reference.
// const START = [23.7465, 90.3760];
// const END = [23.7582, 90.3930];

// const SPEED_KMH = 24;
// const TICK_MS = 500;
// const METERS_PER_TICK =
//   (SPEED_KMH * 1000 / 3600) * (TICK_MS / 1000);

// let route = [];
// let instructions = [];
// let routeSource = "waiting for GPS";
// let cumulative = [0];
// let totalMeters = 0;
// let traveledMeters = 0;
// let running = false;
// let ready = false;
// let loadingRoute = false;

// // =========================================
// // VALIDATE COORDINATES
// // =========================================

// function validCoords(coords) {
//   return (
//     Array.isArray(coords) &&
//     coords.length === 2 &&
//     coords.every(Number.isFinite) &&
//     coords[0] >= -90 &&
//     coords[0] <= 90 &&
//     coords[1] >= -180 &&
//     coords[1] <= 180
//   );
// }

// // =========================================
// // DISTANCE CALCULATION
// // =========================================

// function distance(a, b) {
//   const rad = Math.PI / 180;
//   const lat1 = a[0] * rad;
//   const lat2 = b[0] * rad;

//   const dLat = (b[0] - a[0]) * rad;
//   const dLon = (b[1] - a[1]) * rad;

//   const h =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(lat1) *
//       Math.cos(lat2) *
//       Math.sin(dLon / 2) ** 2;

//   return (
//     6371000 *
//     2 *
//     Math.atan2(
//       Math.sqrt(h),
//       Math.sqrt(Math.max(0, 1 - h))
//     )
//   );
// }

// // =========================================
// // BUILD CUMULATIVE DISTANCES
// // =========================================

// function buildCumulative(points) {
//   const offsets = [0];

//   for (let i = 1; i < points.length; i++) {
//     offsets.push(
//       offsets[i - 1] +
//         distance(points[i - 1], points[i])
//     );
//   }

//   return offsets;
// }

// // =========================================
// // SAVE ROUTE
// // =========================================

// function setRoute(points, steps, source) {
//   if (points.length < 2) {
//     throw new Error("Route requires at least 2 points");
//   }

//   route = points;
//   cumulative = buildCumulative(route);
//   totalMeters = cumulative.at(-1);

//   if (totalMeters <= 0) {
//     throw new Error("Route distance must be positive");
//   }

//   instructions = steps;
//   routeSource = source;
//   traveledMeters = 0;
//   running = false;
//   ready = true;

//   io.emit("init", snapshot());
// }

// // =========================================
// // CALCULATE CURRENT POSITION
// // =========================================

// function pointAt(meters) {
//   if (!route.length) return null;

//   if (meters <= 0) return [...route[0]];
//   if (meters >= totalMeters) {
//     return [...route.at(-1)];
//   }

//   let lo = 0;
//   let hi = cumulative.length - 1;

//   while (lo + 1 < hi) {
//     const mid = (lo + hi) >> 1;

//     if (cumulative[mid] <= meters) {
//       lo = mid;
//     } else {
//       hi = mid;
//     }
//   }

//   const length = cumulative[hi] - cumulative[lo];
//   const t = length
//     ? (meters - cumulative[lo]) / length
//     : 0;

//   return route[lo].map(
//     (value, index) =>
//       value + (route[hi][index] - value) * t
//   );
// }

// // =========================================
// // COMPLETED PATH
// // =========================================

// function traveledPath() {
//   if (!route.length) return [];

//   const path = [];

//   for (let i = 0; i < route.length; i++) {
//     if (cumulative[i] <= traveledMeters) {
//       path.push(route[i]);
//     } else {
//       break;
//     }
//   }

//   const current = pointAt(traveledMeters);

//   if (current) path.push(current);

//   return path;
// }

// // =========================================
// // NEXT NAVIGATION STEP
// // =========================================

// function upcomingStep() {
//   for (const step of instructions) {
//     if (step.metersFromStart > traveledMeters + 8) {
//       return step;
//     }
//   }

//   return instructions.at(-1) || null;
// }

// // =========================================
// // CURRENT ROUTE STATE
// // =========================================

// function snapshot() {
//   if (!ready) {
//     return {
//       ready: false,
//       running: false,
//       routeSource,
//     };
//   }

//   const delivered = traveledMeters >= totalMeters;
//   const remaining = Math.max(
//     0,
//     totalMeters - traveledMeters
//   );

//   return {
//     ready,
//     running,
//     delivered,
//     route,
//     position: pointAt(traveledMeters),
//     path: traveledPath(),
//     start: route[0],
//     destination: route.at(-1),
//     routeSource,
//     progress: totalMeters
//       ? Math.round((100 * traveledMeters) / totalMeters)
//       : 100,
//     remainingMeters: Math.round(remaining),
//     totalMeters: Math.round(totalMeters),
//     etaSeconds: Math.ceil(
//       remaining / (SPEED_KMH * 1000 / 3600)
//     ),
//     speedKmh: SPEED_KMH,
//     nextStep: delivered ? null : upcomingStep(),
//   };
// }

// // =========================================
// // NAVIGATION INSTRUCTIONS
// // =========================================

// function instructionText(maneuver, name) {
//   const road = name ? ` onto ${name}` : "";

//   switch (maneuver.type) {
//     case "depart":
//       return "Start your delivery";

//     case "arrive":
//       return "Arrive at customer destination";

//     case "turn":
//       return `Turn ${maneuver.modifier || "ahead"}${road}`;

//     case "new name":
//       return `Continue${road}`;

//     case "roundabout":
//       return `Enter roundabout${road}`;

//     case "merge":
//       return `Merge ${maneuver.modifier || ""}${road}`;

//     case "on ramp":
//       return `Take the ramp${road}`;

//     case "off ramp":
//       return `Exit the ramp${road}`;

//     case "fork":
//       return `Keep ${maneuver.modifier || "ahead"}${road}`;

//     case "end of road":
//       return `Turn ${maneuver.modifier || "ahead"}${road}`;

//     default:
//       return `Continue${road}`;
//   }
// }

// // =========================================
// // LOAD OSRM ROUTE
// // =========================================

// async function loadRoadRoute(start, end = END) {
//   if (loadingRoute) {
//     throw new Error("Route calculation in progress");
//   }

//   if (!validCoords(start) || !validCoords(end)) {
//     throw new Error("Invalid source or destination");
//   }

//   loadingRoute = true;

//   try {
//     const url =
//       "https://router.project-osrm.org/route/v1/driving/" +
//       `${start[1]},${start[0]};${end[1]},${end[0]}` +
//       "?overview=full&geometries=geojson&steps=true";

//     const response = await fetch(url, {
//       signal: AbortSignal.timeout(12000),
//     });

//     if (!response.ok) {
//       throw new Error(`OSRM HTTP ${response.status}`);
//     }

//     const json = await response.json();

//     if (
//       json.code !== "Ok" ||
//       !json.routes?.[0]?.geometry?.coordinates?.length
//     ) {
//       throw new Error("No drivable route found");
//     }

//     const trip = json.routes[0];

//     const points = trip.geometry.coordinates.map(
//       ([lng, lat]) => [lat, lng]
//     );

//     const offsets = buildCumulative(points);
//     const steps = [];

//     let routeCursor = 0;

//     for (const leg of trip.legs) {
//       for (const step of leg.steps) {
//         const [lng, lat] = step.maneuver.location;

//         let best = routeCursor;
//         let closest = Infinity;

//         for (let i = routeCursor; i < points.length; i++) {
//           const d = distance(points[i], [lat, lng]);

//           if (d < closest) {
//             closest = d;
//             best = i;
//           }

//           if (closest < 3 && d > 30) break;
//         }

//         routeCursor = best;

//         steps.push({
//           text: instructionText(
//             step.maneuver,
//             step.name
//           ),
//           metersFromStart: offsets[best] ?? 0,
//         });
//       }
//     }

//     setRoute(points, steps, "OSRM road directions");
//   } finally {
//     loadingRoute = false;
//   }
// }

// // =========================================
// // ORIGINAL FALLBACK ROUTE
// // Kept for compatibility, but not called
// // automatically because it has a fixed START.
// // =========================================

// function loadFallbackRoute() {
//   const stops = [
//     START,
//     [23.7469, 90.3782],
//     [23.7478, 90.3785],
//     [23.7483, 90.3811],
//     [23.7501, 90.3814],
//     [23.7504, 90.3843],
//     [23.7516, 90.3879],
//     [23.7541, 90.3898],
//     [23.7559, 90.3915],
//     END,
//   ];

//   setRoute(
//     stops,
//     [
//       {
//         text: "Follow the simulated route",
//         metersFromStart: 0,
//       },
//     ],
//     "Fallback illustration (not verified roads)"
//   );
// }

// // =========================================
// // SOCKET.IO
// // =========================================

// io.on("connection", (socket) => {
//   socket.emit("init", snapshot());
// });

// // =========================================
// // GET CURRENT STATE
// // =========================================

// app.get("/api/state", (_req, res) => {
//   res.json(snapshot());
// });

// // =========================================
// // START / PAUSE / RESET
// // =========================================

// for (const action of ["start", "pause", "reset"]) {
//   app.post(`/api/${action}`, (_req, res) => {
//     if (!ready || loadingRoute) {
//       return res.status(503).json({
//         error: "Route is not ready",
//       });
//     }

//     if (action === "start") {
//       if (traveledMeters >= totalMeters) {
//         traveledMeters = 0;
//       }

//       running = true;
//     } else if (action === "pause") {
//       running = false;
//     } else {
//       running = false;
//       traveledMeters = 0;
//     }

//     const state = snapshot();
//     io.emit("location", state);

//     return res.json(state);
//   });
// }

// // =========================================
// // SET ROUTE USING BROWSER GPS SOURCE
// // =========================================

// app.post("/api/route", async (req, res) => {
//   const { source, destination } = req.body || {};

//   if (!validCoords(source)) {
//     return res.status(400).json({
//       error: "Expected GPS source [latitude, longitude]",
//     });
//   }

//   if (!validCoords(destination)) {
//     return res.status(400).json({
//       error: "Expected destination [latitude, longitude]",
//     });
//   }

//   if (loadingRoute) {
//     return res.status(409).json({
//       error: "Route calculation already in progress",
//     });
//   }

//   try {
//     running = false;

//     // GPS source replaces the original fixed START.
//     await loadRoadRoute(source, destination);

//     return res.json(snapshot());
//   } catch (error) {
//     return res.status(502).json({
//       error: error.message,
//     });
//   }
// });

// // =========================================
// // SIMULATE DELIVERY MOVEMENT
// // =========================================

// setInterval(() => {
//   if (!running || !ready || loadingRoute) return;

//   traveledMeters = Math.min(
//     totalMeters,
//     traveledMeters + METERS_PER_TICK
//   );

//   if (traveledMeters >= totalMeters) {
//     running = false;
//   }

//   io.emit("location", snapshot());
// }, TICK_MS);

// // =========================================
// // START SERVER
// // =========================================

// server.listen(PORT, () => {
//   console.log(
//     `Delivery tracker: http://localhost:${PORT}`
//   );

//   console.log(
//     "Waiting for browser GPS coordinates..."
//   );
// });

// // No automatic route from hardcoded START.
// // The browser will initialize the route.



import express from "express";
import http from "node:http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());

app.get("/", (req, res) => {
  res.redirect("/index.html");
});

const END = [23.7582, 90.3930];

const SPEED_KMH = 24;
const TICK_MS = 500;
const METERS_PER_TICK =
  (SPEED_KMH * 1000 / 3600) * (TICK_MS / 1000);

let route = [];
let instructions = [];
let routeSource = "waiting for location";
let cumulative = [0];
let totalMeters = 0;
let traveledMeters = 0;
let running = false;
let ready = false;
let loadingRoute = false;

// Exact coordinates BEFORE OSRM road snapping.
let exactSource = null;
let exactDestination = null;

// =========================================
// VALIDATE COORDINATES
// =========================================

function validCoords(coords) {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    coords.every(Number.isFinite) &&
    coords[0] >= -90 &&
    coords[0] <= 90 &&
    coords[1] >= -180 &&
    coords[1] <= 180
  );
}

// =========================================
// DISTANCE CALCULATION
// =========================================

function distance(a, b) {
  const rad = Math.PI / 180;

  const lat1 = a[0] * rad;
  const lat2 = b[0] * rad;

  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return (
    6371000 *
    2 *
    Math.atan2(
      Math.sqrt(h),
      Math.sqrt(Math.max(0, 1 - h))
    )
  );
}

// =========================================
// CUMULATIVE ROUTE DISTANCE
// =========================================

function buildCumulative(points) {
  const offsets = [0];

  for (let i = 1; i < points.length; i++) {
    offsets.push(
      offsets[i - 1] +
        distance(points[i - 1], points[i])
    );
  }

  return offsets;
}

// =========================================
// SAVE ROUTE
// =========================================

function setRoute(points, steps, source) {
  if (points.length < 2) {
    throw new Error("Route requires at least 2 points");
  }

  const offsets = buildCumulative(points);
  const length = offsets.at(-1);

  if (length <= 0) {
    throw new Error("Route distance must be positive");
  }

  route = points;
  cumulative = offsets;
  totalMeters = length;

  instructions = steps;
  routeSource = source;

  traveledMeters = 0;
  running = false;
  ready = true;

  io.emit("init", snapshot());
}

// =========================================
// POSITION ALONG ROAD
// =========================================

function pointAt(meters) {
  if (!route.length) return null;

  if (meters <= 0) return [...route[0]];

  if (meters >= totalMeters) {
    return [...route.at(-1)];
  }

  let lo = 0;
  let hi = cumulative.length - 1;

  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;

    if (cumulative[mid] <= meters) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const length = cumulative[hi] - cumulative[lo];

  const t = length
    ? (meters - cumulative[lo]) / length
    : 0;

  return route[lo].map(
    (value, index) =>
      value + (route[hi][index] - value) * t
  );
}

// =========================================
// COMPLETED ROUTE
// =========================================

function traveledPath() {
  if (!route.length) return [];

  const path = [];

  for (let i = 0; i < route.length; i++) {
    if (cumulative[i] <= traveledMeters) {
      path.push(route[i]);
    } else {
      break;
    }
  }

  const current = pointAt(traveledMeters);

  if (current) path.push(current);

  return path;
}

// =========================================
// NAVIGATION
// =========================================

function upcomingStep() {
  for (const step of instructions) {
    if (step.metersFromStart > traveledMeters + 8) {
      return step;
    }
  }

  return instructions.at(-1) || null;
}

// =========================================
// SNAPSHOT
// =========================================

function snapshot() {
  if (!ready) {
    return {
      ready: false,
      running: false,
      routeSource,
    };
  }

  const delivered = traveledMeters >= totalMeters;

  const remaining = Math.max(
    0,
    totalMeters - traveledMeters
  );

  return {
    ready,
    running,
    delivered,

    route,
    position: pointAt(traveledMeters),
    path: traveledPath(),

    // Road-snapped coordinates.
    start: route[0],
    destination: route.at(-1),

    // Actual requested coordinates.
    exactSource,
    exactDestination,

    routeSource,

    progress: totalMeters
      ? Math.round((100 * traveledMeters) / totalMeters)
      : 100,

    remainingMeters: Math.round(remaining),
    totalMeters: Math.round(totalMeters),

    etaSeconds: Math.ceil(
      remaining / (SPEED_KMH * 1000 / 3600)
    ),

    speedKmh: SPEED_KMH,
    nextStep: delivered ? null : upcomingStep(),
  };
}

// =========================================
// TURN INSTRUCTIONS
// =========================================

function instructionText(maneuver, name) {
  const road = name ? ` onto ${name}` : "";

  switch (maneuver.type) {
    case "depart":
      return "Start your delivery";

    case "arrive":
      return "Arrive at customer destination";

    case "turn":
      return `Turn ${maneuver.modifier || "ahead"}${road}`;

    case "new name":
      return `Continue${road}`;

    case "roundabout":
      return `Enter roundabout${road}`;

    case "merge":
      return `Merge ${maneuver.modifier || ""}${road}`;

    case "on ramp":
      return `Take the ramp${road}`;

    case "off ramp":
      return `Exit the ramp${road}`;

    case "fork":
      return `Keep ${maneuver.modifier || "ahead"}${road}`;

    case "end of road":
      return `Turn ${maneuver.modifier || "ahead"}${road}`;

    default:
      return `Continue${road}`;
  }
}

// =========================================
// OSRM ROAD ROUTING
// =========================================


async function loadRoadRoute(start, end = END) {
  if (loadingRoute) {
    throw new Error("Route calculation in progress");
  }

  if (!validCoords(start) || !validCoords(end)) {
    throw new Error("Invalid source or destination");
  }

  loadingRoute = true;

  try {
    const url =
      "https://router.project-osrm.org/route/v1/driving/" +
      `${start[1]},${start[0]};${end[1]},${end[0]}` +
      "?overview=full" +
      "&geometries=geojson" +
      "&steps=true" +
      "&radiuses=100;100";


    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    const json = await response.json();

    if (!response.ok || json.code !== "Ok") {
      console.error("OSRM error:", json);

      throw new Error(
        json.message ||
        json.code ||
        `OSRM HTTP ${response.status}`
      );
    }


    if (
      json.code !== "Ok" ||
      !json.routes?.[0]?.geometry?.coordinates?.length
    ) {
      throw new Error(
        json.message || "No drivable route found"
      );
    }

    const trip = json.routes[0];

    const points = trip.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng]
    );

    const offsets = buildCumulative(points);
    const steps = [];

    let routeCursor = 0;

    for (const leg of trip.legs) {
      for (const step of leg.steps) {
        const [lng, lat] = step.maneuver.location;

        let best = routeCursor;
        let closest = Infinity;

        for (let i = routeCursor; i < points.length; i++) {
          const d = distance(points[i], [lat, lng]);

          if (d < closest) {
            closest = d;
            best = i;
          }

          if (closest < 3 && d > 30) break;
        }

        routeCursor = best;

        steps.push({
          text: instructionText(
            step.maneuver,
            step.name
          ),
          metersFromStart: offsets[best] ?? 0,
        });
      }
    }

    // Store original coordinates before road snapping.
    const previousSource = exactSource;
    const previousDestination = exactDestination;

    exactSource = [...start];
    exactDestination = [...end];

    try {
      setRoute(points, steps, "OSRM road directions");
    } catch (error) {
      exactSource = previousSource;
      exactDestination = previousDestination;
      throw error;
    }

  } finally {
    loadingRoute = false;
  }
}


// =========================================
// SOCKET.IO
// =========================================

io.on("connection", (socket) => {
  socket.emit("init", snapshot());
});

// =========================================
// STATE API
// =========================================

app.get("/api/state", (_req, res) => {
  res.json(snapshot());
});

// =========================================
// START, PAUSE, RESET
// =========================================

for (const action of ["start", "pause", "reset"]) {
  app.post(`/api/${action}`, (_req, res) => {
    if (!ready || loadingRoute) {
      return res.status(503).json({
        error: "Route is not ready",
      });
    }

    if (action === "start") {
      if (traveledMeters >= totalMeters) {
        traveledMeters = 0;
      }

      running = true;
    } else if (action === "pause") {
      running = false;
    } else {
      running = false;
      traveledMeters = 0;
    }

    const state = snapshot();

    io.emit("location", state);

    return res.json(state);
  });
}

// =========================================
// CREATE ROUTE
// =========================================

app.post("/api/route", async (req, res) => {
  const { source, destination } = req.body || {};

  if (!validCoords(source)) {
    return res.status(400).json({
      error: "Expected source [latitude, longitude]",
    });
  }

  if (!validCoords(destination)) {
    return res.status(400).json({
      error: "Expected destination [latitude, longitude]",
    });
  }

  if (loadingRoute) {
    return res.status(409).json({
      error: "Route calculation already in progress",
    });
  }

  try {
    running = false;

    await loadRoadRoute(source, destination);

    return res.json(snapshot());
  } catch (error) {
    return res.status(502).json({
      error: error.message,
    });
  }
});

// =========================================
// SIMULATION MOVEMENT
// =========================================

setInterval(() => {
  if (!running || !ready || loadingRoute) return;

  traveledMeters = Math.min(
    totalMeters,
    traveledMeters + METERS_PER_TICK
  );

  if (traveledMeters >= totalMeters) {
    running = false;
  }

  io.emit("location", snapshot());
}, TICK_MS);

// =========================================
// START SERVER
// =========================================


if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(
      `Delivery tracker: http://localhost:${PORT}`
    );
  });
}

// Export HTTP server for Vercel, including Socket.IO.
export default server;

