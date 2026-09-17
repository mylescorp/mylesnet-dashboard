"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation } from "@/app/lib/convex";
import { signup, type SignupFormOptions, type SignupSessionView } from "@/shared/convex/signup";
import {
  COUNTRIES,
  CURRENCIES,
  COUNTRY_BY_CODE,
  defaultCurrencyForCountry,
} from "@/signup/data/countries";
import { Field, FormError, SubmitButton, extractErrorMessage } from "../fields";

function timezoneOptions(preferred: string): string[] {
  if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
    const all = Intl.supportedValuesOf("timeZone");
    const unique = new Set([preferred, ...all]);
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }
  const fallback = preferred || "UTC";
  const common = ["Africa/Nairobi", "Africa/Lagos", "Africa/Johannesburg", "Asia/Dubai", "Europe/London", "America/New_York", "Asia/Singapore"];
  return Array.from(new Set([fallback, ...common])).sort();
}

export function DefaultsStep({
  token,
  session,
  formOptions,
  onFatal,
}: {
  token: string;
  session: SignupSessionView;
  formOptions: SignupFormOptions;
  onFatal: (message: string) => void;
}) {
  const setDefaults = useMutation(signup.setDefaults);
  const initialCountry = COUNTRY_BY_CODE.has(session.country) ? session.country : "";
  const initialTimezone = session.timezone || (initialCountry ? COUNTRY_BY_CODE.get(initialCountry)!.timezone : "UTC");
  const [form, setForm] = useState({
    country: initialCountry,
    timezone: initialTimezone,
    currency: session.currency || defaultCurrencyForCountry(initialCountry),
    referralSource: session.referralSource || "",
    phone: session.phone || "",
  });
  const [search, setSearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Partial<{ country: string; timezone: string; currency: string }>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const timezones = useMemo(() => timezoneOptions(form.timezone), [form.timezone]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return COUNTRIES;
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(term) || country.code.toLowerCase().includes(term),
    );
  }, [search]);

  useEffect(() => {
    if (!countryOpen) return;
    function closeOnOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest("[data-country-combobox]")) setCountryOpen(false);
    }
    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, [countryOpen]);

  function selectCountry(code: string) {
    const country = COUNTRY_BY_CODE.get(code);
    if (!country) return;
    const nextCurrency = defaultCurrencyForCountry(code);
    setForm((current) => ({
      ...current,
      country: code,
      timezone: current.timezone || country.timezone,
      currency: current.currency && COUNTRY_BY_CODE.get(current.country)?.currencies.includes(current.currency)
        ? current.currency
        : nextCurrency,
    }));
    setCountryOpen(false);
    setSearch("");
  }

  function validate(): boolean {
    const errors: Partial<{ country: string; timezone: string; currency: string }> = {};
    if (!COUNTRY_BY_CODE.has(form.country)) errors.country = "Select the country you operate in.";
    if (!form.timezone) errors.timezone = "Choose a timezone.";
    if (!/^[A-Za-z]{3}$/.test(form.currency)) errors.currency = "Choose a currency.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await setDefaults({
        token,
        country: form.country,
        timezone: form.timezone,
        currency: form.currency.toUpperCase().trim(),
        referralSource: form.referralSource || undefined,
        phone: form.phone.trim() || undefined,
      });
    } catch (error) {
      const message = extractErrorMessage(error, "We could not save your operating defaults. Please try again.");
      setFormError(message);
      if (message.includes("expired")) onFatal(message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCountry = COUNTRY_BY_CODE.get(form.country);

  return (
    <form className="signup-step-form" onSubmit={handleSubmit} noValidate>
      <p className="signup-step-description">
        These defaults shape billing, reports and the experience of your subscribers.
      </p>
      <Field label="Country" htmlFor="signup-country" error={fieldErrors.country}>
        <div className="signup-combobox" data-country-combobox>
          <input
            id="signup-country"
            className="signup-input"
            name="country"
            role="combobox"
            aria-expanded={countryOpen}
            aria-controls="signup-country-list"
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="Search your country"
            value={search}
            onFocus={() => setCountryOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCountryOpen(true);
                setHighlighted((index) => Math.min(index + 1, filtered.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlighted((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && countryOpen && filtered[highlighted]) {
                event.preventDefault();
                selectCountry(filtered[highlighted].code);
              } else if (event.key === "Escape") {
                setCountryOpen(false);
              }
            }}
            onChange={(event) => {
                setSearch(event.target.value);
                setHighlighted(0);
              }}
          />
          <input type="hidden" name="countryCode" value={form.country} />
          {countryOpen ? (
            <ul id="signup-country-list" className="signup-combobox-list" role="listbox">
              {filtered.length === 0 ? (
                <li className="signup-combobox-empty">No countries found.</li>
              ) : (
                filtered.map((country, index) => (
                  <li
                    key={country.code}
                    role="option"
                    aria-selected={country.code === form.country}
                    className={`signup-combobox-option ${index === highlighted ? "signup-combobox-option-active" : ""}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectCountry(country.code);
                    }}
                    onMouseEnter={() => setHighlighted(index)}
                  >
                    <span>{country.name}</span>
                    <span className="signup-combobox-code">{country.code}</span>
                  </li>
                ))
              )}
            </ul>
          ) : null}
          {selectedCountry ? (
            <p className="signup-combobox-selected">{selectedCountry.name}</p>
          ) : null}
        </div>
      </Field>
      <div className="signup-field-row">
        <Field label="Timezone" htmlFor="signup-timezone" error={fieldErrors.timezone}>
          <select
            id="signup-timezone"
            className="signup-input signup-select"
            name="timezone"
            value={form.timezone}
            onChange={(event) => setForm({ ...form, timezone: event.target.value })}
          >
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Billing currency" htmlFor="signup-currency" error={fieldErrors.currency}>
          <select
            id="signup-currency"
            className="signup-input signup-select"
            name="currency"
            value={form.currency}
            onChange={(event) => setForm({ ...form, currency: event.target.value })}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code} — {currency.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="How did you hear about us?" htmlFor="signup-referral">
        <select
          id="signup-referral"
          className="signup-input signup-select"
          name="referralSource"
          value={form.referralSource}
          onChange={(event) => setForm({ ...form, referralSource: event.target.value })}
        >
          <option value="">Select an option</option>
          {formOptions.referralSources.map((source) => (
            <option key={source.value} value={source.value}>
              {source.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Phone (optional)"
        htmlFor="signup-phone"
        hint="Used for account recovery and platform contact messages."
      >
        <input
          id="signup-phone"
          className="signup-input"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+254 712 345 678"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
      </Field>
      <FormError message={formError} />
      <SubmitButton pending={submitting}>Continue</SubmitButton>
    </form>
  );
}