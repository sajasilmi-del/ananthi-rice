import { describe, expect, it } from "vitest";
import { createAuthAdapter } from "@/lib/auth";
import { createDevAuthAdapter } from "@/lib/auth/dev-adapter";
import { t } from "@/lib/i18n";
import { validateCustomer, validateLogin, validatePasswordReset } from "@/lib/validation";

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

const customer = {
  name: "Anand",
  mobile: "9876543210",
  email: "phase1@example.com",
  password: "secret-pass",
  address: "Paramakudi",
};

describe("account validation", () => {
  it("accepts the signup values used by the shop and keeps checkout password optional", () => {
    expect(validateCustomer(customer, "en", { password: true })).toEqual({});
    expect(validateCustomer({ ...customer, password: undefined }, "en", { password: false })).toEqual({});
    expect(validateCustomer({ ...customer, mobile: "98765 43210" }, "ta", { password: true })).toEqual({});
  });

  it("returns bilingual messages for empty, short, and invalid fields", () => {
    const english = validateCustomer({ name: "", mobile: "", email: "", password: "", address: "" }, "en", { password: true });
    const tamil = validateCustomer({ name: "", mobile: "", email: "not-an-email", password: "short", address: "Home" }, "ta", { password: true });
    expect(english.name).toBe("Enter your name.");
    expect(english.mobile).toBe(t("en", "validation.mobileRequired"));
    expect(english.email).toBe(t("en", "validation.emailRequired"));
    expect(english.password).toBe(t("en", "validation.passwordRequired"));
    expect(english.address).toBe(t("en", "validation.addressRequired"));
    expect(tamil.name).toBe("பெயரை உள்ளிடுங்கள்.");
    expect(tamil.email).toBe(t("ta", "validation.emailInvalid"));
    expect(tamil.password).toBe(t("ta", "validation.passwordShort"));
    expect(tamil.address).toBe(t("ta", "validation.addressShort"));
    expect(validateCustomer({ ...customer, name: "A" }, "en", { password: true }).name).toBe(t("en", "validation.nameShort"));
    expect(validateCustomer({ ...customer, mobile: "123" }, "en", { password: true }).mobile).toBe(t("en", "validation.mobileInvalid"));
    expect(validateCustomer({ ...customer, password: "        " }, "en", { password: true }).password).toBe(t("en", "validation.passwordRequired"));
    expect(validateLogin({ email: "", password: "   " }, "ta")).toMatchObject({
      email: t("ta", "validation.emailRequired"),
      password: t("ta", "validation.passwordRequired"),
    });
    expect(validateLogin({ email: customer.email, password: "wrong-pass" }, "en")).toEqual({});
    expect(validatePasswordReset({ email: "", password: "short" }, "en")).toMatchObject({
      email: t("en", "validation.emailRequired"),
      password: t("en", "validation.passwordShort"),
    });
    expect(validatePasswordReset({ email: customer.email, password: customer.password }, "ta")).toEqual({});
  });
});

