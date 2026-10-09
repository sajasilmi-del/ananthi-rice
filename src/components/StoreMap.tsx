"use client";

import { locationEmbedUrl } from "@/lib/maps";
import type { LocationRecord } from "@/lib/types";
import { useLanguage } from "@/components/Providers";

export function StoreMap({ location }: { location: LocationRecord }) {
  const { locale } = useLanguage();
  const src = locationEmbedUrl(location, locale);
  if (!src) return null;
  const title = locale === "ta" ? location.nameTamil : location.nameEnglish;
  return (
    <figure className="store-map-figure">
      <figcaption>{title}</figcaption>
      <iframe
        className="store-map"
        title={title}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        data-testid={`store-map-${location.id}`}
      />
    </figure>
  );
}
