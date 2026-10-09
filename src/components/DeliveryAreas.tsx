"use client";

import { useLanguage } from "@/components/Providers";
import { formatMessage, t } from "@/lib/i18n";
import { serviceAreas, type ServiceArea } from "@/lib/service-area";

export function DeliveryAreas() {
  const { locale } = useLanguage();
  const groups: { city: string; areas: ServiceArea[] }[] = [];
  for (const area of serviceAreas) {
    const city = locale === "ta" ? area.cityTamil : area.cityEnglish;
    const last = groups.at(-1);
    if (!last || last.city !== city) groups.push({ city, areas: [area] });
    else last.areas.push(area);
  }
  return (
    <div className="stack" data-testid="delivery-areas">
      <p className="muted">{t(locale, "delivery.checkoutNote")}</p>
      {groups.map((group) => (
        <section key={group.city} className="delivery-city">
          <h3>{formatMessage(t(locale, "delivery.areaListTitle"), { city: group.city })}</h3>
          <ul className="delivery-area-list">
            {group.areas.map((area) => (
              <li key={area.pincode}>
                <span className="pincode-code">{area.pincode}</span>
                <span>{locale === "ta" ? area.areasTamil : area.areasEnglish}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
