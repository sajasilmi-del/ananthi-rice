import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export type CustomerInput = {
  name: string;
  mobile: string;
  email: string;
  password?: string;
  address: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCustomer(
  input: CustomerInput,
  locale: Locale,
  options: { password: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) errors.name = t(locale, "validation.nameRequired");
  else if (name.length < 2) errors.name = t(locale, "validation.nameShort");
  const mobile = input.mobile.replace(/\s+/g, "");
  if (!mobile) errors.mobile = t(locale, "validation.mobileRequired");
  else if (!/^[0-9]{10}$/.test(mobile)) errors.mobile = t(locale, "validation.mobileInvalid");
  const email = input.email.trim();
  if (!email) errors.email = t(locale, "validation.emailRequired");
  else if (!emailPattern.test(email)) errors.email = t(locale, "validation.emailInvalid");
  const address = input.address.trim();
  if (!address) errors.address = t(locale, "validation.addressRequired");
  else if (address.length < 5) errors.address = t(locale, "validation.addressShort");
  if (options.password) {
    const password = (input.password ?? "").trim();
    if (!password) errors.password = t(locale, "validation.passwordRequired");
    else if (password.length < 8) errors.password = t(locale, "validation.passwordShort");
  }
  return errors;
}

export function validatePasswordReset(
  input: { email: string; password: string },
  locale: Locale,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const email = input.email.trim();
  if (!email) errors.email = t(locale, "validation.emailRequired");
  else if (!emailPattern.test(email)) errors.email = t(locale, "validation.emailInvalid");
  const password = input.password.trim();
  if (!password) errors.password = t(locale, "validation.passwordRequired");
  else if (password.length < 8) errors.password = t(locale, "validation.passwordShort");
  return errors;
}

export function validateLogin(
  input: { email: string; password: string },
  locale: Locale,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.email.trim()) errors.email = t(locale, "validation.emailRequired");
  else if (!emailPattern.test(input.email.trim())) errors.email = t(locale, "validation.emailInvalid");
  if (!input.password.trim()) errors.password = t(locale, "validation.passwordRequired");
  return errors;
}
