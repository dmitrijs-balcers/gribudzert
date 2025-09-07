import * as L from "leaflet";
import points from "./points.xml?raw";

// Basic map setup
const rigaLatLng: L.LatLngTuple = [56.9496, 24.1052];
const map = L.map("map", {
  center: rigaLatLng,
  zoom: 13,
  zoomControl: true,
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
}).addTo(map);

L.control.scale({ metric: true, imperial: false }).addTo(map);

// Colour map for 'colour' tag values
const colourMap = {
  teal: "#2A93EE",
  blue: "#1E90FF",
  red: "#E53935",
  beige: "#D7C7A1",
  default: "#0078ff",
} as const;

// Layer to hold the points from points.xml
const pointsLayer: L.FeatureGroup<any> = L.featureGroup().addTo(map);

// Platform-aware navigation opener (global helper)
function openNavigation(lat: string, lon: string, label: string) {
  const latStr = Number(lat).toFixed(6);
  const lonStr = Number(lon).toFixed(6);
  const labelEnc = encodeURIComponent(label || "Destination");

  const geoUri = `geo:${latStr},${lonStr}?q=${latStr},${lonStr}(${labelEnc})`;
  const appleUri = `https://maps.apple.com/?daddr=${latStr},${lonStr}&q=${labelEnc}`;
  const googleUri = `https://www.google.com/maps/dir/?api=1&destination=${latStr},${lonStr}&travelmode=walking`;

  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS =
    /iP(hone|od|ad)/i.test(ua) ||
    (navigator.platform && /iP(hone|od|ad)/.test(navigator.platform));

  if (isAndroid) {
    window.location.href = geoUri;
    return;
  }

  if (isIOS) {
    window.location.href = appleUri;
    return;
  }

  // Desktop / other: open Google Maps directions in a new tab
  window.open(googleUri, "_blank", "noopener");
}

// Basic HTML escaping for popup text
function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type Node = {
  id: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

// Parse OSM XML Document into node objects
function parseOsmDoc(xmlDoc: Document) {
  const nodeEls = Array.from(xmlDoc.getElementsByTagName("node"));
  return nodeEls.map((nodeEl: Element): Node => {
    const id = nodeEl.getAttribute("id") as string;
    const lat = parseFloat(nodeEl.getAttribute("lat") as string);
    const lon = parseFloat(nodeEl.getAttribute("lon") as string);
    const tagEls = Array.from(nodeEl.getElementsByTagName("tag"));
    const tags: Record<string, string> = {};
    tagEls.forEach((t) => {
      const k = t.getAttribute("k") as string;
      const v = t.getAttribute("v") as string;
      tags[k] = v;
    });
    return { id, lat, lon, tags };
  });
}

// Create circle markers for nodes and add to the provided layer
function addNodesToLayer(nodes: Node[], layer: L.FeatureGroup<any>) {
  nodes.forEach((n) => {
    if (!isFinite(n.lat) || !isFinite(n.lon)) return;

    const cTag = (n.tags.colour || "").toLowerCase();
    const color = colourMap[cTag] || colourMap.default;
    const seasonal = (n.tags.seasonal || "").toLowerCase() === "yes";

    let radius = 6;
    if ((n.tags.bottle || "") === "yes") radius = 7;
    if ((n.tags.wheelchair || "") === "yes") radius = 8;

    const circle = L.circleMarker([n.lat, n.lon], {
      radius,
      color: "#333",
      weight: 1,
      fillColor: color,
      fillOpacity: seasonal ? 0.35 : 0.75,
    }).addTo(layer);

    const popupParts = [];
    popupParts.push(`<strong>water_tap (id: ${n.id})</strong>`);
    if (n.tags.operator)
      popupParts.push(`<div>Operator: ${escapeHtml(n.tags.operator)}</div>`);
    if (n.tags.note)
      popupParts.push(`<div>Note: ${escapeHtml(n.tags.note)}</div>`);
    if (n.tags.seasonal)
      popupParts.push(`<div>Seasonal: ${escapeHtml(n.tags.seasonal)}</div>`);
    if (n.tags.bottle)
      popupParts.push(`<div>Bottle refill: ${escapeHtml(n.tags.bottle)}</div>`);
    if (n.tags.wheelchair)
      popupParts.push(
        `<div>Wheelchair: ${escapeHtml(n.tags.wheelchair)}</div>`,
      );

    // Actions container: prominent Navigate button + OSM link
    popupParts.push(
      `<div class="popup-actions">` +
        // Navigate button (prominent)
        `<button type="button" class="navigate-btn" data-lat="${n.lat}" data-lon="${n.lon}" aria-label="Navigate to water tap ${n.id}"><span class="icon" aria-hidden="true">🧭</span><span class="label">Navigate</span></button>` +
        // secondary OpenStreetMap link
        `<a class="popup-secondary" target="_blank" rel="noreferrer" href="https://www.openstreetmap.org/node/${n.id}">Open node on OpenStreetMap</a>` +
        `</div>`,
    );

    circle.bindPopup(popupParts.join(""));

    // Attach handler on popupopen for accessibility and to avoid inline handlers
    circle.on("popupopen", (e) => {
      try {
        const popupEl = e.popup.getElement();
        if (!popupEl) return;

        const navBtn = popupEl.querySelector(".navigate-btn");
        if (navBtn && !navBtn.__bound) {
          navBtn.__bound = true;

          navBtn.addEventListener("click", (ev) => {
            ev.preventDefault();
            const lat = navBtn.getAttribute("data-lat") as string;
            const lon = navBtn.getAttribute("data-lon") as string;
            openNavigation(lat, lon, `water_tap ${n.id}`);
          });

          // Make sure the button is reachable by keyboard/tab
          navBtn.setAttribute("tabindex", "0");
          navBtn.setAttribute("role", "button");
        }

        // Also make the OSM link keyboard friendly (it's already a link but ensure focusability)
        const osmLink = popupEl.querySelector(".popup-secondary");
        if (osmLink) {
          osmLink.setAttribute("role", "link");
          osmLink.setAttribute("tabindex", "0");
        }
      } catch (err) {
        // non-fatal
        console.info(
          "Failed to attach popup action handlers:",
          err && err.message,
        );
      }
    });
  });
}

// Load external points.xml (must be served via http(s) or localhost)
function loadPointsXml() {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(points, "application/xml");

  // detect parse errors
  const parsererror = xmlDoc.getElementsByTagName("parsererror");
  if (parsererror.length > 0) {
    throw new Error("Failed to parse points.xml as XML.");
  }
  return xmlDoc;
}

// Fetch and render points
(function initPoints() {
  const nodes = parseOsmDoc(loadPointsXml());
  if (nodes.length === 0) {
    console.warn("No nodes found in points.xml");
    return;
  }

  addNodesToLayer(nodes, pointsLayer);

  // Add layer control
  L.control
    .layers(undefined, { "Water taps": pointsLayer }, { collapsed: false })
    .addTo(map);

  // Fit bounds to points if available
  const bounds = pointsLayer.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.01), { maxZoom: 15 });
  }
})();

