"use client";

import { MapPin } from "lucide-react";
import type { CheckoutAddress, ShippingLocality } from "../types/checkoutType";

type LocalityState = { loading: boolean; error?: string };
type AddressFormProps = {
  values: CheckoutAddress;
  errors: Partial<Record<keyof CheckoutAddress, string>>;
  provinces: ShippingLocality[];
  districts: ShippingLocality[];
  wards: ShippingLocality[];
  provinceState: LocalityState;
  districtState: LocalityState;
  wardState: LocalityState;
  onChange: (field: keyof CheckoutAddress, value: string) => void;
  onRetry: (level: "province" | "district" | "ward") => void;
  onSubmit: () => void;
  busy?: boolean;
};

const controlClass =
  "min-h-11 w-full min-w-0 rounded-sm border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-danger";

function AddressForm({
  values,
  errors,
  provinces,
  districts,
  wards,
  provinceState,
  districtState,
  wardState,
  onChange,
  onRetry,
  onSubmit,
  busy = false,
}: AddressFormProps) {
  const textFields = [
    {
      field: "recipientName",
      label: "Recipient name",
      autoComplete: "shipping name",
      placeholder: "Full name",
      maxLength: 150,
    },
    {
      field: "phoneNumber",
      label: "Phone number",
      autoComplete: "shipping tel",
      placeholder: "Your delivery phone number",
      maxLength: 20,
    },
    {
      field: "addressLine",
      label: "Address line",
      autoComplete: "shipping address-line1",
      placeholder: "House number and street name",
      maxLength: 500,
    },
  ] as const;
  const localityFields = [
    {
      field: "provinceCode",
      level: "province",
      label: "Province / City",
      plural: "provinces",
      options: provinces,
      state: provinceState,
      enabled: true,
      placeholder: "Choose province / city",
    },
    {
      field: "districtCode",
      level: "district",
      label: "District",
      plural: "districts",
      options: districts,
      state: districtState,
      enabled: Boolean(values.provinceCode),
      placeholder: values.provinceCode ? "Choose district" : "Choose a province first",
    },
    {
      field: "wardCode",
      level: "ward",
      label: "Ward",
      plural: "wards",
      options: wards,
      state: wardState,
      enabled: Boolean(values.districtCode),
      placeholder: values.districtCode ? "Choose ward" : "Choose a district first",
    },
  ] as const;

  return (
    <form
      noValidate
      aria-label="Shipping address"
      aria-busy={busy}
      className="min-w-0 rounded-sm border border-border bg-card p-5 text-card-foreground sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <MapPin size={18} className="shrink-0 text-primary" aria-hidden="true" />
        1. Shipping Address
      </h2>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">
        Where should we deliver your order? All fields are required.
      </p>
      {Object.keys(errors).length > 0 && <p role="alert" className="mt-4 text-sm text-danger">Check the highlighted address fields below.</p>}
      <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
        {textFields.map(({ field, label, autoComplete, placeholder, maxLength }) => (
          <div key={field} className={`min-w-0 ${field === "addressLine" ? "sm:col-span-2" : ""}`}>
            <label htmlFor={`checkout-${field}`} className="mb-2 block text-sm font-medium">
              {label}
            </label>
            <input
              id={`checkout-${field}`}
              name={field}
              type={field === "phoneNumber" ? "tel" : "text"}
              autoComplete={autoComplete}
              value={values[field]}
              maxLength={maxLength}
              placeholder={placeholder}
              required
              aria-invalid={Boolean(errors[field])}
              aria-describedby={errors[field] ? `checkout-${field}-error` : undefined}
              className={controlClass}
              onChange={(event) => onChange(field, event.target.value)}
            />
            {errors[field] ? (
              <p id={`checkout-${field}-error`} className="mt-2 break-words text-sm text-danger">
                {errors[field]}
              </p>
            ) : null}
          </div>
        ))}
        {localityFields.map(({ field, level, label, plural, options, state, enabled, placeholder }) => {
          const describedBy = [
            errors[field] && `checkout-${field}-error`,
            state.error && `checkout-${field}-load-error`,
          ].filter(Boolean).join(" ") || undefined;
          return (
            <div key={field} className={`min-w-0 ${field === "wardCode" ? "sm:col-span-2" : ""}`}>
              <label htmlFor={`checkout-${field}`} className="mb-2 block text-sm font-medium">
                {label}
              </label>
              <select
                id={`checkout-${field}`}
                name={field}
                value={values[field]}
                required
                disabled={!enabled || state.loading || Boolean(state.error)}
                aria-invalid={Boolean(errors[field])}
                aria-describedby={describedBy}
                className={controlClass}
                onChange={(event) => onChange(field, event.target.value)}
              >
                <option value="">
                  {state.loading ? `Loading ${plural}…` : placeholder}
                </option>
                {options.map((option) => (
                  <option key={option.code} value={option.code}>{option.name}</option>
                ))}
              </select>
              {errors[field] ? (
                <p id={`checkout-${field}-error`} className="mt-2 break-words text-sm text-danger">
                  {errors[field]}
                </p>
              ) : null}
              {state.error ? (
                <div className="mt-2 text-sm">
                  <p id={`checkout-${field}-load-error`} role="alert" className="break-words text-danger">
                    {state.error}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRetry(level)}
                    className="inline-flex min-h-11 min-w-11 items-center rounded-sm font-medium text-primary underline underline-offset-4"
                  >
                    Retry {plural}
                  </button>
                </div>
              ) : null}
              {enabled && !state.loading && !state.error && !options.length ? (
                <p role="status" className="mt-2 text-sm text-muted-foreground">
                  No {plural} available. Choose another location or try again later.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
          Shipping is recalculated when your delivery address changes.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 min-w-11 w-full items-center justify-center rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          Review address
        </button>
      </div>
    </form>
  );
}

export default AddressForm;
