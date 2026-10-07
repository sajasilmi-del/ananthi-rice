import areasData from "@/data/delivery-areas.json";
import { DELIVERY_LOCATION_KEY } from "@/lib/delivery-service";
import { formatMessage, t } from "@/lib/i18n";
import type { ConfirmedServiceArea, Locale } from "@/lib/types";
import { isEmailAddress } from "@/lib/validation";

export type ServiceArea = {
  pincode: string;
  areasEnglish: string;
  areasTamil: string;
};

export type PincodeDelivery =
  | { status: "required" }
  | { status: "invalid" }
  | { status: "unavailable"; pincode: string }
  | { status: "available"; pincode: string; areasEnglish: string; areasTamil: string };

export const DELIVERY_CITY_EN = areasData.cityEnglish;
export const DELIVERY_CITY_TA = areasData.cityTamil;
export const serviceAreas = areasData.areas as ServiceArea[];

export type DeliveryAddressInput = {
  name: string;
  door: string;
  building: string;
  street: string;
  locality: string;
  phone: string;
  email: string;
  pincode: string;
};

export function normalizePincode(value: string): string {
  return value.replace(/\D/g, "");
}

export function assessPincode(value: string): PincodeDelivery {
  const pincode = normalizePincode(value);
  if (!pincode) return { status: "required" };
  if (!/^[0-9]{6}$/.test(pincode)) return { status: "invalid" };
  const area = serviceAreas.find((item) => item.pincode === pincode);
  if (!area) return { status: "unavailable", pincode };
  return {
    status: "available",
    pincode: area.pincode,
    areasEnglish: area.areasEnglish,
    areasTamil: area.areasTamil,
  };
}

export function cityLabel(locale: Locale): string {
  return locale === "ta" ? DELIVERY_CITY_TA : DELIVERY_CITY_EN;
}

export function areaLabel(result: Extract<PincodeDelivery, { status: "available" }>, locale: Locale): string {
  return locale === "ta" ? result.areasTamil : result.areasEnglish;
}

export function pincodeStatusText(result: PincodeDelivery, locale: Locale): string {
  if (result.status === "available") {
    return formatMessage(t(locale, "delivery.pincodeConfirmed"), {
      areas: areaLabel(result, locale),
      pincode: result.pincode,
    });
  }
  if (result.status === "unavailable") return t(locale, "delivery.pincodeSorry");
  if (result.status === "invalid") return t(locale, "delivery.pincodeInvalid");
  return t(locale, "delivery.pincodePrompt");
}

export function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateDeliveryAddress(input: DeliveryAddressInput, locale: Locale): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) errors.name = t(locale, "validation.nameRequired");
  else if (name.length < 2) errors.name = t(locale, "validation.nameShort");
  if (!input.door.trim()) errors.door = t(locale, "validation.doorRequired");
  if (!input.building.trim()) errors.building = t(locale, "validation.buildingRequired");
  if (!input.street.trim()) errors.street = t(locale, "validation.streetRequired");
  if (!input.locality.trim()) errors.locality = t(locale, "validation.localityRequired");
  const phone = normalizePhone(input.phone);
  if (!phone) errors.mobile = t(locale, "validation.mobileRequired");
  else if (!/^[0-9]{10}$/.test(phone)) errors.mobile = t(locale, "validation.mobileInvalid");
  const email = normalizeEmail(input.email);
  if (!email) errors.email = t(locale, "validation.emailRequired");
  else if (!isEmailAddress(email)) errors.email = t(locale, "validation.emailInvalid");
  const assessed = assessPincode(input.pincode);
  if (assessed.status !== "available") errors.pincode = pincodeStatusText(assessed, locale);
  return errors;
}

export function composeDeliveryAddress(input: DeliveryAddressInput, locale: Locale): string {
  const pincode = normalizePincode(input.pincode);
  const phone = normalizePhone(input.phone);
  return [input.door.trim(), input.building.trim(), input.street.trim(), input.locality.trim(), `${cityLabel(locale)} ${pincode}`, phone]
    .filter((part) => part.length > 0)
    .join(", ");
}

export function readConfirmedServiceArea(storage: Pick<Storage, "getItem">): ConfirmedServiceArea | null {
  const raw = storage.getItem(DELIVERY_LOCATION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConfirmedServiceArea>;
    if (parsed.source !== "pincode" || typeof parsed.pincode !== "string") return null;
    const assessed = assessPincode(parsed.pincode);
    if (assessed.status !== "available") return null;
    return {
      source: "pincode",
      pincode: assessed.pincode,
      areasEnglish: assessed.areasEnglish,
      areasTamil: assessed.areasTamil,
      addressLabel: typeof parsed.addressLabel === "string" ? parsed.addressLabel : assessed.areasEnglish,
      confirmedAt: typeof parsed.confirmedAt === "string" ? parsed.confirmedAt : "",
    };
  } catch {
    return null;
  }
}

export function writeConfirmedServiceArea(storage: Pick<Storage, "setItem">, area: ConfirmedServiceArea): void {
  const assessed = assessPincode(area.pincode);
  if (assessed.status !== "available") return;
  storage.setItem(
    DELIVERY_LOCATION_KEY,
    JSON.stringify({
      source: "pincode",
      pincode: assessed.pincode,
      areasEnglish: assessed.areasEnglish,
      areasTamil: assessed.areasTamil,
      addressLabel: area.addressLabel,
      confirmedAt: area.confirmedAt,
    }),
  );
}
