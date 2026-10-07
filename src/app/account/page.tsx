"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import type { AuthFailure } from "@/lib/auth/types";
import type { Locale } from "@/lib/types";
import { validateCustomer, validateLogin, validatePasswordReset } from "@/lib/validation";
import { useAuth, useLanguage } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SectionHeading } from "@/components/ui/SectionHeading";

type Mode = "login" | "signup" | "forgot" | "profile";

function failureNotice(error: AuthFailure["error"], locale: Locale): string {
  if (error === "exists") return t(locale, "errors.signupExists");
  if (error === "not_configured") return t(locale, "account.productionUnconfigured");
  if (error === "missing") return t(locale, "account.noSession");
  if (error === "not_found") return t(locale, "account.accountMissing");
  if (error === "weak_password") return t(locale, "validation.passwordShort");
  if (error === "invalid") return t(locale, "errors.loginFailed");
  return t(locale, "errors.signupFailed");
}

export default function AccountPage() {
  const { locale } = useLanguage();
  const { adapter, user, refresh } = useAuth();
  const choseMode = useRef(false);
  const [mode, setMode] = useState<Mode>(user ? "profile" : "login");
  const [name, setName] = useState(user?.name ?? "");
  const [mobile, setMobile] = useState(user?.mobile ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState(user?.address ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setMobile(user.mobile);
    setAddress(user.address);
    setEmail(user.email);
    if (!choseMode.current) setMode("profile");
  }, [user]);

  function chooseMode(next: Mode) {
    choseMode.current = true;
    setMode(next);
    setErrors({});
    setNotice("");
  }

  async function onSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!adapter) return;
    const nextErrors = validateCustomer({ name, mobile, email, password, address }, locale, { password: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice("");
      return;
    }
    const result = await adapter.signUp({
      name: name.trim(),
      mobile: mobile.replace(/\s+/g, ""),
      email: email.trim(),
      password: password.trim(),
      address: address.trim(),
    });
    if (!result.ok) {
      setNotice(failureNotice(result.error, locale));
      return;
    }
    setName(result.user.name);
    setMobile(result.user.mobile);
    setAddress(result.user.address);
    setEmail(result.user.email);
    setPassword("");
    await refresh();
    setMode("profile");
    setNotice("");
  }

  async function onLogin(event: React.FormEvent) {
    event.preventDefault();
    if (!adapter) return;
    const nextErrors = validateLogin({ email, password }, locale);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice("");
      return;
    }
    const result = await adapter.login({ email: email.trim(), password: password.trim() });
    if (!result.ok) {
      setNotice(failureNotice(result.error, locale));
      return;
    }
    setPassword("");
    await refresh();
    setMode("profile");
    setNotice("");
  }

  async function onForgot(event: React.FormEvent) {
    event.preventDefault();
    if (!adapter) return;
    const nextErrors = validatePasswordReset({ email, password }, locale);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice(`${t(locale, "account.resetNote")} ${t(locale, "account.emailNotSent")}`);
      return;
    }
    if (adapter.mode === "unconfigured") {
      setNotice(t(locale, "account.productionUnconfigured"));
      return;
    }
    const reset = await adapter.requestPasswordReset({ email: email.trim() });
    if (!reset.accepted) {
      setNotice(`${t(locale, "account.accountMissing")} ${t(locale, "account.emailNotSent")}`);
      return;
    }
    const updated = await adapter.devSetPassword({ email: email.trim(), password: password.trim() });
    setPassword("");
    if (!updated.ok) {
      setNotice(failureNotice(updated.error, locale));
      return;
    }
    setNotice(t(locale, "account.passwordUpdated"));
  }

  async function onProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!adapter || !user) return;
    const nextErrors = validateCustomer({ name, mobile, email: user.email, address }, locale, { password: false });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice("");
      return;
    }
    const result = await adapter.updateProfile({
      name: name.trim(),
      mobile: mobile.replace(/\s+/g, ""),
      address: address.trim(),
    });
    if (!result.ok) {
      setNotice(result.error === "invalid" ? t(locale, "account.saveFailed") : failureNotice(result.error, locale));
      return;
    }
    await refresh();
    setNotice(t(locale, "account.profileSaved"));
  }

  async function onLogout() {
    await adapter?.logout();
    await refresh();
    setName("");
    setMobile("");
    setEmail("");
    setPassword("");
    setAddress("");
    setErrors({});
    setNotice("");
    choseMode.current = true;
    setMode("login");
  }

  const banner = adapter?.mode === "unconfigured"
    ? t(locale, "account.productionUnconfigured")
    : t(locale, "account.deviceNote");

  return (
    <div className="stack" data-testid="account-page">
      <SectionHeading as="h1" title={t(locale, "account.title")} />
      <p className="banner" data-testid="account-note">
        {banner}
      </p>
      <div className="row account-tabs">
        <Button variant={mode === "login" ? "primary" : "ghost"} aria-pressed={mode === "login"} onClick={() => chooseMode("login")}>{t(locale, "account.login")}</Button>
        <Button variant={mode === "signup" ? "primary" : "ghost"} aria-pressed={mode === "signup"} onClick={() => chooseMode("signup")}>{t(locale, "account.signUp")}</Button>
        <Button variant={mode === "forgot" ? "primary" : "ghost"} aria-pressed={mode === "forgot"} onClick={() => chooseMode("forgot")}>{t(locale, "account.forgot")}</Button>
        <Button variant={mode === "profile" ? "primary" : "ghost"} aria-pressed={mode === "profile"} onClick={() => chooseMode("profile")}>{t(locale, "account.profile")}</Button>
      </div>
      {notice ? <p className="notice" data-testid="account-notice">{notice}</p> : null}
      {mode === "signup" ? (
        <form className="stack account-form" noValidate onSubmit={onSignup}>
          <FormField label={t(locale, "forms.name")} error={errors.name}>
            <input value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
          </FormField>
          <FormField label={t(locale, "forms.mobile")} error={errors.mobile}>
            <input type="tel" value={mobile} autoComplete="tel" inputMode="numeric" onChange={(event) => setMobile(event.target.value)} />
          </FormField>
          <FormField label={t(locale, "forms.email")} error={errors.email}>
            <input data-testid="signup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </FormField>
          <FormField label={t(locale, "forms.password")} error={errors.password}>
            <input data-testid="signup-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </FormField>
          <FormField label={t(locale, "forms.address")} error={errors.address}>
            <textarea value={address} autoComplete="street-address" onChange={(event) => setAddress(event.target.value)} />
          </FormField>
          <Button type="submit" data-testid="signup-submit">{t(locale, "account.signUp")}</Button>
        </form>
      ) : null}
      {mode === "login" ? (
        <form className="stack account-form" noValidate onSubmit={onLogin}>
          <FormField label={t(locale, "forms.email")} error={errors.email}>
            <input data-testid="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </FormField>
          <FormField label={t(locale, "forms.password")} error={errors.password}>
            <input data-testid="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </FormField>
          <Button type="submit" data-testid="login-submit">{t(locale, "account.login")}</Button>
        </form>
      ) : null}
      {mode === "forgot" ? (
        <form className="stack account-form" noValidate onSubmit={onForgot}>
          <p>{t(locale, "account.resetNote")}</p>
          <p>{t(locale, "account.emailNotSent")}</p>
          <FormField label={t(locale, "forms.email")} error={errors.email}>
            <input data-testid="forgot-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </FormField>
          <FormField label={t(locale, "forms.newPassword")} error={errors.password}>
            <input data-testid="forgot-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </FormField>
          <Button type="submit" data-testid="forgot-submit">{t(locale, "account.setPassword")}</Button>
        </form>
      ) : null}
      {mode === "profile" ? (
        user ? (
          <form className="stack account-form" noValidate onSubmit={onProfile}>
            <p data-testid="profile-email">{t(locale, "account.loggedInAs")}: {user.email}</p>
            <FormField label={t(locale, "forms.name")} error={errors.name}>
              <input data-testid="profile-name" value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
            </FormField>
            <FormField label={t(locale, "forms.mobile")} error={errors.mobile}>
              <input data-testid="profile-mobile" type="tel" value={mobile} autoComplete="tel" inputMode="numeric" onChange={(event) => setMobile(event.target.value)} />
            </FormField>
            <FormField label={t(locale, "forms.address")} error={errors.address}>
              <textarea data-testid="profile-address" value={address} autoComplete="street-address" onChange={(event) => setAddress(event.target.value)} />
            </FormField>
            <Button type="submit" data-testid="profile-save">{t(locale, "forms.save")}</Button>
            <Button type="button" variant="ghost" data-testid="logout" onClick={() => void onLogout()}>
              {t(locale, "account.logout")}
            </Button>
          </form>
        ) : (
          <p>{t(locale, "account.noSession")}</p>
        )
      ) : null}
    </div>
  );
}
