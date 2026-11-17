"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/components/Providers";
import { t } from "@/lib/i18n";
import { site } from "@/lib/catalog";
import { isMoney, priceKey, type AdminProductRow } from "@/lib/price-book";
import type { PriceStorageMode } from "@/lib/price-store-mode";

type Draft = Record<string, string>;

function draftFrom(rows: AdminProductRow[]): Draft {
  const draft: Draft = {};
  for (const row of rows) {
    for (const variant of row.variants) draft[priceKey(row.id, variant.id)] = variant.price == null ? "" : String(variant.price);
  }
  return draft;
}

function parseDraft(raw: string): number | null | "invalid" {
  const value = raw.trim();
  if (value === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return "invalid";
  const price = Number(value);
  if (!isMoney(price)) return "invalid";
  return price;
}

export function AdminPrices({
  authed,
  rows,
  storage,
  saved,
}: {
  authed: boolean;
  rows: AdminProductRow[];
  storage: PriceStorageMode;
  saved: boolean;
}) {
  const { locale } = useLanguage();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(() => draftFrom(rows));
  const initial = useMemo(() => draftFrom(rows), [rows]);
  const text = (key: string) => t(locale, `admin.${key}`);

  if (!authed) {
    return (
      <div className="admin-page">
        <form
          className="admin-card admin-login"
          data-testid="admin-login"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            try {
              const response = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ password }),
              });
              const body = (await response.json().catch(() => null)) as { error?: string } | null;
              if (!response.ok) {
                const code = body?.error === "limited" || body?.error === "unconfigured" ? body.error : "wrongPassword";
                setError(text(code));
                setPending(false);
                return;
              }
              window.location.assign("/admin");
            } catch {
              setError(text("tryAgain"));
              setPending(false);
            }
          }}
        >
          <p className="admin-kicker">{site.brandName}</p>
          <h1>{text("title")}</h1>
          <label className="field" htmlFor="admin-password">
            {text("password")}
            <input
              id="admin-password"
              data-testid="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="admin-error" data-testid="admin-login-error">{error}</p> : null}
          <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>
            {pending ? text("checking") : text("enter")}
          </button>
        </form>
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (!needle) return true;
    return `${row.nameTamil} ${row.nameEnglish} ${row.categoryTamil} ${row.categoryEnglish}`.toLowerCase().includes(needle);
  });
  const groups: { id: string; titleTamil: string; titleEnglish: string; rows: AdminProductRow[] }[] = [];
  for (const row of visible) {
    const group = groups.find((item) => item.id === row.categoryId);
    if (group) group.rows.push(row);
    else groups.push({ id: row.categoryId, titleTamil: row.categoryTamil, titleEnglish: row.categoryEnglish, rows: [row] });
  }
  const invalid = Object.values(draft).some((value) => parseDraft(value) === "invalid");
  const changed = Object.keys(draft).some((key) => draft[key] !== initial[key]);

  return (
    <div className="admin-page">
      <header className="admin-top">
        <div>
          <p className="admin-kicker">{site.brandName}</p>
          <h1>{text("title")}</h1>
          <p className="admin-lede">{text("intro")}</p>
        </div>
        <div className="admin-top-actions">
          <a className="btn btn-secondary" href="/products" target="_blank" rel="noreferrer">
            {text("viewShop")}
          </a>
          <button
            className="btn btn-ghost"
            type="button"
            data-testid="admin-logout"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              window.location.assign("/admin");
            }}
          >
            {text("logout")}
          </button>
        </div>
      </header>

      {saved ? <p className="admin-success" data-testid="admin-status">{text("saved")}</p> : null}
      {storage === "unavailable" ? <p className="admin-error">{text("storage")}</p> : null}

      <label className="field admin-search" htmlFor="admin-search">
        {text("search")}
        <input
          id="admin-search"
          data-testid="admin-search"
          value={query}
          placeholder={text("searchPlaceholder")}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className="note">{text("hint")}</p>

      {groups.length === 0 ? <p className="admin-card">{text("none")}</p> : null}

      <div className="admin-list">
        {groups.map((group) => (
          <section key={group.id} className="admin-group">
            <h2>
              {locale === "ta" ? group.titleTamil : group.titleEnglish}
              <span>{locale === "ta" ? group.titleEnglish : group.titleTamil}</span>
            </h2>
            {group.rows.map((row) => (
              <article key={row.id} className="admin-card" data-testid={`admin-product-${row.id}`}>
                <h3>
                  {locale === "ta" ? row.nameTamil : row.nameEnglish}
                  <span>{locale === "ta" ? row.nameEnglish : row.nameTamil}</span>
                </h3>
                <div className="admin-packs">
                  {row.variants.map((variant) => {
                    const key = priceKey(row.id, variant.id);
                    const value = draft[key] ?? "";
                    const bad = parseDraft(value) === "invalid";
                    const pack = locale === "ta" ? variant.packTamil : variant.packEnglish;
                    return (
                      <label key={variant.id} className="field">
                        {pack}
                        <input
                          data-testid={`admin-price-${row.id}-${variant.id}`}
                          inputMode="decimal"
                          autoComplete="off"
                          value={value}
                          aria-invalid={bad}
                          className={bad ? "admin-bad" : undefined}
                          onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                        />
                      </label>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>

      <div className="admin-savebar">
        <p>{invalid ? text("invalid") : changed ? text("unsaved") : text("clean")}</p>
        <button
          className="btn btn-primary btn-lg"
          type="button"
          data-testid="admin-save"
          disabled={pending || invalid || !changed || storage === "unavailable"}
          onClick={async () => {
            setPending(true);
            setError("");
            const prices = rows.flatMap((row) =>
              row.variants.map((variant) => ({
                productId: row.id,
                variantId: variant.id,
                price: parseDraft(draft[priceKey(row.id, variant.id)] ?? ""),
              })),
            );
            try {
              const response = await fetch("/api/admin/prices", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ prices }),
              });
              if (!response.ok) {
                setError(text("saveFailed"));
                setPending(false);
                return;
              }
              window.location.assign("/admin?saved=1");
            } catch {
              setError(text("saveFailed"));
              setPending(false);
            }
          }}
        >
          {pending ? text("saving") : text("save")}
        </button>
      </div>
      {error ? <p className="admin-error" data-testid="admin-save-error">{error}</p> : null}
    </div>
  );
}
