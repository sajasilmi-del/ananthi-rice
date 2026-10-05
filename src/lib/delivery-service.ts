import { deliveryConfig } from "@/lib/catalog";
import { formatMessage, t } from "@/lib/i18n";
import type { ConfirmedLocation, DeliveryConfig, LatLng, Locale } from "@/lib/types";

/** Business rule: delivery is offered only inside this radius. */
export const DELIVERY_RADIUS_KM = 5;

/**
 * Required production configuration.
 * Set DELIVERY_ORIGIN_LATITUDE and DELIVERY_ORIGIN_LONGITUDE to the store origin.
 * Leave both empty until the business supplies them. Do not invent coordinates,
 * and do not copy a customer's location into these values.
 */
export const DELIVERY_ORIGIN_LATITUDE = "DELIVERY_ORIGIN_LATITUDE";
export const DELIVERY_ORIGIN_LONGITUDE = "DELIVERY_ORIGIN_LONGITUDE";

/** A GPS fix coarser than this is not used as a delivery pin. */
export const LOCATION_ACCURACY_LIMIT_METERS = 1000;

const EARTH_RADIUS_KM = 6371;

export const DELIVERY_LOCATION_KEY = "ananthi.deliveryLocation";

export const DELIVERY_UNAVAILABLE_EN = t("en", "delivery.unavailable");
export const DELIVERY_UNAVAILABLE_TA = t("ta", "delivery.unavailable");
export const DELIVERY_AVAILABLE_EN = t("en", "delivery.available");
export const DELIVERY_AVAILABLE_TA = t("ta", "delivery.available");

export type DeliveryResult =
  | { status: "disabled" }
  | { status: "origin_not_configured" }
  | { status: "location_required" }
  | { status: "invalid_location" }
  | { status: "available"; distanceKm: number }
  | {
      status: "unavailable";
      distanceKm: number;
      messageEn: string;
      messageTa: string;
    };

