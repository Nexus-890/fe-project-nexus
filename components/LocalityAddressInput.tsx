"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/useApi";
import { queryKeys } from "@/configs/queryKeys";
import { getPublicProvinces, getPublicWards } from "@/service/checkoutService";

type LocalityAddressInputProps = {
  idPrefix: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  controlClassName: string;
  onChange: (address: string | null) => void;
};

export const composeAddress = (street: string, ward?: string, province?: string): string | null => {
  const line = street.trim();
  return line && ward && province ? `${line}, ${ward}, ${province}` : null;
};

export function LocalityAddressInput({ idPrefix, invalid, describedBy, disabled, controlClassName, onChange }: LocalityAddressInputProps) {
  const [street, setStreet] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [wardCode, setWardCode] = useState("");
  const provinces = useApiQuery({ queryKey: queryKeys.shipping.provinces(), service: (signal) => getPublicProvinces({ signal }) },
    { staleTime: Infinity });
  const wards = useApiQuery({ queryKey: queryKeys.shipping.wards(provinceCode), service: (signal) => getPublicWards(provinceCode, { signal }) },
    { enabled: Boolean(provinceCode), staleTime: Infinity });

  const nameOf = (list: { code: string; name: string }[] | undefined, code: string) => list?.find((item) => item.code === code)?.name;
  const emit = (nextStreet: string, nextProvince: string, nextWard: string) =>
    onChange(composeAddress(nextStreet, nameOf(wards.data, nextWard), nameOf(provinces.data, nextProvince)));

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <select id={`${idPrefix}-province`} aria-label="Province or city" value={provinceCode} disabled={disabled || provinces.isPending || provinces.isError}
        aria-invalid={invalid || undefined} aria-describedby={describedBy} className={controlClassName}
        onChange={(event) => { setProvinceCode(event.target.value); setWardCode(""); onChange(null); }}>
        <option value="">{provinces.isPending ? "Loading provinces..." : provinces.isError ? "Provinces unavailable" : "Province / City"}</option>
        {provinces.data?.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
      </select>
      <select id={`${idPrefix}-ward`} aria-label="Ward or commune" value={wardCode} disabled={disabled || !provinceCode || wards.isPending || wards.isError}
        aria-invalid={invalid || undefined} aria-describedby={describedBy} className={controlClassName}
        onChange={(event) => { setWardCode(event.target.value); emit(street, provinceCode, event.target.value); }}>
        <option value="">{provinceCode && wards.isPending ? "Loading wards..." : wards.isError ? "Wards unavailable" : "Ward / Commune"}</option>
        {wards.data?.map((ward) => <option key={ward.code} value={ward.code}>{ward.name}</option>)}
      </select>
      <input id={`${idPrefix}-street`} aria-label="House number and street" value={street} maxLength={300} disabled={disabled}
        autoComplete="address-line1" placeholder="House number and street" aria-invalid={invalid || undefined} aria-describedby={describedBy}
        className={`${controlClassName} sm:col-span-2`}
        onChange={(event) => { setStreet(event.target.value); emit(event.target.value, provinceCode, wardCode); }} />
    </div>
  );
}
