import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDevAuthAdapter } from "@/lib/auth/dev-adapter";
import { addLine, clearCart, itemCount, removeLine, setQuantity, subtotal } from "@/lib/cart";
import { brands, categories, deliveryConfig, products, site } from "@/lib/catalog";
import { checkoutAllowed, evaluateDelivery, DELIVERY_UNAVAILABLE_EN, DELIVERY_UNAVAILABLE_TA } from "@/lib/delivery";
import { dictionaries, leafKeys, t } from "@/lib/i18n";
import { detectBrowserLocale, LANGUAGE_STORAGE_KEY, readStoredLocale } from "@/lib/language";
import { createUnconfiguredPaymentProvider } from "@/lib/payment/unconfigured";
import { buildWhatsAppUrl, cartWhatsAppUrl } from "@/lib/whatsapp";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return [full];
  });
}

describe("phase 1 data", () => {
  it("keeps delivery origin empty and the radius at 5 km", () => {
    expect(deliveryConfig.enabled).toBe(true);
    expect(deliveryConfig.radiusKm).toBe(5);
    expect(deliveryConfig.origin.latitude).toBeNull();
    expect(deliveryConfig.origin.longitude).toBeNull();
    expect(deliveryConfig.feeWhenAvailableInr).toBe(0);
  });

  it("loads 49 products priced from the 6 October 2026 list", () => {
    expect(products).toHaveLength(49);
    for (const product of products) {
      expect(product.active).toBe(true);
      expect(product.nameTamil.length).toBeGreaterThan(0);
      expect(product.nameEnglish.length).toBeGreaterThan(0);
      expect(product.descriptionTamil.length).toBeGreaterThan(0);
      expect(product.descriptionEnglish.length).toBeGreaterThan(0);
      expect(product.images.length).toBeGreaterThan(0);
      for (const image of product.images) {
        expect(existsSync(path.join(process.cwd(), "public", image.replace(/^\//, "")))).toBe(true);
      }
      expect(product.variants.map((variant) => variant.packSize)).toEqual(["1 kg", "5 kg", "10 kg", "26 kg"]);
      for (const variant of product.variants) {
        expect(variant.price).toEqual(expect.any(Number));
        expect(variant.price).toBeGreaterThan(0);
        expect(variant.salePrice).toBeNull();
        expect(variant.stock).toBeNull();
      }
    }
    const ponni = products.find((product) => product.id === "ponni-boiled-rice");
    expect(ponni?.brand).toBe("ananthi");
    expect(ponni?.variants.map((variant) => variant.price)).toEqual([160, 799, 1419, 2939]);
    expect(products.find((product) => product.id === "idli-rice")?.brand).toBe("santosh");
    expect(products.find((product) => product.id === "ragi-flour")?.variants[0].price).toBe(130);
    expect(subtotal([{ productId: products[0].id, variantId: products[0].variants[0].id, quantity: 2 }])).toBe(320);
  });

  it("preserves the brand hierarchy and real logo files", () => {
    expect(brands.filter((brand) => brand.role === "main").map((brand) => brand.id)).toEqual(["ananthi"]);
    expect(brands.filter((brand) => brand.role === "sub").map((brand) => brand.id)).toEqual(["arthy", "santosh", "mahi"]);
    for (const brand of brands) {
      expect(existsSync(path.join(process.cwd(), "public", brand.logo.replace(/^\//, "")))).toBe(true);
    }
    expect(categories.map((category) => category.id)).toEqual([
      "everyday",
      "biryani",
      "hand-pounded",
      "traditional",
      "sevai",
      "millets",
      "flour",
    ]);
    for (const category of categories) {
      expect(category.image.startsWith("/categories/")).toBe(true);
      expect(existsSync(path.join(process.cwd(), "public", category.image.replace(/^\//, "")))).toBe(true);
    }
  });

  it("keeps phone numbers and the WhatsApp id in site data", () => {
    expect(site.phones).toEqual(["9942034428", "7540034428"]);
    expect(site.whatsappE164).toBe("919942034428");
    expect(site.email).toBe("ananthirice.shop@gmail.com");
  });

  it("does not hard-code catalog facts into components", () => {
    const files = [...walk(path.join(process.cwd(), "src", "components")), ...walk(path.join(process.cwd(), "src", "app"))];
    const source = files.filter((file) => file.endsWith(".ts") || file.endsWith(".tsx")).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toContain("919942034428");
    expect(source).not.toContain("9942034428");
    expect(source).not.toContain("Ponni Boiled");
    expect(source).not.toContain("Delivery not available for this location.");
    expect(source).not.toContain("இந்த இடத்திற்கு டெலிவரி வசதி இல்லை.");
  });
});

describe("language dictionary", () => {
  it("matches Tamil and English keys", () => {
    const english = leafKeys(dictionaries.en).sort();
    const tamil = leafKeys(dictionaries.ta).sort();
    expect(tamil).toEqual(english);
    for (const key of english) {
      expect(t("en", key).trim().length).toBeGreaterThan(0);
      expect(t("ta", key).trim().length).toBeGreaterThan(0);
    }
  });

  it("uses the browser language until the visitor chooses", () => {
    expect(detectBrowserLocale("ta-IN")).toBe("ta");
    expect(detectBrowserLocale("en-GB")).toBe("en");
    expect(detectBrowserLocale(undefined)).toBe("en");
    const storage = new MemoryStorage();
    expect(readStoredLocale(storage)).toBeNull();
    storage.setItem(LANGUAGE_STORAGE_KEY, "ta");
    expect(readStoredLocale(storage)).toBe("ta");
  });

  it("uses the exact outside-radius sentences", () => {
    expect(DELIVERY_UNAVAILABLE_EN).toBe("Delivery not available for this location.");
    expect(DELIVERY_UNAVAILABLE_TA).toBe("இந்த இடத்திற்கு டெலிவரி வசதி இல்லை.");
    expect(t("en", "delivery.unavailable")).toBe(DELIVERY_UNAVAILABLE_EN);
    expect(t("ta", "delivery.unavailable")).toBe(DELIVERY_UNAVAILABLE_TA);
  });
});

describe("delivery, cart, payment, whatsapp, auth", () => {
  it("calculates haversine distance and blocks checkout outside 5 km", () => {
    const configured = {
      ...deliveryConfig,
      origin: { latitude: 0, longitude: 0 },
    };
    const inside = evaluateDelivery(configured, { latitude: 0.03, longitude: 0 });
    const outside = evaluateDelivery(configured, { latitude: 0.1, longitude: 0 });
    expect(inside.status).toBe("available");
    expect(outside.status).toBe("unavailable");
    if (outside.status === "unavailable") {
      expect(outside.messageEn).toBe("Delivery not available for this location.");
      expect(outside.messageTa).toBe("இந்த இடத்திற்கு டெலிவரி வசதி இல்லை.");
      expect(outside.distanceKm).toBeGreaterThan(5);
    }
    expect(checkoutAllowed(inside)).toBe(true);
    expect(checkoutAllowed(outside)).toBe(false);
    expect(evaluateDelivery(deliveryConfig, { latitude: 9.5, longitude: 78.6 }).status).toBe("origin_not_configured");
    expect(checkoutAllowed(evaluateDelivery(deliveryConfig, null))).toBe(false);
  });

  it("updates a persistent cart without inventing a total", () => {
    let lines = addLine([], { productId: "ponni-boiled-rice", variantId: "5kg", quantity: 1 });
    lines = addLine(lines, { productId: "ponni-boiled-rice", variantId: "5kg", quantity: 1 });
    expect(itemCount(lines)).toBe(2);
    lines = setQuantity(lines, "ponni-boiled-rice", "5kg", 4);
    expect(lines[0].quantity).toBe(4);
    lines = removeLine(lines, "ponni-boiled-rice", "5kg");
    expect(lines).toEqual([]);
    lines = addLine(lines, { productId: "ragi-flour", variantId: "1kg", quantity: 1 });
    expect(clearCart()).toEqual([]);
    expect(subtotal(lines)).toBe(130);
  });

  it("opens WhatsApp with a language-specific prefilled message", () => {
    const order = {
      customerName: "Anand",
      lines: [{ name: "Ponni Boiled Rice", packSize: "5 kg", quantity: 2 }],
      cartTotal: "Price available at checkout",
      deliveryLocation: "Paramakudi",
      orderId: "11111111-2222-3333-4444-555555555555",
    };
    const english = buildWhatsAppUrl("en", order);
    const tamil = buildWhatsAppUrl("ta", { ...order, cartTotal: "விலை செக்அவுட்டில் தெரிவிக்கப்படும்" });
    expect(english.startsWith("https://wa.me/919942034428?text=")).toBe(true);
    const englishText = decodeURIComponent(english.split("text=")[1]);
    const tamilText = decodeURIComponent(tamil.split("text=")[1]);
    expect(englishText).toBe(
      [
        "Hello ANANTHI RICE,",
        "",
        "I would like to place an order.",
        "",
        "Product: Ponni Boiled Rice",
        "Pack size: 5 kg",
        "Quantity: 2",
        "",
        "Customer: Anand",
        "Delivery address: Paramakudi",
        "",
        "Please confirm availability and order details.",
      ].join("\n"),
    );
    expect(tamilText).toContain("பொருள்: Ponni Boiled Rice");
    expect(tamilText).toContain("வணக்கம் ANANTHI RICE");
    expect(tamilText).toContain("நான் ஒரு ஆர்டர் செய்ய விரும்புகிறேன்.");
    expect(tamilText).toContain("வாடிக்கையாளர்: Anand");
    expect(tamilText).toContain("டெலிவரி முகவரி: Paramakudi");
    expect(tamilText).toContain("கிடைப்பதையும் ஆர்டர் விவரங்களையும் உறுதிப்படுத்துங்கள்.");
    expect(englishText).not.toContain(order.orderId);
    expect(tamilText).not.toContain(order.orderId);
    expect(englishText).not.toContain("Cart total");
    expect(englishText).not.toContain("Price available at checkout");
    expect(tamilText).not.toContain("விலை செக்அவுட்டில் தெரிவிக்கப்படும்");
  });

  it("lists every cart item and keeps coordinates and status text out of WhatsApp", () => {
    const url = cartWhatsAppUrl(
      "en",
      "Anand",
      [
        { productId: "ponni-boiled-rice", variantId: "1kg", quantity: 1 },
        { productId: "idli-rice", variantId: "5kg", quantity: 2 },
      ],
      "13.03820, 80.17800",
    );
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text.split("\n").filter((line) => line.startsWith("Product:"))).toEqual([
      "Product: Ponni Boiled Rice",
      "Product: Idli Rice",
    ]);
    expect(text).toContain("Pack size: 1 kg");
    expect(text).toContain("Pack size: 5 kg");
    expect(text).toContain("Quantity: 2");
    expect(text).toContain("Delivery address: Not provided");
    expect(text).not.toContain("13.03820");
    expect(text).not.toContain("80.17800");

    const leaked = decodeURIComponent(
      buildWhatsAppUrl("en", {
        customerName: "Anand",
        lines: [{ name: "Ponni Boiled Rice", packSize: "5 kg", quantity: 1 }],
        deliveryLocation: "Delivery origin coordinates are not configured yet.",
        orderId: "11111111-2222-3333-4444-555555555555",
        cartTotal: "0",
      }).split("text=")[1],
    );
    expect(leaked).toContain("Delivery address: Not provided");
    expect(leaked).not.toContain("not configured");
    expect(leaked).not.toContain("11111111-2222-3333-4444-555555555555");
    expect(leaked).not.toContain("Cart total");
  });

  it("never confirms payment", async () => {
    const provider = createUnconfiguredPaymentProvider();
    expect(provider.configured).toBe(false);
    expect([...provider.listMethods()]).toEqual(["upi", "card", "netbanking", "cod"]);
    for (const method of provider.listMethods()) {
      const intent = await provider.createIntent(method);
      expect(intent.status).toBe("not_confirmed");
      expect(intent.reason).toBe("provider_not_configured");
    }
  });

  it("keeps authentication behind the development adapter", async () => {
    const storage = new MemoryStorage();
    const auth = createDevAuthAdapter(storage);
    expect(auth.mode).toBe("development");
    expect(auth.label).toBe("DEVELOPMENT STORE");
    const created = await auth.signUp({
      name: "Anand",
      mobile: "9942034428",
      email: "anand@example.com",
      password: "secret-pass",
      address: "Paramakudi",
    });
    expect(created.ok).toBe(true);
    expect(storage.getItem("ananthi.dev.users")).not.toContain("secret-pass");
    await auth.logout();
    expect(await auth.getSession()).toBeNull();
    const loggedIn = await auth.login({ email: "anand@example.com", password: "secret-pass" });
    expect(loggedIn.ok).toBe(true);
    const reset = await auth.requestPasswordReset({ email: "anand@example.com" });
    expect(reset.emailSent).toBe(false);
    expect(reset.mode).toBe("development");
    const updated = await auth.devSetPassword({ email: "anand@example.com", password: "another-pass" });
    expect(updated.ok).toBe(true);
  });
});
