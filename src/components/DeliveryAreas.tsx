"use client";

import { useLanguage } from "@/components/Providers";
import { t } from "@/lib/i18n";
import { serviceAreas } from "@/lib/service-area";

export function DeliveryAreas() {
  const { locale } = useLanguage();
  return (
    <div className="stack" data-testid="delivery-areas">
      <h3>{t(locale, "delivery.areaListTitle")}</h3>
      <p className="muted">{t(locale, "delivery.checkoutNote")}</p>
      <ul className="delivery-area-list">
        {serviceAreas.map((area) => (
          <li key={area.pincode}>
            <span className="pincode-code">{area.pincode}</span>
            <span>{locale === "ta" ? area.areasTamil : area.areasEnglish}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