export type AddressLookup =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: "empty" | "invalid" | "network" };

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function isValidLatLng(point: LatLng | null | undefined): point is LatLng {
  if (!point) return false;
  return (
    Number.isFinite(point.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    Number.isFinite(point.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

export function haversineKm(origin: LatLng, customer: LatLng): number {
  const latitudeDelta = toRadians(customer.latitude - origin.latitude);
  const longitudeDelta = toRadians(customer.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const customerLatitude = toRadians(customer.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(customerLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

/** Due-north point at a spherical distance. Uses the same earth radius as haversineKm. */
export function pointDueNorth(origin: LatLng, distanceKm: number): LatLng {
  const deltaDegrees = (distanceKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  return { latitude: origin.latitude + deltaDegrees, longitude: origin.longitude };
}

export function isWithinDeliveryRadius(distanceKm: number, radiusKm = DELIVERY_RADIUS_KM): boolean {
  return Number.isFinite(distanceKm) && Number.isFinite(radiusKm) && distanceKm <= radiusKm;
}

export function roundKm(distanceKm: number): number {
  return Math.round(distanceKm * 10) / 10;
}

export function formatDistanceKm(distanceKm: number): string {
  return distanceKm.toFixed(2);
}

function parseCoord(value: string | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Reads the production origin. A customer's coordinates are not an input.
 * Both environment values must be present and valid. An empty pair falls
 * back to the file configuration, which stays empty until coordinates are supplied.
 */
export function resolveDeliveryOrigin(
  base: DeliveryConfig["origin"] = deliveryConfig.origin,
  latitudeRaw: string | undefined = process.env.DELIVERY_ORIGIN_LATITUDE,
  longitudeRaw: string | undefined = process.env.DELIVERY_ORIGIN_LONGITUDE,
): { latitude: number | null; longitude: number | null } {
  const latText = latitudeRaw?.trim() ?? "";
  const lngText = longitudeRaw?.trim() ?? "";
  if (latText || lngText) {
    const latitude = parseCoord(latitudeRaw);
    const longitude = parseCoord(longitudeRaw);
    if (latitude == null || longitude == null || !isValidLatLng({ latitude, longitude })) {
      return { latitude: null, longitude: null };
    }
    return { latitude, longitude };
  }
  if (base.latitude == null || base.longitude == null) return { latitude: null, longitude: null };
  if (!isValidLatLng({ latitude: base.latitude, longitude: base.longitude })) {
    return { latitude: null, longitude: null };
  }
  return { latitude: base.latitude, longitude: base.longitude };
}

export function resolveDeliveryConfig(
  base: DeliveryConfig = deliveryConfig,
  latitudeRaw: string | undefined = process.env.DELIVERY_ORIGIN_LATITUDE,
  longitudeRaw: string | undefined = process.env.DELIVERY_ORIGIN_LONGITUDE,
): DeliveryConfig {
  return {
    ...base,
    radiusKm: DELIVERY_RADIUS_KM,
    origin: resolveDeliveryOrigin(base.origin, latitudeRaw, longitudeRaw),
  };
}

function configuredOrigin(config: DeliveryConfig): LatLng | null {
  const { latitude, longitude } = config.origin;
  if (latitude == null || longitude == null) return null;
  if (!isValidLatLng({ latitude, longitude })) return null;
  return { latitude, longitude };
}

export function evaluateDelivery(config: DeliveryConfig, customer: LatLng | null): DeliveryResult {
  if (!config.enabled) return { status: "disabled" };
  const origin = configuredOrigin(config);
  if (!origin) return { status: "origin_not_configured" };
  if (!customer) return { status: "location_required" };
  if (!isValidLatLng(customer)) return { status: "invalid_location" };
  const distanceKm = haversineKm(origin, customer);
  if (!Number.isFinite(distanceKm)) return { status: "invalid_location" };
  if (isWithinDeliveryRadius(distanceKm, config.radiusKm)) {
    return { status: "available", distanceKm };
  }
  return {
    status: "unavailable",
    distanceKm,
    messageEn: DELIVERY_UNAVAILABLE_EN,
    messageTa: DELIVERY_UNAVAILABLE_TA,
  };
}

export function checkDelivery(customer: LatLng | null): DeliveryResult {
  return evaluateDelivery(resolveDeliveryConfig(), customer);
}

export function checkoutAllowed(result: DeliveryResult): boolean {
  return result.status === "available";
}

export function deliveryStatusText(result: DeliveryResult, locale: Locale): string {
  if (result.status === "available") {
    const distance = formatMessage(t(locale, "delivery.distance"), { km: formatDistanceKm(result.distanceKm) });
    return `${t(locale, "delivery.available")} (${distance})`;
  }
  if (result.status === "unavailable") {
    const message = locale === "ta" ? result.messageTa : result.messageEn;
    const distance = formatMessage(t(locale, "delivery.distance"), { km: formatDistanceKm(result.distanceKm) });
    return `${message} (${distance})`;
  }
  if (result.status === "origin_not_configured") return t(locale, "errors.originNotConfigured");
  if (result.status === "disabled") return t(locale, "delivery.disabled");
  if (result.status === "invalid_location") return t(locale, "errors.invalidAddress");
  return t(locale, "delivery.needPin");
}

export function acceptGeolocationFix(accuracy: number | null | undefined): boolean {
  if (accuracy == null || !Number.isFinite(accuracy)) return true;
  return accuracy <= LOCATION_ACCURACY_LIMIT_METERS;
}

export function geolocationErrorKey(code: number): "errors.permissionDenied" | "errors.locationUnavailable" | "errors.network" {
  if (code === 1) return "errors.permissionDenied";
  if (code === 3) return "errors.network";
  return "errors.locationUnavailable";
}

export async function lookupAddress(query: string, fetchImpl: typeof fetch = fetch): Promise<AddressLookup> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  try {
    const response = await fetchImpl(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(trimmed)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) return { ok: false, reason: "network" };
    const body = (await response.json()) as unknown;
    if (!Array.isArray(body) || body.length === 0) return { ok: false, reason: "invalid" };
    const first = body[0] as { lat?: string; lon?: string };
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);
    if (!isValidLatLng({ latitude, longitude })) return { ok: false, reason: "invalid" };
    return { ok: true, latitude, longitude };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export function readConfirmedLocation(storage: Pick<Storage, "getItem">): ConfirmedLocation | null {
  const raw = storage.getItem(DELIVERY_LOCATION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConfirmedLocation;
    if (!isValidLatLng(parsed)) return null;
    if (parsed.source !== "browser" && parsed.source !== "map" && parsed.source !== "address") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConfirmedLocation(storage: Pick<Storage, "setItem">, location: ConfirmedLocation): void {
  storage.setItem(DELIVERY_LOCATION_KEY, JSON.stringify(location));
}
