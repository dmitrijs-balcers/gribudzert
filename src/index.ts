import * as L from "leaflet";
import drinkingWater from "./oql/drinking_water.overpassql?raw";
import type { Element as OverpassElement } from "./types/overpass";
import { isOk } from "./types/result";
import { fetchWaterPoints } from "./features/data/fetch";
import { addMarkers } from "./features/markers/markers";
import { locateUser } from "./features/location/geolocation";
import { showNotification } from "./ui/notifications";
import { showLoading, hideLoading } from "./ui/loading";
import * as logger from "./utils/logger";
import {
  rigaLatLng,
  defaultZoom,
  maxZoom,
  tileLayerUrl,
  osmAttribution,
} from "./core/config";

/**
 * Initialize and setup the map
 */
async function initializeApp(): Promise<void> {
  try {
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

    // Layer to hold water points
    const pointsLayer: L.FeatureGroup<L.CircleMarker> = L.featureGroup().addTo(map);

    // Show loading indicator while fetching data
    showLoading(200);

    // Fetch water points from Overpass API
    const result = await fetchWaterPoints(drinkingWater);

    hideLoading();

    if (!isOk(result)) {
      // Handle fetch error
      const errorMessages = {
        network: "Failed to load water points. Please check your internet connection and try refreshing the page.",
        timeout: "Request timed out while loading water points. Please try refreshing the page.",
        parse: "Failed to parse water point data. Please try refreshing the page.",
      };

      const message = errorMessages[result.error.type] || "Failed to load water points. Please try refreshing the page.";
      showNotification(message, "error", 0); // 0 = no auto-dismiss
      logger.error("Failed to fetch water points:", result.error);
      return;
    }

    const nodes = result.value;

    // Handle empty state
    if (nodes.length === 0) {
      showNotification(
        "No water points found in the current area. Try zooming out or refreshing the page.",
        "warning",
        0
      );
      logger.warn("No water points returned from API");
      return;
    }

    // Add markers to map
    addMarkers(nodes, pointsLayer, map);

    // Add layer control
    L.control
      .layers(undefined, { "Water taps": pointsLayer }, { collapsed: false })
      .addTo(map);

    // Fit bounds to points if available
    const bounds = pointsLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.01), { maxZoom: 15 });
    }

    // Setup locate control
    setupLocateControl(map);

    logger.info(`Successfully loaded ${nodes.length} water points`);
  } catch (error) {
    hideLoading();
    showNotification(
      "An unexpected error occurred while initializing the map. Please refresh the page.",
      "error",
      0
    );
    logger.error("App initialization error:", error instanceof Error ? error.message : error);
  }
}

/**
 * Setup the locate control button
 */
function setupLocateControl(map: L.Map): void {
  const LocateControl = L.Control.extend({
    onAdd: function () {
      const container = L.DomUtil.create(
        "div",
        "leaflet-bar leaflet-control locate-control",
      );
      const link = L.DomUtil.create("a", "", container);
      link.href = "#";
      link.title = "Show my location";
      link.setAttribute("aria-label", "Show my location");
      link.setAttribute("role", "button");
      link.setAttribute("tabindex", "0");
      link.innerHTML = "📍";

      // Click handler
      const handleClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        locateUser(map);
      };

      L.DomEvent.on(link, "click", handleClick);

      // Keyboard handler
      link.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          locateUser(map);
        }
      });

      return container;
    },
  });

  const locateControl = new LocateControl({ position: "topright" });
  locateControl.addTo(map);
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

// Try registering service worker for offline (if present)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((err) => {
    logger.info("Service worker registration failed:", err instanceof Error ? err.message : err);
  });
}