describe("development account adapter", () => {
  it("signs up, rejects a duplicate, logs in, and keeps the password out of storage", async () => {
    const storage = new MemoryStorage();
    const auth = createDevAuthAdapter(storage);
    const created = await auth.signUp(customer);
    expect(created.ok).toBe(true);
    const stored = storage.getItem("ananthi.dev.users") ?? "";
    expect(stored).not.toContain("secret-pass");
    expect(stored).toMatch(/"passwordHash":"[0-9a-f]{64}"/);
    const duplicate = await auth.signUp({ ...customer, email: "Phase1@Example.com" });
    expect(duplicate).toEqual({ ok: false, error: "exists" });
    const spaces = await auth.signUp({ ...customer, email: "other@example.com", password: "        " });
    expect(spaces).toEqual({ ok: false, error: "weak_password" });
    expect(await auth.login({ email: customer.email, password: "wrong-pass" })).toEqual({ ok: false, error: "invalid" });
    expect((await auth.login({ email: "Phase1@Example.com", password: customer.password })).ok).toBe(true);
    await auth.logout();
    expect(await auth.getSession()).toBeNull();
    const again = createDevAuthAdapter(storage);
    expect(await again.login({ email: customer.email, password: customer.password })).toMatchObject({ ok: true });
    expect((await again.getSession())?.email).toBe(customer.email);
  });

  it("resets a development password without sending email and updates the profile", async () => {
    const storage = new MemoryStorage();
    const auth = createDevAuthAdapter(storage);
    await auth.signUp(customer);
    await auth.logout();
    const missing = await auth.requestPasswordReset({ email: "missing@example.com" });
    expect(missing).toEqual({ mode: "development", emailSent: false, accepted: false });
    const accepted = await auth.requestPasswordReset({ email: customer.email });
    expect(accepted.emailSent).toBe(false);
    expect(accepted.accepted).toBe(true);
    expect(await auth.devSetPassword({ email: customer.email, password: "short" })).toEqual({ ok: false, error: "weak_password" });
    expect((await auth.devSetPassword({ email: customer.email, password: "another-pass" })).ok).toBe(true);
    expect(await auth.login({ email: customer.email, password: customer.password })).toEqual({ ok: false, error: "invalid" });
    expect((await auth.login({ email: customer.email, password: "another-pass" })).ok).toBe(true);
    const cleared = await auth.updateProfile({ name: " ", mobile: "", address: "" });
    expect(cleared).toEqual({ ok: false, error: "invalid" });
    expect((await auth.getSession())?.name).toBe("Anand");
    const saved = await auth.updateProfile({ name: "Anandhavalli" });
    expect(saved.ok).toBe(true);
    const session = await auth.getSession();
    expect(session?.name).toBe("Anandhavalli");
    expect(session?.mobile).toBe(customer.mobile);
    expect(session?.address).toBe(customer.address);
    await auth.logout();
    expect(await auth.updateProfile({ name: "Anand" })).toEqual({ ok: false, error: "missing" });
  });
});

describe("authentication provider selection", () => {
  it("keeps an empty provider on the development adapter", () => {
    const storage = new MemoryStorage();
    const auth = createAuthAdapter(storage, "  ");
    expect(auth.mode).toBe("development");
    expect(auth.label).toBe("DEVELOPMENT STORE");
    expect(auth.configured).toBe(true);
    expect(createAuthAdapter(storage, "development").mode).toBe("development");
  });

  it("uses the development adapter when AUTH_PROVIDER is unset", () => {
    const previous = process.env.AUTH_PROVIDER;
    delete process.env.AUTH_PROVIDER;
    try {
      expect(createAuthAdapter(new MemoryStorage()).mode).toBe("development");
    } finally {
      if (previous === undefined) delete process.env.AUTH_PROVIDER;
      else process.env.AUTH_PROVIDER = previous;
    }
  });

  it("refuses a named production provider and writes nothing", async () => {
    const storage = new MemoryStorage();
    const auth = createAuthAdapter(storage, "server");
    expect(auth.mode).toBe("unconfigured");
    expect(auth.configured).toBe(false);
    expect(await auth.signUp(customer)).toEqual({ ok: false, error: "not_configured" });
    expect(await auth.login({ email: customer.email, password: customer.password })).toEqual({ ok: false, error: "not_configured" });
    expect(await auth.getSession()).toBeNull();
    expect(await auth.requestPasswordReset({ email: customer.email })).toEqual({
      mode: "unconfigured",
      emailSent: false,
      accepted: false,
    });
    expect(await auth.devSetPassword({ email: customer.email, password: "another-pass" })).toEqual({
      ok: false,
      error: "not_configured",
    });
    const profile = await auth.updateProfile({ name: "Anand" });
    expect(profile).toEqual({ ok: false, error: "not_configured" });
    await auth.logout();
    expect(storage.length).toBe(0);
  });
});
