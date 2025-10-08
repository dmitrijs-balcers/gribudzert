import * as L from "leaflet";
import drinkingWater from "./oql/drinking_water.overpassql?raw";
import type { Overpass, Element as OverpassElement } from "./types/overpass";
import { escapeHtml } from "./utils/html";
import { getAttribute } from "./utils/dom";
import * as logger from "./utils/logger";
import {
  rigaLatLng,
  defaultZoom,
  maxZoom,
  tileLayerUrl,
  osmAttribution,
  colourMap,
  geolocationOptions,
  defaultMarkerRadius,
  userLocationColor,
  userLocationFillColor,
} from "./core/config";

// Basic map setup
const map = L.map("map", {
  center: rigaLatLng,
  zoom: defaultZoom,
  zoomControl: true,
});

L.tileLayer(tileLayerUrl, {
  maxZoom: maxZoom,
  attribution: osmAttribution,
}).addTo(map);

L.control.scale({ metric: true, imperial: false }).addTo(map);

// Layer to hold the points from points.xml
const pointsLayer: L.FeatureGroup<L.CircleMarker> = L.featureGroup().addTo(map);

// WeakSet to track elements that already have event handlers attached
const boundElements = new WeakSet<Element>();

// Platform-aware navigation opener (global helper)
function openNavigation(lat: string, lon: string, label: string): void {
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

type Node = {
  id: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

// Create circle markers for nodes and add to the provided layer
function addNodesToLayer(nodes: OverpassElement[], layer: L.FeatureGroup<L.CircleMarker>): void {
  nodes.forEach((n) => {
    if (!isFinite(n.lat) || !isFinite(n.lon)) return;

    const cTag = (n.tags.colour || "").toLowerCase();
    const color = colourMap[cTag] || colourMap.default;
    const seasonal = (n.tags.seasonal || "").toLowerCase() === "yes";

    let radius: number = defaultMarkerRadius;
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
        if (navBtn && !boundElements.has(navBtn)) {
          boundElements.add(navBtn);

          navBtn.addEventListener("click", (ev) => {
            ev.preventDefault();
            const lat = getAttribute(navBtn, "data-lat");
            const lon = getAttribute(navBtn, "data-lon");
            if (lat && lon) {
              openNavigation(lat, lon, `water_tap ${n.id}`);
            }
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
        logger.info(
          "Failed to attach popup action handlers:",
          err instanceof Error ? err.message : err,
        );
      }
    });
  });
}

// Fetch and render points
(function initPoints() {
  const nodes = parseOsmDoc(loadPointsXml());
  if (nodes.length === 0) {
    logger.warn("No nodes found in points.xml");
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
function locateMe(): void {
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
        color: userLocationColor,
        fillColor: userLocationFillColor,
        fillOpacity: 0.25,
      }).addTo(map);

      const userMarker = L.marker([lat, lon]).addTo(map);
      userMarker.bindPopup("You are here (approx.)").openPopup();

      map.setView([lat, lon], defaultZoom);
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
    geolocationOptions,
  );
}

// Add locate control to topright, then adjust via CSS to vertical center
const LocateControl = L.Control.extend({
  onAdd: function () {
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
  },
});

const locateControl = new LocateControl({ position: "topright" });
locateControl.addTo(map);

// keyboard accessibility for locate control
setTimeout(() => {
  const el = document.querySelector('.leaflet-bar a[title="Show my location"]');
  if (el) {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.addEventListener("keydown", (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === "Enter" || keyEvent.key === " ") {
        keyEvent.preventDefault();
        (el as HTMLElement).click();
      }
    });
  }
}, 100);

// Try registering service worker for offline (if present)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((err) => {
    // registration failure is non-fatal — log for debugging
    logger.info("Service worker registration failed:", err instanceof Error ? err.message : err);
  });
}

// TODO: Implement proper parseOsmDoc and loadPointsXml functions
function parseOsmDoc(xml: string): OverpassElement[] {
  // Placeholder implementation
  return [];
}

function loadPointsXml(): string {
  // Placeholder implementation
  return "";
}
