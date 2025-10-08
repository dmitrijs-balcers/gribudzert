/**
 * Data fetching functionality
 */

import type { Overpass, Element } from "../../types/overpass";
import type { Result } from "../../types/result";
import type { FetchError } from "../../types/errors";
import { Ok, Err } from "../../types/result";
import { OVERPASS_API_URL } from "../../core/config";

/**
 * Fetch water points from Overpass API
 * @param query - Overpass QL query string
 * @returns Result with elements or fetch error
 */
export async function fetchWaterPoints(
  query: string,
): Promise<Result<Element[], FetchError>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(OVERPASS_API_URL, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return Err({
        type: "network",
        message: `HTTP error! status: ${response.status}`,
      });
    }

    const data: Overpass = await response.json();
    return Ok(data.elements);
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return Err({
          type: "timeout",
          message: "Request timed out after 30 seconds",
        });
      }
      return Err({
        type: "network",
        message: err.message,
      });
    }
    return Err({
      type: "network",
      message: "Unknown error occurred during fetch",
    });
  }
}
