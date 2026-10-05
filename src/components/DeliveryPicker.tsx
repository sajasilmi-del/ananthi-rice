"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  acceptGeolocationFix,
  checkDelivery,
  deliveryStatusText,
  geolocationErrorKey,
  lookupAddress,
  resolveDeliveryConfig,
} from "@/lib/delivery";
import { t } from "@/lib/i18n";
import type { ConfirmedLocation } from "@/lib/types";
import { useDeliveryLocation, useLanguage } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";

const MapPin = dynamic(() => import("@/components/MapPin").then((mod) => mod.MapPin), {
  ssr: false,
});

type Draft = {
  latitude: number;
  longitude: number;
  source: ConfirmedLocation["source"];
};

export function DeliveryPicker({ heading = "h2" }: { heading?: "h2" | "h3" }) {
  const Heading = heading;
  const { locale } = useLanguage();
  const { confirmed, confirm, clearLocation } = useDeliveryLocation();
  const [editing, setEditing] = useState(confirmed == null);
  const [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => {
    setEditing(confirmed == null);
  }, [confirmed]);
  const [addressLabel, setAddressLabel] = useState(confirmed?.addressLabel ?? "");
  const [error, setError] = useState("");
  const [lookupPending, setLookupPending] = useState(false);
  const origin = resolveDeliveryConfig().origin;
  const serviceOrigin =
    origin.latitude == null || origin.longitude == null
      ? null
      : { latitude: origin.latitude, longitude: origin.longitude };

  const activePoint = draft ?? (editing ? null : confirmed);
  const result = checkDelivery(activePoint);

  function useCurrentLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError(t(locale, "errors.browserUnsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!acceptGeolocationFix(position.coords.accuracy)) {
          setError(t(locale, "errors.locationInaccurate"));
          return;
        }
        setDraft({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "browser",
        });
        setEditing(true);
      },
      (geoError) => {
        setError(t(locale, geolocationErrorKey(geoError.code)));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  async function findAddress() {
    setError("");
    setLookupPending(true);
    const found = await lookupAddress(addressLabel);
    setLookupPending(false);
    if (!found.ok) {
      setError(found.reason === "network" ? t(locale, "errors.network") : t(locale, "errors.invalidAddress"));
      return;
    }
    setDraft({ latitude: found.latitude, longitude: found.longitude, source: "address" });
    setEditing(true);
  }

  function confirmDraft() {
    if (!draft) {
      setError(t(locale, "errors.invalidAddress"));
      return;
    }
    const next: ConfirmedLocation = {
      latitude: draft.latitude,
      longitude: draft.longitude,
      source: draft.source,
      addressLabel: addressLabel.trim(),
      confirmedAt: new Date().toISOString(),
    };
    confirm(next);
    setEditing(false);
    setError("");
  }

  return (
    <section className="stack" data-testid="delivery-picker">
      <Heading>{t(locale, "delivery.title")}</Heading>
      {confirmed && !editing ? (
        <div className="stack">
          <p data-testid="delivery-saved">
            {t(locale, "delivery.saved")}: {confirmed.addressLabel || `${confirmed.latitude.toFixed(5)}, ${confirmed.longitude.toFixed(5)}`}
          </p>
          <p data-testid="delivery-status">{deliveryStatusText(result, locale)}</p>
          <Button
            variant="secondary"
            data-testid="change-location"
            onClick={() => {
              clearLocation();
              setDraft(null);
            }}
          >
            {t(locale, "delivery.change")}
          </Button>
        </div>
      ) : (
        <div className="stack">
          <Button variant="secondary" onClick={useCurrentLocation} data-testid="use-current-location">
            {t(locale, "delivery.useCurrent")}
          </Button>
          <FormField label={t(locale, "delivery.enterAddress")}>
            <input
              value={addressLabel}
              onChange={(event) => setAddressLabel(event.target.value)}
              aria-label={t(locale, "delivery.addressHint")}
              data-testid="delivery-address"
            />
          </FormField>
          <Button variant="secondary" onClick={() => void findAddress()} disabled={lookupPending} data-testid="lookup-address">
            {t(locale, "delivery.lookup")}
          </Button>
          <p>{t(locale, "delivery.pickOnMap")}</p>
          <MapPin
            value={draft}
            origin={serviceOrigin}
            onChange={(point) => {
              setDraft({ ...point, source: "map" });
              setError("");
            }}
            onError={() => setError(t(locale, "errors.mapUnavailable"))}
          />
          <p data-testid="delivery-status">{deliveryStatusText(result, locale)}</p>
          {error ? <p className="error" data-testid="delivery-error">{error}</p> : null}
          <Button onClick={confirmDraft} data-testid="confirm-location">
            {t(locale, "delivery.confirm")}
          </Button>
        </div>
      )}
    </section>
  );
}
