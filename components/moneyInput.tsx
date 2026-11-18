"use client";

import { useState, type InputHTMLAttributes } from "react";

export const groupedVnd = (raw: string) => {
  const [whole, fraction] = raw.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return fraction === undefined || /^0*$/.test(fraction) ? grouped : `${grouped},${fraction}`;
};

export const rawVnd = (text: string) => text.trim().replaceAll(".", "").replace(",", ".");

export const initialVnd = (value?: string | number | null) => value === null || value === undefined || value === "" ? "" : String(value).replace(/\.0+$/, "");

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> & { value: string; onValueChange: (raw: string) => void };

const typedVnd = (raw: string) => {
  const [whole, fraction] = raw.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
};

export function MoneyInput({ value, onValueChange, onFocus, onBlur, ...props }: MoneyInputProps) {
  const [text, setText] = useState<string | null>(null);
  return <input {...props} inputMode="decimal" autoComplete="off" value={text ?? groupedVnd(value)}
    onFocus={(event) => { setText(groupedVnd(value)); onFocus?.(event); }}
    onBlur={(event) => { setText(null); onBlur?.(event); }}
    onChange={(event) => { const raw = rawVnd(event.target.value); setText(typedVnd(raw)); onValueChange(raw); }} />;
}

export function MoneyField({ name, defaultValue, ...props }: Omit<MoneyInputProps, "value" | "onValueChange"> & { name: string; defaultValue?: string | number | null }) {
  const [raw, setRaw] = useState(initialVnd(defaultValue));
  return <>
    <MoneyInput {...props} value={raw} onValueChange={setRaw} />
    <input type="hidden" name={name} value={raw} />
  </>;
}
