import { describe, expect, it } from "vitest";
import { deliveryConfig } from "@/lib/catalog";
import {
  DELIVERY_AVAILABLE_EN,
  DELIVERY_AVAILABLE_TA,
  DELIVERY_RADIUS_KM,
  DELIVERY_UNAVAILABLE_EN,
  DELIVERY_UNAVAILABLE_TA,
  LOCATION_ACCURACY_LIMIT_METERS,
  acceptGeolocationFix,
  checkoutAllowed,
  deliveryStatusText,
  evaluateDelivery,
  geolocationErrorKey,
  haversineKm,
  isWithinDeliveryRadius,
  lookupAddress,
  pointDueNorth,
  resolveDeliveryConfig,
  resolveDeliveryOrigin,
} from "@/lib/delivery";

const origin = { latitude: 0, longitude: 0 };
const configured = {
  ...deliveryConfig,
  radiusKm: DELIVERY_RADIUS_KM,
  origin,
};

describe("delivery service", () => {
  it("keeps the 5 km rule and the required sentences in the dictionaries", () => {
    expect(DELIVERY_RADIUS_KM).toBe(5);
    expect(DELIVERY_AVAILABLE_EN).toBe("Delivery available");
    expect(DELIVERY_AVAILABLE_TA).toBe("இந்த இடத்திற்கு டெலிவரி கிடைக்கும்");
    expect(DELIVERY_UNAVAILABLE_EN).toBe("Delivery not available for this location.");
    expect(DELIVERY_UNAVAILABLE_TA).toBe("இந்த இடத்திற்கு டெலிவரி வசதி இல்லை.");
    expect(resolveDeliveryConfig(deliveryConfig, "", "").radiusKm).toBe(5);
    expect(resolveDeliveryConfig({ ...deliveryConfig, radiusKm: 20 }, "", "").radiusKm).toBe(DELIVERY_RADIUS_KM);
  });

  it("reads the origin only from configuration and never from the customer", () => {
    expect(deliveryConfig.origin).toEqual({ latitude: null, longitude: null });
    expect(resolveDeliveryOrigin(deliveryConfig.origin, "", "")).toEqual({ latitude: null, longitude: null });
    expect(resolveDeliveryOrigin(deliveryConfig.origin, "9.5", "78.6")).toEqual({ latitude: 9.5, longitude: 78.6 });
    expect(resolveDeliveryOrigin({ latitude: 1, longitude: 2 }, "nope", "78.6")).toEqual({
      latitude: null,
      longitude: null,
    });
    expect(resolveDeliveryOrigin({ latitude: 1, longitude: 2 }, "", "")).toEqual({ latitude: 1, longitude: 2 });
    const customer = { latitude: 13.0382, longitude: 80.178 };
    expect(evaluateDelivery(resolveDeliveryConfig(deliveryConfig, "", ""), customer).status).toBe("origin_not_configured");
  });

  it("classifies 0.5, 2, 4.99, 5, 5.01, and 10 km without rounding across the boundary", () => {
    for (const distance of [0.5, 2, 4.99, 5]) {
      expect(isWithinDeliveryRadius(distance, DELIVERY_RADIUS_KM)).toBe(true);
      const customer = pointDueNorth(origin, distance);
      const measured = haversineKm(origin, customer);
      expect(Math.abs(measured - distance)).toBeLessThan(1e-6);
      const result = evaluateDelivery(configured, customer);
      expect(result.status).toBe("available");
      if (result.status === "available") expect(result.distanceKm).toBeLessThanOrEqual(DELIVERY_RADIUS_KM);
    }
    for (const distance of [5.01, 10]) {
      expect(isWithinDeliveryRadius(distance, DELIVERY_RADIUS_KM)).toBe(false);
      const customer = pointDueNorth(origin, distance);
      const measured = haversineKm(origin, customer);
      expect(Math.abs(measured - distance)).toBeLessThan(1e-6);
      const result = evaluateDelivery(configured, customer);
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") {
        expect(result.distanceKm).toBeGreaterThan(DELIVERY_RADIUS_KM);
        expect(result.messageEn).toBe(DELIVERY_UNAVAILABLE_EN);
        expect(result.messageTa).toBe(DELIVERY_UNAVAILABLE_TA);
        expect(checkoutAllowed(result)).toBe(false);
      }
    }
    const edge = evaluateDelivery(configured, pointDueNorth(origin, 5));
    expect(edge.status).toBe("available");
    expect(checkoutAllowed(edge)).toBe(true);
    expect(deliveryStatusText(edge, "en").startsWith("Delivery available")).toBe(true);
    expect(deliveryStatusText(edge, "en")).toContain("Distance:");
    const outside = evaluateDelivery(configured, pointDueNorth(origin, 5.01));
    expect(deliveryStatusText(outside, "en")).toContain("Delivery not available for this location.");
    expect(deliveryStatusText(outside, "en")).toContain("5.01");
    expect(deliveryStatusText(outside, "ta")).toContain("இந்த இடத்திற்கு டெலிவரி வசதி இல்லை.");
    expect(deliveryStatusText(outside, "ta")).not.toContain("இந்த இடத்திற்கு டெலிவரி கிடைக்கும்");
  });

  it("handles a missing browser fix, a bad pin, a coarse GPS reading, and address lookup failures", () => {
    expect(evaluateDelivery(configured, null).status).toBe("location_required");
    expect(evaluateDelivery(configured, { latitude: 120, longitude: 0 }).status).toBe("invalid_location");
    expect(checkoutAllowed(evaluateDelivery(configured, null))).toBe(false);
    expect(acceptGeolocationFix(undefined)).toBe(true);
    expect(acceptGeolocationFix(12)).toBe(true);
    expect(acceptGeolocationFix(LOCATION_ACCURACY_LIMIT_METERS)).toBe(true);
    expect(acceptGeolocationFix(LOCATION_ACCURACY_LIMIT_METERS + 1)).toBe(false);
    expect(geolocationErrorKey(1)).toBe("errors.permissionDenied");
    expect(geolocationErrorKey(2)).toBe("errors.locationUnavailable");
    expect(geolocationErrorKey(3)).toBe("errors.network");
  });

  it("accepts only a geocoder point for a typed address", async () => {
    expect(await lookupAddress("  ", fetch)).toEqual({ ok: false, reason: "empty" });
    const network = async () => {
      throw new Error("offline");
    };
    expect(await lookupAddress("Paramakudi", network as typeof fetch)).toEqual({ ok: false, reason: "network" });
    const missing = async () =>
      ({
        ok: true,
        json: async () => [],
      }) as Response;
    expect(await lookupAddress("nowhere", missing as typeof fetch)).toEqual({ ok: false, reason: "invalid" });
    const found = async () =>
      ({
        ok: true,
        json: async () => [{ lat: "9.55", lon: "78.59" }],
      }) as Response;
    expect(await lookupAddress("Paramakudi", found as typeof fetch)).toEqual({
      ok: true,
      latitude: 9.55,
      longitude: 78.59,
    });
  });
});
