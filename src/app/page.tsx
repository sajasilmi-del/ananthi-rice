"use client";

import Link from "next/link";
import {
  brandName,
  brands,
  categories,
  faq,
  featuredProducts,
  locations,
  productsInCategory,
  site,
  visibleProducts,
} from "@/lib/catalog";
import { DELIVERY_RADIUS_KM } from "@/lib/delivery";
import { formatMessage, t } from "@/lib/i18n";
import { cartWhatsAppUrl } from "@/lib/whatsapp";
import { DeliveryPicker } from "@/components/DeliveryPicker";
import { ProductPurchase } from "@/components/ProductPurchase";
import { useAuth, useCart, useDeliveryLocation, useLanguage } from "@/components/Providers";
import { Badge } from "@/components/ui/Badge";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LineIcon } from "@/components/ui/LineIcon";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

export default function HomePage() {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const { lines } = useCart();
  const { confirmed } = useDeliveryLocation();
  const featured = featuredProducts();
  const heroAlt = brands.map((brand) => brandName(brand, locale)).join(", ");
  const about = locale === "ta" ? site.aboutTamil : site.aboutEnglish;
  const whatsappHref = cartWhatsAppUrl(locale, user?.name ?? "", lines, confirmed?.addressLabel);
  const productTotal = visibleProducts().length;

  const trust = [
    ["leaf", "home.trustYearsTitle", "home.trustYearsBody"],
    ["tag", "home.trustBrandsTitle", "home.trustBrandsBody"],
    ["truck", "home.trustDeliveryTitle", "home.trustDeliveryBody"],
    ["chat", "home.trustWhatsappTitle", "home.trustWhatsappBody"],
  ] as const;

  const stats = [
    [`${site.yearsOfTrade}+`, "home.statYears"],
    [String(productTotal), "home.statProducts"],
    [String(brands.length), "home.statBrands"],
    [String(locations.length), "home.statLocations"],
  ] as const;

  const steps = [
    ["1", "home.step1Title", "home.step1Body"],
    ["2", "home.step2Title", "home.step2Body"],
    ["3", "home.step3Title", "home.step3Body"],
    ["4", "home.step4Title", "home.step4Body"],
  ] as const;

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero" aria-labelledby="home-hero">
        <div className="hero-copy">
          <p className="hero-kicker">{t(locale, "home.heroEyebrow")}</p>
          <h1 id="home-hero">{locale === "ta" ? site.heroTamil : site.heroEnglish}</h1>
          <p className="hero-lead">{t(locale, "home.heroLead")}</p>
          <div className="row hero-actions">
            <ButtonLink href="/products" variant="primary" className="btn-lg">
              {t(locale, "home.shopCta")}
            </ButtonLink>
            <WhatsAppButton href={whatsappHref}>{t(locale, "whatsapp.floatLabel")}</WhatsAppButton>
          </div>
        </div>
        <div className="hero-visual">
          <CatalogImage
            src="/hero/collage.png"
            alt={heroAlt}
            width={1280}
            height={742}
            sizes="(max-width: 1023px) 92vw, 640px"
            priority
          />
        </div>
      </section>

      {/* Brands */}
      <section className="brand-showcase" aria-labelledby="home-brands">
        <div className="section-intro">
          <div>
            <div id="home-brands">
              <SectionHeading title={t(locale, "brands.title")} />
            </div>
            <p className="lede">{t(locale, "home.brandsLead")}</p>
          </div>
          <Link className="arrow-link" href="/brands">{t(locale, "nav.brands")}</Link>
        </div>
        <div className="brand-stage">
          {brands.map((brand) => (
            <article
              key={brand.id}
              className={brand.role === "main" ? "brand-card brand-card-main" : "brand-card"}
              data-testid={`brand-${brand.id}`}
              data-role={brand.role}
              data-brand={brand.id}
            >
              <div className="brand-logo">
                <CatalogImage src={brand.logo} alt={brandName(brand, locale)} width={240} height={140} sizes="200px" />
              </div>
              <div className="brand-card-body">
                <Badge tone={brand.role === "main" ? "main" : brand.id}>{brand.role === "main" ? t(locale, "brands.main") : t(locale, "brands.sub")}</Badge>
                <h3>{locale === "ta" ? brand.nameTamil : brand.nameEnglish}</h3>
                <p className="brand-tagline">{brand.taglineEnglish}</p>
                <p className="brand-blurb">{locale === "ta" ? brand.descriptionTamil : brand.descriptionEnglish}</p>
              </div>
              <Link className="arrow-link" href={`/products?brand=${brand.id}`}>
                {t(locale, "home.brandProducts")}
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="trust" aria-label={site.brandName}>
        {trust.map(([icon, title, body]) => (
          <div key={title} className="trust-item">
            <LineIcon name={icon} />
            <div>
              <p className="trust-title">{t(locale, title)}</p>
              <p className="trust-body">{t(locale, body)}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section aria-labelledby="home-categories">
        <div className="section-intro">
          <div>
            <div id="home-categories">
              <SectionHeading title={t(locale, "home.categoryTitle")} />
            </div>
            <p className="lede">{t(locale, "home.categoryLead")}</p>
          </div>
          <Link className="arrow-link" href="/products">{t(locale, "home.allProducts")}</Link>
        </div>
        <div className="category-grid">
          {categories.map((category) => {
            const name = locale === "ta" ? category.nameTamil : category.nameEnglish;
            return (
              <Link key={category.id} className="category-card" href={`/products?category=${category.id}`}>
                <span className="category-media" aria-hidden="true">
                  <CatalogImage src={category.image} alt="" width={240} height={240} sizes="(max-width: 767px) 40vw, 160px" />
                </span>
                <span className="category-name">{name}</span>
                <span className="category-count">
                  {productsInCategory(category.id).length} {t(locale, "footer.products")}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured */}
      <section aria-labelledby="home-featured">
        <div className="section-intro">
          <div>
            <div id="home-featured">
              <SectionHeading title={t(locale, "products.featured")} />
            </div>
            <p className="lede">{t(locale, "home.featuredLead")}</p>
          </div>
          <ButtonLink href="/products">{t(locale, "home.allProducts")}</ButtonLink>
        </div>
        <div className="grid">
          {featured.map((product) => (
            <ProductPurchase key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* About */}
      <section className="about" aria-labelledby="home-about">
        <div className="about-copy">
          <div id="home-about">
            <SectionHeading eyebrow={site.legalName} title={t(locale, "footer.tradition")} />
          </div>
          <p className="lede">{about}</p>
          <div className="row">
            <ButtonLink href="/products?category=traditional" variant="primary">{t(locale, "home.shopCta")}</ButtonLink>
            <ButtonLink href="/contact">{t(locale, "nav.contact")}</ButtonLink>
          </div>
        </div>
        <dl className="stats">
          {stats.map(([value, label]) => (
            <div key={label} className="stat">
              <dt>{t(locale, label)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* How to order */}
      <section aria-labelledby="home-order">
        <div className="section-intro">
          <div>
            <div id="home-order">
              <SectionHeading title={t(locale, "home.orderTitle")} />
            </div>
            <p className="lede">{t(locale, "home.orderLead")}</p>
          </div>
        </div>
        <ol className="step-grid">
          {steps.map(([index, title, body]) => (
            <li key={title} className="step-card">
              <span className="step-index">{index}</span>
              <h3>{t(locale, title)}</h3>
              <p>{t(locale, body)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Delivery + locations */}
      <section className="visit" aria-labelledby="home-delivery">
        <div className="visit-intro">
          <div id="home-delivery">
            <SectionHeading title={t(locale, "home.deliveryTitle")} />
          </div>
          <p className="lede">{locale === "ta" ? site.freeDeliveryTamil : site.freeDeliveryEnglish}</p>
          <p className="muted">{formatMessage(t(locale, "home.deliveryRadius"), { km: DELIVERY_RADIUS_KM })}</p>
          <Link className="arrow-link" href="/legal/delivery">{t(locale, "home.deliveryPolicy")}</Link>
          <h3 className="visit-subhead">{t(locale, "home.locationsTitle")}</h3>
          <div className="place-grid">
            {locations.map((location) => {
              const linesForPlace = locale === "ta" ? location.addressTamil : location.addressEnglish;
              const query = location.addressEnglish.join(", ");
              return (
                <article key={location.id} className="place-card">
                  <LineIcon name="pin" />
                  <div className="place-copy">
                    <h4>{locale === "ta" ? location.nameTamil : location.nameEnglish}</h4>
                    <address>{linesForPlace.join(", ")}</address>
                    <a className="arrow-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer">
                      {t(locale, "contact.directions")}
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <div className="visit-picker">
          <DeliveryPicker heading="h3" />
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-split" aria-labelledby="home-faq">
        <div className="faq-intro">
          <div id="home-faq">
            <SectionHeading title={t(locale, "faq.title")} />
          </div>
          <p className="lede">{t(locale, "home.faqLead")}</p>
          <ButtonLink href="/faq">{t(locale, "home.faqAll")}</ButtonLink>
        </div>
        <div className="faq-list">
          {faq.map((item) => (
            <details key={item.id}>
              <summary>{locale === "ta" ? item.questionTamil : item.questionEnglish}</summary>
              <p>{locale === "ta" ? item.answerTamil : item.answerEnglish}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-band" aria-labelledby="home-cta">
        <div className="cta-copy">
          <h2 id="home-cta">{t(locale, "home.whatsappTitle")}</h2>
          <p>{t(locale, "home.whatsappBody")}</p>
        </div>
        <div className="row cta-actions">
          <WhatsAppButton href={whatsappHref}>{t(locale, "products.whatsappOrder")}</WhatsAppButton>
          <a className="btn btn-outline-light" href={`tel:+91${site.phones[0]}`}>
            {t(locale, "home.callUs")}: {site.phones[0]}
          </a>
        </div>
      </section>
    </div>
  );
}
