"use client";

import { t } from "@/lib/i18n";
import { useCart, useLanguage } from "@/components/Providers";

export function CartButton() {
  const { locale } = useLanguage();
  const { count, setDrawerOpen } = useCart();
  return (
    <button
      type="button"
      className="btn btn-ghost cart-button"
      data-testid="cart-button"
      aria-label={`${t(locale, "cart.open")} (${count})`}
      onClick={() => setDrawerOpen(true)}
    >
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6.5 8h11l-1 12h-9l-1-12z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 8V7a3 3 0 0 1 6 0v1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span data-testid="cart-count" aria-live="polite">
        {count}
      </span>
    </button>
  );
}
