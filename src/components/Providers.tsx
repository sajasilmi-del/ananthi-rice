"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createAuthAdapter } from "@/lib/auth";
import type { AuthAdapter, AuthUser } from "@/lib/auth/types";
import { addLine, clearCart, itemCount, readCart, removeLine, setQuantity, writeCart } from "@/lib/cart";
import { DELIVERY_LOCATION_KEY, readConfirmedLocation, writeConfirmedLocation } from "@/lib/delivery";
import { detectBrowserLocale, parseLocale, persistLocale, readStoredLocale } from "@/lib/language";
import type { CartLine, ConfirmedLocation, Locale } from "@/lib/types";
import { AppShell } from "@/components/AppShell";

type LanguageValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

type CartValue = {
  lines: CartLine[];
  count: number;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  add: (line: CartLine) => void;
  remove: (productId: string, variantId: string) => void;
  updateQuantity: (productId: string, variantId: string, quantity: number) => void;
  clear: () => void;
};

type DeliveryValue = {
  confirmed: ConfirmedLocation | null;
  confirm: (location: ConfirmedLocation) => void;
  clearLocation: () => void;
};

type AuthValue = {
  adapter: AuthAdapter | null;
  user: AuthUser | null;
  refresh: () => Promise<void>;
};

const LanguageContext = createContext<LanguageValue | null>(null);
const CartContext = createContext<CartValue | null>(null);
const DeliveryContext = createContext<DeliveryValue | null>(null);
const AuthContext = createContext<AuthValue | null>(null);

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("Language provider is missing");
  return value;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("Cart provider is missing");
  return value;
}

export function useDeliveryLocation(): DeliveryValue {
  const value = useContext(DeliveryContext);
  if (!value) throw new Error("Delivery provider is missing");
  return value;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth provider is missing");
  return value;
}

export function Providers({ children, initialLocale = "en" }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedLocation | null>(null);
  const [adapter, setAdapter] = useState<AuthAdapter | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const fromQuery = parseLocale(new URLSearchParams(window.location.search).get("lang"));
    const stored = readStoredLocale(window.localStorage);
    const next = fromQuery ?? stored ?? detectBrowserLocale(window.navigator.language);
    setLocaleState(next);
    if (fromQuery) document.documentElement.lang = next;
    else persistLocale(next);
    setLines(readCart(window.localStorage));
    setCartReady(true);
    setConfirmed(readConfirmedLocation(window.localStorage));
    const auth = createAuthAdapter(window.localStorage);
    setAdapter(auth);
    void auth.getSession().then(setUser);
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    writeCart(window.localStorage, lines);
  }, [cartReady, lines]);

  const language = useMemo<LanguageValue>(
    () => ({
      locale,
      setLocale(next) {
        persistLocale(next);
        setLocaleState(next);
      },
    }),
    [locale],
  );

  const cart = useMemo<CartValue>(
    () => ({
      lines,
      count: itemCount(lines),
      drawerOpen,
      setDrawerOpen,
      add(line) {
        setLines((current) => addLine(current, line));
        setDrawerOpen(true);
      },
      remove(productId, variantId) {
        setLines((current) => removeLine(current, productId, variantId));
      },
      updateQuantity(productId, variantId, quantity) {
        setLines((current) => setQuantity(current, productId, variantId, quantity));
      },
      clear() {
        setLines(clearCart());
      },
    }),
    [drawerOpen, lines],
  );

  const delivery = useMemo<DeliveryValue>(
    () => ({
      confirmed,
      confirm(location) {
        writeConfirmedLocation(window.localStorage, location);
        setConfirmed(location);
      },
      clearLocation() {
        window.localStorage.removeItem(DELIVERY_LOCATION_KEY);
        setConfirmed(null);
      },
    }),
    [confirmed],
  );

  const auth = useMemo<AuthValue>(
    () => ({
      adapter,
      user,
      async refresh() {
        if (!adapter) return;
        setUser(await adapter.getSession());
      },
    }),
    [adapter, user],
  );

  return (
    <LanguageContext.Provider value={language}>
      <AuthContext.Provider value={auth}>
        <DeliveryContext.Provider value={delivery}>
          <CartContext.Provider value={cart}>
            <AppShell>{children}</AppShell>
          </CartContext.Provider>
        </DeliveryContext.Provider>
      </AuthContext.Provider>
    </LanguageContext.Provider>
  );
}
