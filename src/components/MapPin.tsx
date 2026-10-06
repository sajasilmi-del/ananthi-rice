"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { DELIVERY_RADIUS_KM } from "@/lib/delivery";
import { t } from "@/lib/i18n";
import { mapViewCenter } from "@/lib/maps";
import type { LatLng } from "@/lib/types";
import { useLanguage } from "@/components/Providers";

export function MapPin({
  value,
  origin = null,
  fallback = null,
  onChange,
  onError,
}: {
  value: LatLng | null;
  origin?: LatLng | null;
  fallback?: LatLng | null;
  onChange: (value: LatLng) => void;
  onError?: () => void;
}) {
  const { locale } = useLanguage();
  const attributionRef = useRef(t(locale, "map.attribution"));
  attributionRef.current = t(locale, "map.attribution");
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  const originRef = useRef(origin);
  const fallbackRef = useRef(fallback);
  onChangeRef.current = onChange;
  onErrorRef.current = onError;
  originRef.current = origin;
  fallbackRef.current = fallback;
  const view = mapViewCenter(origin, fallback);

  useEffect(() => {
    let cancelled = false;
    const node = holder.current;
    void import("leaflet")
      .then((leaflet) => {
        if (cancelled || !node || mapRef.current) return;
        const serviceOrigin = originRef.current;
        const view = mapViewCenter(serviceOrigin, fallbackRef.current);
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const map = leaflet.map(node, {
          zoomAnimation: !reduced,
          fadeAnimation: !reduced,
          markerZoomAnimation: !reduced,
          center: [view.latitude, view.longitude],
          zoom: view.zoom,
        });
        mapRef.current = map;
        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: attributionRef.current,
          })
          .addTo(map);
        map.on("click", (event) => {
          onChangeRef.current({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          });
        });
        map.whenReady(() => {
          if (cancelled || mapRef.current !== map || !map.getPane("mapPane")) return;
          try {
            map.invalidateSize();
            if (!serviceOrigin) return;
            leaflet
              .circle([serviceOrigin.latitude, serviceOrigin.longitude], {
                radius: DELIVERY_RADIUS_KM * 1000,
                color: "#600030",
                weight: 2,
                fillColor: "#E0A000",
                fillOpacity: 0.12,
              })
              .addTo(map);
          } catch {
            // A fast navigation can remove the map while the first view is opening.
          }
        });
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current?.();
      });
    return () => {
      cancelled = true;
      const map = mapRef.current;
      mapRef.current = null;
      markerRef.current = null;
      if (!map) return;
      try {
        map.stop();
        map.remove();
      } catch {
        // Leaflet throws if removal overlaps a view update.
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    let cancelled = false;
    void import("leaflet").then((leaflet) => {
      const place = () => {
        if (cancelled || mapRef.current !== map || !map.getPane("mapPane")) return;
        try {
          if (!markerRef.current) {
            markerRef.current = leaflet.circleMarker([value.latitude, value.longitude], {
              radius: 8,
              color: "#600030",
              weight: 2,
              fillColor: "#E0A000",
              fillOpacity: 0.95,
            }).addTo(map);
          } else {
            markerRef.current.setLatLng([value.latitude, value.longitude]);
          }
          const zoom = map.getZoom();
          map.setView([value.latitude, value.longitude], Number.isFinite(zoom) ? Math.max(zoom, 14) : 14, { animate: false });
        } catch {
          // The map can close while the marker is being moved.
        }
      };
      if (map.getPane("mapPane")) place();
      else map.whenReady(place);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div
      ref={holder}
      className="delivery-map"
      data-testid="delivery-map"
      data-map-center={`${view.latitude},${view.longitude}`}
      data-map-zoom={view.zoom}
      role="application"
      aria-label={t(locale, "delivery.pickOnMap")}
    />
  );
}
