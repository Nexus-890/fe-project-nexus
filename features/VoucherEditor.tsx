"use client";

import { useState } from "react";
import { AdminError } from "../components/AdminPrimitives";
import { PromotionField, PromotionPanel, PromotionSelect, formDate, formText, localDateTime } from "../components/PromotionFields";
import { sellerButton, sellerPrimary } from "../components/SellerUi";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { saveVoucher, setVoucherProducts } from "../service/promotionService";
import type { ManagedVoucher, VoucherWrite } from "../types/promotionType";
import { useAdminAction } from "./useAdminAction";
import VoucherProductChoices from "./VoucherProductChoices";

function VoucherEditor({ value, admin, close, saved }: { value?: ManagedVoucher; admin: boolean; close: () => void; saved: (value: ManagedVoucher) => void }) {
  const auth = useAuth(); const voucher = value?.voucher;
  const [source, setSource] = useState(voucher?.sourceType ?? (admin ? "PLATFORM" : "SHOP"));
  const [discount, setDiscount] = useState(voucher?.discountType ?? "FIXED"); const [scope, setScope] = useState(voucher?.productScope ?? "ALL");
  const [funding, setFunding] = useState(voucher?.fundingType ?? (admin ? "PLATFORM" : "SELLER"));
  const [validation, setValidation] = useState("");
  const [productText, setProductText] = useState(value?.productIds.join("\n") ?? "");
  const save = useAdminAction((input: VoucherWrite, options) => saveVoucher(voucher?.id, input, options), [queryKeys.promotions.root(auth.sessionId)], saved);
  const products = useAdminAction((ids: string[], options) => setVoucherProducts(voucher!.id, ids, options), [queryKeys.promotions.root(auth.sessionId)], saved);
  return <PromotionPanel title={voucher ? `Edit ${voucher.code}` : "New voucher"}>
    <form className="space-y-5" onSubmit={(e) => {
      e.preventDefault(); const data = new FormData(e.currentTarget); const number = (key: string) => formText(data, key) ? Number(formText(data, key)) : null;
      const input: VoucherWrite = { code: formText(data, "code").toUpperCase(), name: formText(data, "name"), description: formText(data, "description"), sourceType: source, eventId: source === "EVENT" ? formText(data, "eventId") : null,
        discountType: discount, discountValue: number("discountValue")!, minOrderAmount: number("minOrderAmount"), maxDiscountAmount: number("maxDiscountAmount"), fundingType: source === "SHOP" ? "SELLER" : source === "PLATFORM" ? "PLATFORM" : funding,
        sellerFundingPercent: source === "SHOP" ? 100 : source === "PLATFORM" ? 0 : funding === "CO_FUNDED" ? number("sellerFundingPercent") : funding === "SELLER" ? 100 : 0,
        productScope: scope, claimLimit: number("claimLimit"), usageLimit: number("usageLimit"), discountBudget: number("discountBudget"),
        claimStartAt: formDate(data, "claimStartAt"), claimEndAt: formDate(data, "claimEndAt"), validFrom: formDate(data, "validFrom"), validUntil: formDate(data, "validUntil"), termsText: formText(data, "termsText") };
      if (!(input.claimStartAt < input.claimEndAt && input.validFrom < input.validUntil && input.claimEndAt <= input.validUntil)) { setValidation("Check the claim and validity dates. Claiming must end before expiry."); return; }
      setValidation(""); save.run(input);
    }}><fieldset disabled={save.isPending || voucher?.status !== undefined && voucher.status !== "DRAFT"} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <PromotionField name="code" label="Voucher code" required value={voucher?.code} pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,49}" />
      <PromotionField name="name" label="Voucher name" required value={voucher?.name} />
      <PromotionSelect name="sourceType" label="Source" value={source} values={admin ? ["PLATFORM", "EVENT"] : ["SHOP"]} disabled={Boolean(voucher)} onChange={(v) => setSource(v as typeof source)} />
      {source === "EVENT" && <PromotionField name="eventId" label="Event ID" required value={voucher?.eventId} pattern="[0-9a-fA-F-]{36}" />}
      <PromotionField name="description" label="Description" value={voucher?.description} />
      <PromotionSelect name="discountType" label="Discount type" value={discount} values={["FIXED", "PERCENT"]} onChange={(v) => setDiscount(v as typeof discount)} />
      <PromotionField name="discountValue" label={discount === "PERCENT" ? "Discount (%)" : "Discount (VND)"} type="number" required min={discount === "PERCENT" ? 1 : 0.01} max={discount === "PERCENT" ? 100 : undefined} step="0.01" value={voucher?.discountValue} />
      <PromotionField name="minOrderAmount" label="Minimum order (VND)" type="number" min={0} step="0.01" value={voucher?.minOrderAmount} />
      <PromotionField name="maxDiscountAmount" label="Maximum discount (VND, optional)" type="number" min={0} step="0.01" value={voucher?.maxDiscountAmount} />
      {source === "EVENT" && <><PromotionSelect name="fundingType" label="Funding" value={funding} values={["PLATFORM", "SELLER", "CO_FUNDED"]} onChange={(v) => setFunding(v as typeof funding)} />{funding === "CO_FUNDED" && <PromotionField name="sellerFundingPercent" label="Seller funding (%)" type="number" required min={0.01} max={99.99} step="0.01" value={voucher?.sellerFundingPercent} />}</>}
      <PromotionSelect name="productScope" label="Product scope" value={scope} values={["ALL", "SELECTED"]} onChange={(v) => setScope(v as typeof scope)} />
      <PromotionField name="claimLimit" label="Claim limit (optional)" type="number" min={1} step="1" value={voucher?.claimLimit} />
      <PromotionField name="usageLimit" label="Usage limit (optional)" type="number" min={1} step="1" value={voucher?.usageLimit} />
      <PromotionField name="discountBudget" label="Discount budget (VND, optional)" type="number" min={0} step="0.01" value={voucher?.discountBudget} />
      {(["claimStartAt", "claimEndAt", "validFrom", "validUntil"] as const).map((key, i) => <PromotionField key={key} name={key} label={["Claims open", "Claims close", "Valid from", "Valid until"][i]} required type="datetime-local" value={localDateTime(voucher?.[key])} />)}
      <label className="grid gap-2 text-sm sm:col-span-2">Terms<textarea name="termsText" defaultValue={voucher?.termsText ?? ""} className="min-h-24 rounded-sm border border-border p-3" /></label>
      <button className={sellerPrimary} disabled={save.isPending}>Save voucher</button>
    </fieldset><p className="text-xs text-muted-foreground">Times use your local timezone. Leave optional limits empty for no limit. Save a draft before selecting products.</p>
    {validation && <p role="alert" className="text-sm text-danger">{validation}</p>}<AdminError error={save.error} /></form>
    {voucher?.status === "DRAFT" && voucher.productScope === "SELECTED" && <form className="space-y-3 border-t border-border pt-5" onSubmit={(e) => { e.preventDefault(); products.run([...new Set(formText(new FormData(e.currentTarget), "productIds").split(/[\s,]+/).filter(Boolean))]); }}>
      <fieldset disabled={products.isPending}><VoucherProductChoices admin={admin} selected={productText.split(/[\s,]+/).filter(Boolean)} onChange={(ids) => setProductText(ids.join("\n"))} /></fieldset>
      <details><summary className="min-h-11 cursor-pointer text-sm text-primary">Enter product IDs manually</summary><label className="grid gap-2 text-sm">Product IDs (one per line or comma separated)<textarea name="productIds" className="min-h-24 rounded-sm border border-border p-3 font-mono" value={productText} onChange={(e) => setProductText(e.target.value)} /></label></details>
      <p className="text-xs text-muted-foreground">Select up to 500 products. Shop vouchers accept only products you own.</p><AdminError error={products.error} /><button className={sellerPrimary} disabled={products.isPending}>Save products</button>
    </form>}
    <button className={sellerButton} onClick={close}>Close editor</button>
  </PromotionPanel>;
}
export default VoucherEditor;
