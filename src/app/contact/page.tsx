"use client";

import { locations, site } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { locationDirectionsUrl } from "@/lib/maps";
import { cartWhatsAppUrl } from "@/lib/whatsapp";
import { StoreMap } from "@/components/StoreMap";
import { useAuth, useCart, useDeliveryLocation, useLanguage } from "@/components/Providers";
import { LineIcon } from "@/components/ui/LineIcon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

export default function ContactPage() {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const { lines } = useCart();
  const { confirmed } = useDeliveryLocation();
  const href = cartWhatsAppUrl(locale, user?.name ?? "", lines, confirmed?.addressLabel);
  return (
    <div className="contact-page">
      <header className="contact-head">
        <SectionHeading as="h1" title={t(locale, "contact.title")} />
        <p className="lede">{t(locale, "contact.lead")}</p>
        <div className="row">
          <WhatsAppButton href={href} testId="whatsapp-contact">
            {t(locale, "products.whatsappOrder")}
          </WhatsAppButton>
        </div>
      </header>

      <section className="contact-grid" aria-label={t(locale, "contact.reach")}>
        <div className="contact-card">
          <LineIcon name="phone" />
          <p className="contact-label">{t(locale, "footer.phone")}</p>
          <p className="contact-value">
            {site.phones.map((phone, index) => (
              <span key={phone}>
                {index > 0 ? " / " : null}
                <a href={`tel:+91${phone}`}>{phone}</a>
              </span>
            ))}
          </p>
        </div>
        <div className="contact-card">
          <LineIcon name="chat" />
          <p className="contact-label">{t(locale, "footer.whatsapp")}</p>
          <p className="contact-value">
            <a href={href} target="_blank" rel="noreferrer">{site.phones[0]}</a>
          </p>
        </div>
        <div className="contact-card">
          <LineIcon name="mail" />
          <p className="contact-label">{t(locale, "footer.email")}</p>
          <p className="contact-value">
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>
        </div>
        <div className="contact-card">
          <LineIcon name="user" />
          <p className="contact-label">{t(locale, "contact.person")}</p>
          <p className="contact-value">{locale === "ta" ? site.contactPersonTamil : site.contactPerson}</p>
        </div>
        <div className="contact-card" data-testid="gst-card">
          <LineIcon name="tag" />
          <p className="contact-label">{t(locale, "contact.gst")}</p>
          <p className="contact-value">{site.gst.gstin}</p>
          <p>{site.gst.legalName}</p>
          <p>{site.gst.tradeName}</p>
          <p>{site.gst.principalAddress}</p>
        </div>
        <div className="contact-card" data-testid="fssai-card">
          <LineIcon name="tag" />
          <p className="contact-label">{t(locale, "contact.fssai")}</p>
          <p className="contact-value">
            <a href={site.fssai.lookupUrl} target="_blank" rel="noreferrer">{site.fssai.registrationNumber}</a>
          </p>
          <p>{locale === "ta" ? site.fssai.licenseeTamil : site.fssai.licenseeEnglish}</p>
          <p>{locale === "ta" ? site.fssai.kindTamil : site.fssai.kindEnglish}</p>
          <p>{t(locale, "footer.fssaiValid")} {site.fssai.validUntil}</p>
        </div>
      </section>

      <p className="banner">{locale === "ta" ? site.freeDeliveryTamil : site.freeDeliveryEnglish}</p>

      <section className="stack" aria-label={t(locale, "home.locationsTitle")}>
        {locations.filter((location) => location.latitude != null).map((location) => (
          <StoreMap key={`map-${location.id}`} location={location} />
        ))}
        <div className="location-grid">
        {locations.map((location) => {
          const addressLines = locale === "ta" ? location.addressTamil : location.addressEnglish;
          return (
            <article key={location.id} className="location-card">
              <LineIcon name="pin" />
              <h2>{locale === "ta" ? location.nameTamil : location.nameEnglish}</h2>
              <address>
                {addressLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </address>
              <p className="muted">{t(locale, location.role === "head_office_direct_sales" ? "delivery.paramakudiOffice" : "delivery.chennaiBranch")}</p>
              <a className="arrow-link" href={locationDirectionsUrl(location)} target="_blank" rel="noreferrer">
                {t(locale, "contact.directions")}
              </a>
            </article>
          );
        })}
        </div>
      </section>
    </div>
  );
}
