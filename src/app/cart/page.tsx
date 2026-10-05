"use client";

import { t } from "@/lib/i18n";
import { cartWhatsAppUrl } from "@/lib/whatsapp";
import { CartPanel } from "@/components/CartPanel";
import { DeliveryPicker } from "@/components/DeliveryPicker";
import { useAuth, useCart, useDeliveryLocation, useLanguage } from "@/components/Providers";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

export default function CartPage() {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const { lines } = useCart();
  const { confirmed } = useDeliveryLocation();
  const href = cartWhatsAppUrl(locale, user?.name ?? "", lines, confirmed?.addressLabel);
  return (
    <div className="stack cart-page" data-testid="cart-page">
      <SectionHeading as="h1" title={t(locale, "cart.title")} />
      <CartPanel showCheckoutLink />
      <div className="row">
        <WhatsAppButton href={href} testId="whatsapp-cart">
          {t(locale, "products.whatsappOrder")}
        </WhatsAppButton>
      </div>
      <DeliveryPicker />
    </div>
  );
}
