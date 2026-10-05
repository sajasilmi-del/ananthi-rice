"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { useLanguage } from "@/components/Providers";
import { formatMessage, t } from "@/lib/i18n";
import type { BrandId } from "@/lib/types";

export function ProductCard({
  testId,
  detail = false,
  imageSrc,
  imageAlt,
  images,
  brand,
  href,
  children,
}: {
  testId: string;
  detail?: boolean;
  imageSrc: string;
  imageAlt: string;
  images?: string[];
  brand?: BrandId;
  href?: string;
  children: ReactNode;
}) {
  const { locale } = useLanguage();
  const frames = images && images.length > 0 ? images : [imageSrc];
  const [index, setIndex] = useState(0);
  const safeIndex = index < frames.length ? index : 0;
  const src = frames[safeIndex] ?? imageSrc;

  return (
    <article
      className={detail ? "card product-card product-card-detail stack" : "card product-card stack"}
      data-testid={testId}
      data-brand={brand}
    >
      <div className="product-card-media">
        <div className="product-gallery" data-testid={detail ? "product-gallery" : undefined}>
          <div className="product-gallery-frame">
            {!detail && href ? (
              <Link href={href} tabIndex={-1} aria-hidden="true">
                <CatalogImage src={src} alt="" width={270} height={330} sizes="(max-width: 767px) 46vw, 280px" />
              </Link>
            ) : (
              <CatalogImage
                src={src}
                alt={imageAlt}
                width={detail ? 540 : 270}
                height={detail ? 660 : 330}
                sizes={detail ? "(max-width: 767px) 92vw, 560px" : "(max-width: 767px) 46vw, 280px"}
                priority={detail}
              />
            )}
          </div>
          {detail && frames.length > 1 ? (
            <div className="gallery-thumbs" role="group" aria-label={t(locale, "products.gallery")}>
              {frames.map((frame, frameIndex) => (
                <button
                  key={frame}
                  type="button"
                  className="gallery-thumb"
                  aria-pressed={frameIndex === safeIndex}
                  aria-label={formatMessage(t(locale, "products.galleryImage"), { index: frameIndex + 1 })}
                  onClick={() => setIndex(frameIndex)}
                >
                  <CatalogImage src={frame} alt="" width={45} height={55} sizes="72px" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="product-card-body">{children}</div>
    </article>
  );
}
