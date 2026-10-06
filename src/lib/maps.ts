import type { Locale, LocationRecord } from "@/lib/types";

/** Opens the published Google listing, or a pin, or an address search. */
export function locationDirectionsUrl(location: LocationRecord): string {
  if (location.mapUrl) return location.mapUrl;
  if (location.latitude != null && location.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.addressEnglish.join(", "))}`;
}

/** Embedded map for a location that has a Google listing or coordinates. */
export function locationEmbedUrl(location: LocationRecord, locale: Locale): string | null {
  const hl = locale === "ta" ? "ta" : "en";
  if (location.mapCid) {
    return `https://maps.google.com/maps?cid=${encodeURIComponent(location.mapCid)}&hl=${hl}&z=17&output=embed`;
  }
  if (location.latitude == null || location.longitude == null) return null;
  return `https://maps.google.com/maps?q=${location.latitude},${location.longitude}&hl=${hl}&z=17&output=embed`;
}
