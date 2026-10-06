import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3456";
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function checkDetail(page, spec) {
  await page.goto(`${base}${spec.path}`, { waitUntil: "networkidle" });
  await page.getByTestId("product-breadcrumb").waitFor();
  await page.getByTestId("product-gallery").waitFor();
  const title = await page.title();
  check(title.includes(spec.english), `${spec.path} title was ${title}`);
  check(title.includes("ANANTHI RICE"), `${spec.path} title missed the brand: ${title}`);
  check((await page.getByTestId("product-name-en").innerText()) === spec.english, `${spec.path} English name`);
  check((await page.getByTestId("product-name-ta").innerText()) === spec.tamil, `${spec.path} Tamil name`);
  check((await page.getByTestId("product-brand").innerText()).includes(spec.brand), `${spec.path} brand`);
  const crumb = await page.getByTestId("product-breadcrumb").innerText();
  check(crumb.includes("Home") && crumb.includes("Products"), `${spec.path} breadcrumb was ${crumb}`);
  check(crumb.includes(spec.category), `${spec.path} breadcrumb category was ${crumb}`);
  check(crumb.includes(spec.english), `${spec.path} breadcrumb product was ${crumb}`);
  check((await page.getByTestId("product-description").innerText()).length > 0, `${spec.path} description`);
  const select = page.getByTestId("product-pack");
  check((await select.locator("option").count()) === spec.packCount, `${spec.path} pack count`);
  check((await page.getByTestId("product-price").innerText()).includes(spec.price), `${spec.path} price`);
  if (spec.packValue) {
    await select.selectOption(spec.packValue);
    check((await select.inputValue()) === spec.packValue, `${spec.path} pack size did not change`);
  }
  if (spec.packPrice) {
    check((await page.getByTestId("product-price").innerText()).includes(spec.packPrice), `${spec.path} pack price`);
  }
  check((await page.getByTestId("product-availability").innerText()).includes("Availability not listed"), `${spec.path} availability`);
  await page.getByRole("button", { name: "Add to Cart" }).waitFor();
  await page.getByRole("button", { name: "Buy Now" }).waitFor();
  await page.getByTestId("whatsapp-product").waitFor();
  check((await page.getByTestId("delivery-note").innerText()).includes("pincode"), `${spec.path} delivery note`);
  check((await page.getByTestId("related-products").locator("a").count()) > 0, `${spec.path} related products`);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  locale: "en-US",
  geolocation: { latitude: 13.0382, longitude: 80.178 },
  permissions: ["geolocation"],
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(base, { waitUntil: "networkidle" });
  check((await page.getByTestId("brand-ananthi").getAttribute("data-role")) === "main", "ANANTHI is not marked as the main brand");
  check((await page.getByTestId("brand-arthy").getAttribute("data-role")) === "sub", "ARTHY is not marked as a sub-brand");
  check((await page.getByTestId("brand-santosh").getAttribute("data-role")) === "sub", "SANTOSH is not marked as a sub-brand");
  check((await page.getByTestId("brand-mahi").getAttribute("data-role")) === "sub", "MAHI is not marked as a sub-brand");
  await page.getByRole("button", { name: "Add to Cart" }).first().waitFor();

  await page.getByTestId("lang-ta").click();
  await page.getByRole("button", { name: "கார்ட்டில் சேர்" }).first().waitFor();
  const tamilGlyphs = await page.evaluate(async () => {
    await document.fonts.ready;
    const root = getComputedStyle(document.documentElement);
    const sans = root.getPropertyValue("--font-sans-tamil").trim();
    const display = root.getPropertyValue("--font-display-tamil").trim();
    const sansOk = document.fonts.check(`400 32px ${sans}`, "தமிழ்");
    const displayOk = document.fonts.check(`700 32px ${display}`, "தமிழ்");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = `48px ${sans}`;
    const width = ctx.measureText("தமிழ்").width;
    const hero = getComputedStyle(document.querySelector("h1")).fontFamily;
    return { sans, display, sansOk, displayOk, width, hero };
  });
  check(tamilGlyphs.sansOk, `Tamil UI font did not cover தமிழ்: ${JSON.stringify(tamilGlyphs)}`);
  check(tamilGlyphs.displayOk, `Tamil display font did not cover தமிழ்: ${JSON.stringify(tamilGlyphs)}`);
  check(tamilGlyphs.width > 24, `Tamil glyphs measured ${tamilGlyphs.width}px`);
  check(tamilGlyphs.hero.includes("Tamil") || tamilGlyphs.hero.includes(tamilGlyphs.display.split(",")[0].replaceAll('"', "").trim()), `Hero font stack missed the Tamil display face: ${tamilGlyphs.hero}`);
  check((await page.evaluate(() => localStorage.getItem("ananthi.language"))) === "ta", "Tamil choice was not stored");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "கார்ட்டில் சேர்" }).first().waitFor();
  check((await page.locator("html").getAttribute("lang")) === "ta", "Tamil did not persist on refresh");
  await page.goto(`${base}/cart`, { waitUntil: "networkidle" });
  check((await page.locator("html").getAttribute("lang")) === "ta", "Cart page lost the Tamil language");
  check((await page.locator("body").innerText()).includes("உங்கள் கார்ட் காலியாக உள்ளது."), "Cart empty state was not Tamil");
  await page.goto(`${base}/account`, { waitUntil: "networkidle" });
  check((await page.locator("body").innerText()).includes("பதிவு செய்"), "Account page was not Tamil");
  await page.goto(`${base}/checkout`, { waitUntil: "networkidle" });
  check((await page.locator("body").innerText()).includes("வீட்டு டெலிவரி அஞ்சல் குறியீடு"), "Checkout was not Tamil");
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "கார்ட்டில் சேர்" }).first().waitFor();
  check((await page.locator("html").getAttribute("lang")) === "ta", "Tamil did not persist across navigation");

  await page.getByTestId("lang-en").click();
  await page.getByTestId("add-ponni-boiled-rice").click();
  await page.getByTestId("cart-drawer").waitFor();
  check((await page.getByTestId("cart-count").innerText()) === "1", "Cart count was not 1 after add");
  await page.getByTestId("increase-ponni-boiled-rice").click();
  await page.getByTestId("qty-ponni-boiled-rice").waitFor();
  check((await page.getByTestId("qty-ponni-boiled-rice").innerText()) === "2", "Quantity did not increase");
  check((await page.getByTestId("cart-count").innerText()) === "2", "Cart count did not follow the quantity");
  await page.reload({ waitUntil: "networkidle" });
  check((await page.getByTestId("cart-count").innerText()) === "2", "Cart did not persist after reload");

  await page.goto(`${base}/cart`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Decrease quantity" }).click();
  check((await page.getByTestId("qty-ponni-boiled-rice").innerText()) === "1", "Quantity did not decrease");
  await page.getByTestId("clear-cart").click();
  await page.getByTestId("cart-empty").waitFor();
  check((await page.getByTestId("cart-count").innerText()) === "0", "Clear cart left a count");

  await page.goto(`${base}/products/ponni-boiled-rice`, { waitUntil: "networkidle" });
  const quantityInput = page.getByTestId("product-quantity");
  await quantityInput.fill("0");
  await page.waitForFunction(() => document.querySelector("[data-testid='product-quantity']").value === "1");
  await quantityInput.fill("2.5");
  await page.waitForFunction(() => document.querySelector("[data-testid='product-quantity']").value === "1");
  await quantityInput.fill("2");
  await page.waitForFunction(() => document.querySelector("[data-testid='product-quantity']").value === "2");
  await page.getByTestId("add-ponni-boiled-rice").click();
  await page.getByTestId("cart-drawer").waitFor();
  check((await page.getByTestId("cart-count").innerText()) === "2", "Adding one line did not set the badge to the chosen quantity");
  check((await page.getByTestId("cart-line-ponni-boiled-rice-1kg").getByTestId("qty-ponni-boiled-rice").innerText()) === "2", "1 kg line quantity was wrong");

  await page.getByTestId("cart-drawer").getByRole("button", { name: "Close cart" }).click();
  await page.getByTestId("cart-drawer").waitFor({ state: "hidden" });
  await page.getByTestId("add-ponni-boiled-rice").click();
  await page.getByTestId("cart-drawer").waitFor();
  check((await page.getByTestId("cart-count").innerText()) === "4", "Adding the same pack again did not merge");
  check((await page.locator("[data-testid='cart-line-ponni-boiled-rice-1kg']").count()) === 1, "Same pack created a second line");

  await page.getByTestId("cart-drawer").getByRole("button", { name: "Close cart" }).click();
  await page.getByTestId("cart-drawer").waitFor({ state: "hidden" });
  await page.getByTestId("product-pack").selectOption("5kg");
  await quantityInput.fill("1");
  await page.waitForFunction(() => document.querySelector("[data-testid='product-quantity']").value === "1");
  await page.getByTestId("add-ponni-boiled-rice").click();
  await page.getByTestId("cart-drawer").waitFor();
  await page.getByTestId("cart-line-ponni-boiled-rice-5kg").waitFor();
  check((await page.getByTestId("cart-count").innerText()) === "5", "A different pack size did not update the badge");

  await page.getByTestId("cart-drawer").getByRole("button", { name: "Close cart" }).click();
  await page.getByTestId("cart-drawer").waitFor({ state: "hidden" });
  await page.goto(`${base}/products/basmati-rice`, { waitUntil: "networkidle" });
  await page.getByTestId("add-basmati-rice").click();
  await page.getByTestId("cart-drawer").waitFor();
  await page.getByTestId("cart-line-basmati-rice-1kg").waitFor();
  check((await page.getByTestId("cart-count").innerText()) === "6", "A second product did not update the badge");

  await page.getByTestId("cart-line-ponni-boiled-rice-5kg").getByTestId("increase-ponni-boiled-rice").click();
  check((await page.getByTestId("cart-line-ponni-boiled-rice-5kg").getByTestId("qty-ponni-boiled-rice").innerText()) === "2", "Pack quantity did not increase");
  check((await page.getByTestId("cart-count").innerText()) === "7", "Badge did not follow the pack increase");
  await page.getByTestId("cart-line-ponni-boiled-rice-5kg").getByRole("button", { name: "Decrease quantity" }).click();
  check((await page.getByTestId("cart-line-ponni-boiled-rice-5kg").getByTestId("qty-ponni-boiled-rice").innerText()) === "1", "Pack quantity did not decrease");
  await page.getByTestId("remove-ponni-boiled-rice-5kg").click();
  await page.getByTestId("cart-line-ponni-boiled-rice-5kg").waitFor({ state: "detached" });
  check((await page.getByTestId("cart-count").innerText()) === "5", "Remove did not update the badge");

  const totals = await page.getByTestId("cart-totals").innerText();
  check(totals.includes("₹990.00"), `Cart subtotal was ${totals}`);
  check(totals.includes("Free"), `Cart delivery fee was ${totals}`);
  check(totals.includes("Chennai"), `Cart delivery note was ${totals}`);
  check(!totals.includes("not configured"), `Cart still described an unset origin: ${totals}`);
  check(totals.includes("Subtotal") && totals.includes("Delivery fee") && totals.includes("Total"), `Cart totals were incomplete: ${totals}`);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("[data-testid='cart-count']").textContent.trim() === "5");
  await page.getByTestId("cart-button").click();
  await page.getByTestId("cart-drawer").waitFor();
  await page.getByTestId("cart-line-ponni-boiled-rice-1kg").waitFor();
  await page.getByTestId("cart-line-basmati-rice-1kg").waitFor();
  check((await page.getByTestId("cart-line-ponni-boiled-rice-5kg").count()) === 0, "Removed pack returned after refresh");
  await page.getByTestId("view-cart").click();
  await page.waitForURL(/\/cart$/);
  await page.getByTestId("cart-page").waitFor();
  check((await page.getByTestId("cart-drawer").count()) === 0, "Cart page left the drawer open");
  await page.getByTestId("lang-ta").click();
  await page.getByText("உபதொகை").waitFor();
  const tamilCart = await page.getByTestId("cart-page").innerText();
  check(tamilCart.includes("பொன்னி புழுங்கல் அரிசி"), "Tamil cart omitted the product name");
  check(tamilCart.includes("1 கிலோ"), "Tamil cart omitted the pack size");
  check(tamilCart.includes("வரி மொத்தம்"), "Tamil cart omitted the line total");
  await page.getByTestId("lang-en").click();
  await page.getByTestId("cart-subtotal").filter({ hasText: "Subtotal" }).waitFor();
  const desktopCartOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!desktopCartOverflow, "Desktop cart overflowed");
  await page.getByTestId("cart-checkout").click();
  await page.waitForURL(/\/checkout/);
  check(await page.getByTestId("checkout-submit").isDisabled(), "Checkout opened before a pincode was confirmed");
  await page.goto(`${base}/cart`, { waitUntil: "networkidle" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("cart-button").click();
  await page.getByTestId("cart-drawer").waitFor();
  const mobileCartOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!mobileCartOverflow, "Mobile cart overflowed");
  await page.getByTestId("cart-drawer").getByRole("button", { name: "Close cart" }).click();
  await page.getByTestId("cart-drawer").waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.getByTestId("continue-shopping").click();
  await page.waitForURL(/\/products$/);
  await page.goto(`${base}/cart`, { waitUntil: "networkidle" });
  await page.getByTestId("clear-cart").click();
  await page.getByTestId("cart-empty").waitFor();
  check((await page.getByTestId("cart-count").innerText()) === "0", "Clear did not empty the multi-item cart");

  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByTestId("add-ponni-boiled-rice").click();
  await page.goto(`${base}/checkout`, { waitUntil: "networkidle" });
  check(await page.getByTestId("checkout-submit").isDisabled(), "Checkout was available before a pincode");
  check((await page.locator("[data-checkout-step='address']").count()) === 0, "Address fields showed before a pincode");
  check((await page.locator("[data-checkout-step='payment']").count()) === 0, "Payment showed before a pincode");
  await page.getByTestId("delivery-pincode").fill("623707");
  const sorryText = await page.getByTestId("checkout-delivery").innerText();
  check(sorryText.includes("can't deliver"), `Outside pincode status was ${sorryText}`);
  check((await page.locator("[data-checkout-step='address']").count()) === 0, "Address fields showed for Paramakudi");
  check(await page.getByTestId("checkout-submit").isDisabled(), "Paramakudi pincode unblocked checkout");
  await page.getByTestId("delivery-pincode").fill("600089");
  const confirmedText = await page.getByTestId("checkout-delivery").innerText();
  check(confirmedText.includes("Ramapuram") && confirmedText.includes("600089"), `Confirmed pincode status was ${confirmedText}`);
  check((await page.locator("[data-checkout-step='payment']").count()) === 0, "Payment showed before the address");
  await page.getByTestId("address-name").fill("Anand");
  await page.getByTestId("address-door").fill("12");
  await page.getByTestId("address-building").fill("Hillcrest");
  await page.getByTestId("address-street").fill("2nd Main Road");
  await page.getByTestId("address-locality").fill("Ramapuram");
  check((await page.getByTestId("address-city").inputValue()) === "Chennai", "City was not Chennai");
  check((await page.getByTestId("address-pincode").inputValue()) === "600089", "Address pincode did not follow the check");
  check((await page.locator("[data-checkout-step='payment']").count()) === 0, "Payment showed before the phone number");
  await page.getByTestId("address-phone").fill("9876543210");
  await page.getByTestId("payment-upi").waitFor();
  await page.getByTestId("payment-card").check();
  await page.getByTestId("payment-netbanking").check();
  await page.getByTestId("payment-cod").check();
  check(!(await page.getByTestId("checkout-submit").isDisabled()), "A complete Chennai address left checkout disabled");
  const checkoutText = await page.locator("body").innerText();
  check(!/payment successful|payment success|order paid|paid successfully/i.test(checkoutText), "Checkout claimed a payment success");
  check((await page.getByTestId("order-summary").innerText()).includes("Ponni Boiled Rice"), "Order summary hid the product");
  check((await page.getByTestId("summary-subtotal").innerText()).includes("₹160.00"), "Order summary hid the catalog price");
  const summaryFee = await page.getByTestId("summary-fee").innerText();
  check(summaryFee.includes("Free"), `Order summary fee was ${summaryFee}`);
  check(!summaryFee.includes("not configured"), "Order summary still described an unset origin");
  const fallback = await page.getByTestId("checkout-whatsapp").getAttribute("href");
  check(fallback?.startsWith("https://wa.me/919942034428?text="), `Checkout WhatsApp fallback was ${fallback}`);
  const fallbackText = decodeURIComponent(fallback.split("text=")[1]);
  check(fallbackText.includes("Product:"), "Checkout WhatsApp fallback omitted the product");
  check(fallbackText.includes("600089"), "Checkout WhatsApp fallback omitted the pincode");
  const flow = await page.getByTestId("checkout-flow").innerText();
  check(
    flow.includes("Cart") && flow.includes("Pincode") && flow.includes("Address") && flow.includes("Payment") && flow.includes("Confirmation"),
    `Checkout flow was ${flow}`,
  );
  const stepOrder = await page.locator("[data-checkout-step]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-checkout-step")));
  check(stepOrder.join(",") === "cart,pincode,address,summary,payment", `Checkout steps were ${stepOrder.join(",")}`);
  await page.getByTestId("lang-ta").click();
  await page.getByRole("heading", { name: "செக்அவுட்" }).waitFor();
  const tamilFlow = await page.getByTestId("checkout-flow").innerText();
  check(tamilFlow.includes("கார்ட்") && tamilFlow.includes("கட்டணம்"), `Tamil checkout flow was ${tamilFlow}`);
  const tamilDelivery = await page.getByTestId("checkout-delivery").innerText();
  check(tamilDelivery.includes("இராமபுரம்") && tamilDelivery.includes("600089"), `Tamil checkout delivery was ${tamilDelivery}`);
  check((await page.getByTestId("address-city").inputValue()) === "சென்னை", "Tamil city was not Chennai");
  await page.getByTestId("delivery-pincode").fill("600001");
  const tamilSorry = await page.getByTestId("checkout-delivery").innerText();
  check(tamilSorry.includes("மன்னிக்கவும்"), `Tamil sorry message was ${tamilSorry}`);
  check((await page.locator("[data-checkout-step='address']").count()) === 0, "Tamil address stayed open for an outside pincode");
  await page.setViewportSize({ width: 390, height: 844 });
  const checkoutOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!checkoutOverflow, "Checkout overflowed at 390px");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId("lang-en").click();
  await page.getByRole("heading", { name: "Checkout" }).waitFor();

  await page.goto(`${base}/products/ponni-boiled-rice`, { waitUntil: "networkidle" });
  await page.getByTestId("product-gallery").waitFor();
  await page.getByTestId("product-breadcrumb").waitFor();
  const crumb = await page.getByTestId("product-breadcrumb").innerText();
  check(crumb.includes("Home") && crumb.includes("Products") && crumb.includes("Everyday Rice"), `Breadcrumb was ${crumb}`);
  check((await page.getByTestId("product-name-en").evaluate((element) => element.tagName)) === "H1", "English name was not the page heading");
  check((await page.getByTestId("product-name-en").innerText()) === "Ponni Boiled Rice", "English product name missing");
  check((await page.getByTestId("product-name-ta").innerText()) === "பொன்னி புழுங்கல் அரிசி", "Tamil product name missing");
  check((await page.getByTestId("related-products").locator("a").count()) > 0, "Related products missing");
  check(await page.locator(".gallery-thumb").count() === 0, "Gallery invented extra frames for a single image");
  const detailPrice = await page.getByTestId("product-price").innerText();
  check(detailPrice.includes("₹160.00"), `Detail price state was ${detailPrice}`);
  const pack = page.getByTestId("product-pack");
  await pack.selectOption("5kg");
  check((await pack.inputValue()) === "5kg", "Pack size did not change");
  check((await page.getByTestId("product-price").innerText()).includes("₹799.00"), "5 kg price did not follow the pack");
  check(await page.getByRole("button", { name: "Buy Now" }).isVisible(), "Buy Now was not visible");
  const englishHref = await page.getByTestId("whatsapp-product").getAttribute("href");
  check(englishHref?.startsWith("https://wa.me/919942034428?text="), `WhatsApp link was ${englishHref}`);
  check(decodeURIComponent(englishHref.split("text=")[1]).includes("Product:"), "English WhatsApp message is missing the product line");
  await page.getByTestId("lang-ta").click();
  check((await page.getByTestId("product-name-ta").evaluate((element) => element.tagName)) === "H1", "Tamil name did not become the heading");
  const tamilCrumb = await page.getByTestId("product-breadcrumb").innerText();
  check(tamilCrumb.includes("முகப்பு") && tamilCrumb.includes("பொருட்கள்") && tamilCrumb.includes("தினசரி அரிசி"), `Tamil breadcrumb was ${tamilCrumb}`);
  check((await page.getByTestId("product-description").innerText()).includes("பொன்னி"), "Tamil description did not replace the English description");
  const tamilHref = await page.getByTestId("whatsapp-product").getAttribute("href");
  const tamilText = decodeURIComponent(tamilHref.split("text=")[1]);
  check(tamilText.includes("வணக்கம் ANANTHI RICE"), "Tamil WhatsApp message was not used");
  check(tamilText.includes("பொருள்:"), "Tamil WhatsApp message is missing the product line");

  await page.getByTestId("lang-en").click();
  check((await page.getByTestId("delivery-note").innerText()).includes("pincode"), "Product page omitted the pincode note");
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByTestId("delivery-areas").waitFor();
  const homeAreas = await page.getByTestId("delivery-areas").innerText();
  check(homeAreas.includes("600089") && homeAreas.includes("Ramapuram"), `Home delivery areas were ${homeAreas}`);
  check((await page.getByTestId("place-note-paramakudi").innerText()).includes("Head office"), "Paramakudi was not kept as the head office");
  check((await page.getByTestId("place-note-chennai").innerText()).includes("Chennai"), "Chennai card omitted the delivery note");
  await page.goto(`${base}/checkout`, { waitUntil: "networkidle" });
  await page.getByTestId("delivery-pincode").fill("600032");
  const guindy = await page.getByTestId("checkout-delivery").innerText();
  check(guindy.includes("Guindy") && guindy.includes("Ekkatuthangal"), `600032 status was ${guindy}`);
  check(await page.getByTestId("checkout-submit").isDisabled(), "Pincode alone enabled payment");
  const productImage = await page.request.get(`${base}/products/001_Ponni_Boiled_Rice_ANANTHI.png`);
  const logoImage = await page.request.get(`${base}/logos/Ananthi_Logo.png`);
  check(productImage.status() === 200, `Product image status ${productImage.status()}`);
  check(logoImage.status() === 200, `Logo image status ${logoImage.status()}`);

  const detailSamples = [
    { id: "seeraga-samba-rice", path: "/products/seeraga-samba-rice", english: "Seeraga Samba Rice", tamil: "சீரக சம்பா அரிசி", category: "Biryani Rice", brand: "ANANTHI", packCount: 4, price: "₹420.00", packValue: "10kg", packPrice: "₹4,200.00" },
    { id: "karuppu-kavuni-rice", path: "/products/karuppu-kavuni-rice", english: "Karuppu Kavuni Rice", tamil: "கருப்பு கவுனி அரிசி", category: "Traditional Rice", brand: "ANANTHI", packCount: 4, price: "₹320.00", packValue: "26kg", packPrice: "₹8,000.00" },
    { id: "hand-pounded-ponni-boiled-rice", path: "/products/hand-pounded-ponni-boiled-rice", english: "Hand-Pounded Ponni Boiled Rice", tamil: "கைக்குத்தல் பொன்னி புழுங்கல் அரிசி", category: "Hand-Pounded Rice", brand: "ANANTHI", packCount: 4, price: "₹290.00", packValue: "1kg", packPrice: "₹290.00" },
    { id: "ragi-sevai", path: "/products/ragi-sevai", english: "Ragi Sevai", tamil: "ராகி சேவை", category: "Sevai & Healthy Foods", brand: "MAHI", packCount: 4, price: "₹280.00", packValue: "5kg", packPrice: "₹1,400.00" },
    { id: "thinai", path: "/products/thinai", english: "Thinai / Foxtail Millet", tamil: "தினை", category: "Millets", brand: "MAHI", packCount: 4, price: "₹320.00", packValue: "10kg", packPrice: "₹3,200.00" },
    { id: "rice-flour", path: "/products/rice-flour", english: "Rice Flour", tamil: "அரிசி மாவு", category: "Flour Products", brand: "ANANTHI", packCount: 4, price: "₹100.00", packValue: "26kg", packPrice: "₹2,500.00" },
  ];
  for (const sample of detailSamples) await checkDetail(page, sample);
  const relatedHref = await page.getByTestId("related-products").locator("a").first().getAttribute("href");
  await page.getByTestId("related-products").locator("a").first().click();
  await page.waitForURL((url) => url.pathname === relatedHref);
  await page.getByTestId("product-breadcrumb").waitFor();
  await page.getByTestId("lang-ta").click();
  check((await page.getByTestId("product-name-ta").evaluate((element) => element.tagName)) === "H1", "Related product did not switch to Tamil");
  await page.getByTestId("lang-en").click();
  await page.goto(`${base}/products/not-a-real-product`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Page not found" }).waitFor();

  await page.goto(`${base}/account`, { waitUntil: "networkidle" });
  const banner = await page.getByTestId("dev-store-banner").innerText();
  check(banner.includes("DEVELOPMENT STORE"), "Development store banner is missing");
  check(/not production authentication/i.test(banner), "Auth banner does not say it is not production authentication");
  await page.getByRole("button", { name: "Sign Up" }).click();
  const email = `phase1-${Date.now()}@example.com`;
  const form = page.locator("form");
  await form.locator("input").nth(0).fill("Anand");
  await form.locator("input").nth(1).fill("9876543210");
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill("secret-pass");
  await form.locator("textarea").fill("Paramakudi");
  await page.getByTestId("signup-submit").click();
  await page.getByTestId("profile-email").waitFor();
  check((await page.getByTestId("profile-email").innerText()).includes(email), "Profile did not show the new account");
  const storedUsers = await page.evaluate(() => localStorage.getItem("ananthi.dev.users"));
  check(!storedUsers.includes("secret-pass"), "Development store stored a plaintext password");

  await page.getByTestId("logout").click();
  await page.getByTestId("login-email").waitFor();
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill("wrong-pass");
  await page.getByTestId("login-submit").click();
  const loginNotice = await page.getByTestId("account-notice").innerText();
  check(loginNotice.includes("Login failed"), `Wrong password notice was ${loginNotice}`);
  await page.getByTestId("login-password").fill("secret-pass");
  await page.getByTestId("login-submit").click();
  await page.getByTestId("profile-email").waitFor();
  check((await page.getByTestId("profile-email").innerText()).includes(email), "Login did not restore the profile");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("profile-email").waitFor();
  check((await page.getByTestId("profile-email").innerText()).includes(email), "Reload dropped the signed-in account");
  check((await page.getByTestId("profile-name").inputValue()) === "Anand", "Profile name did not load from the session");
  await page.getByTestId("profile-name").fill("");
  await page.getByTestId("profile-save").click();
  const emptyProfile = await page.locator("form .error").first().innerText();
  check(emptyProfile.includes("Enter your name."), `Empty profile save skipped validation: ${emptyProfile}`);
  await page.getByTestId("profile-name").fill("Anand");
  await page.getByTestId("profile-save").click();
  const savedProfile = await page.getByTestId("account-notice").innerText();
  check(savedProfile.includes("Profile saved"), `Profile save notice was ${savedProfile}`);
  check((await page.getByTestId("profile-email").innerText()).includes(email), "Profile save signed the visitor out");
  await page.getByTestId("logout").click();
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.getByTestId("signup-submit").click();
  const emptySignup = await page.locator("form .error").first().innerText();
  check(emptySignup.includes("Enter your name."), `Empty signup skipped validation: ${emptySignup}`);
  await page.getByTestId("lang-ta").click();
  await page.getByTestId("signup-submit").click();
  const tamilSignup = await page.locator("form .error").first().innerText();
  check(tamilSignup.includes("பெயரை உள்ளிடுங்கள்."), `Tamil signup validation was ${tamilSignup}`);
  await page.getByTestId("lang-en").click();
  await page.setViewportSize({ width: 390, height: 844 });
  const accountOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!accountOverflow, "Account page overflowed at 390px");
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation").getByRole("link", { name: "Products" }).waitFor({ state: "visible" });
  await page.getByTestId("lang-ta").click();
  await page.getByRole("button", { name: "கார்ட்டில் சேர்" }).first().waitFor();
  const mobileTamil = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
  check(mobileTamil.lang === "ta", "Mobile page did not switch to Tamil");
  check(!mobileTamil.overflow, "Tamil homepage overflowed at 390px");
  await page.getByTestId("lang-en").click();
  await page.getByRole("button", { name: "Add to Cart" }).first().waitFor();

  await page.goto(`${base}/faq`, { waitUntil: "networkidle" });
  check((await page.locator("body").innerText()).includes("What rice varieties do you sell?"), "FAQ did not render");
  await page.goto(`${base}/legal/delivery`, { waitUntil: "networkidle" });
  const policy = await page.locator("body").innerText();
  check(policy.includes("600089") && policy.includes("Paramakudi") && policy.includes("not available"), `Delivery policy was ${policy.slice(0, 400)}`);
  check(!policy.includes("5 km"), "Delivery policy still promised a 5 km radius");

  await page.setViewportSize({ width: 1280, height: 800 });
  page.setDefaultNavigationTimeout(60000);
  await page.goto(`${base}/products?category=everyday`, { waitUntil: "networkidle" });
  check((await page.getByTestId("shop-category").inputValue()) === "everyday", "Category filter did not keep the query");
  await page.getByTestId("product-ponni-boiled-rice").waitFor();
  check((await page.getByTestId("product-ragi-sevai").count()) === 0, "Category filter showed a product from another category");
  check((await page.getByTestId("product-ponni-boiled-rice").innerText()).includes("₹160.00"), "Shop card hid the 1 kg price");

  await page.goto(`${base}/products`, { waitUntil: "networkidle" });
  const countText = await page.getByTestId("shop-count").innerText();
  check(countText.includes("49"), `Catalog count was ${countText}`);
  check((await page.locator("[data-testid^='product-']").count()) === 12, "First shop page was not 12 products");
  await page.getByTestId("shop-next").click();
  await page.waitForURL(/page=2/);
  check((await page.getByTestId("shop-page").innerText()).includes("2"), "Page status did not move to page 2");
  check((await page.locator("[data-testid^='product-']").count()) === 12, "Second shop page was not 12 products");
  await page.getByTestId("shop-prev").click();
  await page.waitForFunction(() => !location.search.includes("page="));
  await page.getByTestId("shop-count").filter({ hasText: "1–12" }).waitFor();

  await page.getByTestId("shop-search").fill("zzzz-no-such-rice");
  check((await page.locator("[data-testid^='product-']").count()) === 12, "Search filtered before submit");
  await page.getByTestId("shop-submit").click();
  await page.getByTestId("shop-empty").waitFor();
  await page.getByTestId("shop-clear").click();
  await page.waitForFunction(() => !location.search);
  check((await page.getByTestId("shop-count").innerText()).includes("49"), "Clear filters did not restore the catalog");

  await page.getByTestId("shop-search").fill("Basmati Rice");
  await page.getByTestId("shop-submit").click();
  await page.waitForURL(/q=/);
  await page.getByTestId("product-basmati-rice").waitFor();
  await page.getByTestId("shop-brand").selectOption("santosh");
  await page.waitForURL(/brand=santosh/);
  await page.getByTestId("shop-empty").waitFor();
  await page.getByTestId("shop-clear").click();
  await page.waitForFunction(() => !location.search);

  await page.getByTestId("shop-brand").selectOption("mahi");
  await page.waitForURL(/brand=mahi/);
  await page.getByTestId("product-ragi-sevai").waitFor();
  check((await page.getByTestId("product-ponni-boiled-rice").count()) === 0, "Brand filter kept another brand");
  check((await page.getByTestId("product-karuppu-kavuni-rice").count()) === 0, "MAHI filter kept an ANANTHI rice");
  await page.getByTestId("add-ragi-sevai").click();
  await page.getByTestId("cart-drawer").waitFor();

  await page.goto(`${base}/products?sort=name-asc`, { waitUntil: "networkidle" });
  check((await page.getByTestId("shop-sort").inputValue()) === "name-asc", "Sort did not stay in the URL");

  await page.getByTestId("lang-ta").click();
  await page.getByRole("button", { name: "தேடு" }).waitFor();
  await page.getByTestId("lang-en").click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/products`, { waitUntil: "networkidle" });
  await page.getByTestId("shop-search").waitFor();
  await page.getByTestId("shop-next").waitFor();
  const shopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!shopOverflow, "Shop overflowed at 390px");

  await page.goto(`${base}/missing-page`, { waitUntil: "networkidle" });
  check((await page.locator("body").innerText()).includes("Page not found"), "404 page did not render");
} catch (error) {
  failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
}

await browser.close();

if (pageErrors.length > 0) failures.push(`Page errors: ${pageErrors.join(" | ")}`);
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("browser checks passed");
