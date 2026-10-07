"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { brands, categories, getBrand, legalPages, locations, site } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { cartWhatsAppUrl } from "@/lib/whatsapp";
import { useAuth, useCart, useDeliveryLocation, useLanguage } from "@/components/Providers";
import { CartPanel } from "@/components/CartPanel";
import { Button } from "@/components/ui/Button";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { CartButton } from "@/components/ui/CartButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { locale } = useLanguage();
  const { drawerOpen, setDrawerOpen, lines } = useCart();
  const pathname = usePathname();
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, setDrawerOpen]);
  const { user } = useAuth();
  const { confirmed } = useDeliveryLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  useEffect(() => {
    if (!drawerOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () =>
      [...drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
    focusable()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [drawerOpen, setDrawerOpen]);
  const tagline = locale === "ta" ? site.taglineTamil : site.taglineEnglish;
  const mainBrand = getBrand("ananthi");
  const whatsappHref = cartWhatsAppUrl(locale, user?.name ?? "", lines, confirmed?.addressLabel);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const navItems = [
    { href: "/", label: t(locale, "nav.home") },
    { href: "/products", label: t(locale, "nav.products") },
    { href: "/brands", label: t(locale, "nav.brands") },
    { href: "/faq", label: t(locale, "nav.faq") },
    { href: "/contact", label: t(locale, "nav.contact") },
  ];
  const address = (locale === "ta" ? locations[0].addressTamil : locations[0].addressEnglish).join(", ");

  return (
    <>
      <a className="skip" href="#content">
        {t(locale, "header.skipToContent")}
      </a>
      <div className="topbar">
        <div className="topbar-inner">
          <p className="topbar-note">{locale === "ta" ? site.freeDeliveryTamil : site.freeDeliveryEnglish}</p>
          <p className="topbar-contact">
            <a href={`tel:+91${site.phones[0]}`}>
              {t(locale, "footer.phone")}: {site.phones[0]}
            </a>
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              {t(locale, "footer.whatsapp")}
            </a>
          </p>
        </div>
      </div>
      <header className="site-header">
        <div className="bar">
          <Link href="/" className="brand-lockup">
            {mainBrand ? (
              <CatalogImage src={mainBrand.logo} alt={locale === "ta" ? mainBrand.nameTamil : mainBrand.nameEnglish} width={144} height={96} sizes="(max-width: 767px) 52px, 72px" priority />
            ) : null}
            <span>
              <strong>{site.brandName}</strong>
              <p>{tagline}</p>
            </span>
          </Link>
          <nav id="site-nav" aria-label={t(locale, "header.menu")} className={menuOpen ? "links open" : "links"}>
            <div className="nav-inner">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              ))}
              <Link className="nav-account" href="/account" onClick={() => setMenuOpen(false)}>{t(locale, "header.account")}</Link>
            </div>
          </nav>
          <div className="header-tools">
            <LanguageSwitcher />
            <Link className="btn btn-ghost account-link icon-button" href="/account" aria-label={t(locale, "header.account")} title={t(locale, "header.account")}>
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </Link>
            <CartButton />
            <button type="button" className="btn btn-ghost menu-toggle" aria-controls="site-nav" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              <svg className="icon menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" />
                )}
              </svg>
              <span className="menu-label">{menuOpen ? t(locale, "header.closeMenu") : t(locale, "header.openMenu")}</span>
            </button>
          </div>
        </div>
      </header>
      <main id="content">{children}</main>
      <footer className="site-footer">
        <div className="page-width">
          <div className="footer-top">
            <div className="footer-brand">
              {mainBrand ? (
                <CatalogImage src={mainBrand.logo} alt="" width={144} height={96} sizes="96px" />
              ) : null}
              <strong>{site.brandName}</strong>
              <p>{locale === "ta" ? site.aboutTamil.split(".")[0] + "." : site.aboutEnglish.split(".")[0] + "."}</p>
              <p>{locale === "ta" ? site.freeDeliveryTamil : site.freeDeliveryEnglish}</p>
            </div>
            <div className="footer-grid">
              <div className="stack">
                <h2>{t(locale, "footer.quickLinks")}</h2>
                <Link href="/">{t(locale, "nav.home")}</Link>
                <Link href="/products">{t(locale, "footer.products")}</Link>
                {categories
                  .filter((category) => ["traditional", "millets", "flour"].includes(category.id))
                  .map((category) => (
                    <Link key={category.id} href={`/products?category=${category.id}`}>
                      {locale === "ta" ? category.nameTamil : category.nameEnglish}
                    </Link>
                  ))}
                <Link href="/contact">{t(locale, "footer.contact")}</Link>
              </div>
              <div className="stack">
                <h2>{t(locale, "footer.brands")}</h2>
                <ul className="stack">
                  {brands.map((brand) => (
                    <li key={brand.id}>
                      <Link href={`/products?brand=${brand.id}`}>{locale === "ta" ? brand.nameTamil : brand.nameEnglish}</Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="stack">
                <h2>{t(locale, "footer.contact")}</h2>
                <p>
                  {t(locale, "footer.phone")}:{" "}
                  {site.phones.map((phone, index) => (
                    <span key={phone}>
                      {index > 0 ? " / " : null}
                      <a href={`tel:+91${phone}`}>{phone}</a>
                    </span>
                  ))}
                </p>
                <p>
                  {t(locale, "footer.whatsapp")}: <a href={whatsappHref} target="_blank" rel="noreferrer">{site.phones[0]}</a>
                </p>
                <p>
                  {t(locale, "footer.email")}: <a href={`mailto:${site.email}`}>{site.email}</a>
                </p>
                <p>
                  {t(locale, "footer.address")}: {address}
                </p>
              </div>
              <div className="stack">
                <h2>{t(locale, "footer.legal")}</h2>
                {legalPages.map((page) => (
                  <Link key={page.id} href={`/legal/${page.id}`}>
                    {locale === "ta" ? page.titleTamil : page.titleEnglish}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p className="footer-muted" data-testid="gstin">
              {t(locale, "footer.gstin")} {site.gst.gstin}
            </p>
            <p className="footer-muted" data-testid="fssai-registration">
              <a href={site.fssai.lookupUrl} target="_blank" rel="noreferrer">
                {t(locale, "footer.fssai")} {site.fssai.registrationNumber}
              </a>
              {" · "}
              {t(locale, "footer.fssaiValid")} {site.fssai.validUntil}
            </p>
            <p className="footer-muted">
              © {new Date().getFullYear()} {site.brandName} / {t(locale, "footer.rights")}
            </p>
            <p className="footer-muted">{tagline}</p>
          </div>
        </div>
      </footer>
      {drawerOpen ? (
        <>
          <button type="button" className="backdrop" aria-label={t(locale, "cart.close")} onClick={() => setDrawerOpen(false)} />
          <aside ref={drawerRef} className="drawer" role="dialog" aria-modal="true" aria-label={t(locale, "cart.drawerTitle")} data-testid="cart-drawer">
            <div className="row">
              <h2>{t(locale, "cart.drawerTitle")}</h2>
              <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
                {t(locale, "cart.close")}
              </Button>
            </div>
            <CartPanel showCheckoutLink showCartLink />
          </aside>
        </>
      ) : null}
      <WhatsAppButton href={whatsappHref} floating testId="whatsapp-float">
        {t(locale, "whatsapp.floatLabel")}
      </WhatsAppButton>
    </>
  );
}