// Locate control (right middle)
function locateMe() {
  if (!("geolocation" in navigator)) {
    alert("Geolocation is not available in this browser.");
    return;
  }

  const isSecure =
    location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";
  if (!isSecure) {
    alert(
      "Geolocation requires a secure context (HTTPS) or localhost. Serve the page from http://localhost or via HTTPS to enable location.",
    );
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const accuracy = pos.coords.accuracy;

      const userCircle = L.circle([lat, lon], {
        radius: Math.max(10, accuracy),
        color: "#136AEC",
        fillColor: "#2A93EE",
        fillOpacity: 0.25,
      }).addTo(map);

      const userMarker = L.marker([lat, lon]).addTo(map);
      userMarker.bindPopup("You are here (approx.)").openPopup();

      map.setView([lat, lon], 13);
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        alert(
          "Permission to access location was denied. Check your browser site settings and allow location access.",
        );
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        alert("Location information is unavailable.");
      } else if (err.code === err.TIMEOUT) {
        alert("Location request timed out. Try again.");
      } else {
        alert("Unable to retrieve your location: " + err.message);
      }
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
  );
}

// Add locate control to topright, then adjust via CSS to vertical center
const locateControl = L.control({ position: "topright" });
locateControl.onAdd = function () {
  const container = L.DomUtil.create(
    "div",
    "leaflet-bar leaflet-control locate-control",
  );
  container.classList.add("locate-control"); // used by CSS selector
  const link = L.DomUtil.create("a", "", container);
  link.href = "#";
  link.title = "Show my location";
  link.setAttribute("aria-label", "Show my location");
  link.innerHTML = "📍";
  L.DomEvent.on(link, "click", L.DomEvent.stopPropagation)
    .on(link, "click", L.DomEvent.preventDefault)
    .on(link, "click", locateMe);
  return container;
};
locateControl.addTo(map);

// keyboard accessibility for locate control
setTimeout(() => {
  const el = document.querySelector('.leaflet-bar a[title="Show my location"]');
  if (el) {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.click();
      }
    });
  }
}, 100);

// Try registering service worker for offline (if present)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((err) => {
    // registration failure is non-fatal — log for debugging
    console.info("Service worker registration failed:", err && err.message);
  });
}
