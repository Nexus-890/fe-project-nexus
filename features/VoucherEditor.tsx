"use client";

import { useState } from "react";
import { AdminError } from "../components/AdminPrimitives";
import { PromotionField, PromotionPanel, PromotionSection, PromotionSelect, formDate, formText, localDateTime } from "../components/PromotionFields";
import { sellerButton, sellerPrimary } from "../components/SellerUi";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { saveVoucher, setVoucherProducts } from "../service/promotionService";
import type { ManagedVoucher, VoucherWrite } from "../types/promotionType";
import { useAdminAction } from "./useAdminAction";
import VoucherProductChoices from "./VoucherProductChoices";

const sourceLabels = { SHOP: "Shop voucher", PLATFORM: "Platform voucher", EVENT: "Event voucher" };
const fundingLabels = { PLATFORM: "Platform pays", SELLER: "Seller pays", CO_FUNDED: "Co-funded" };
const discountLabels = { FIXED: "Fixed amount", PERCENT: "Percentage" };
const scopeLabels = { ALL: "All products", SELECTED: "Selected products" };

function VoucherEditor({ value, admin, close, saved }: { value?: ManagedVoucher; admin: boolean; close: () => void; saved: (value: ManagedVoucher) => void }) {
  const auth = useAuth(); const voucher = value?.voucher;
  const [source, setSource] = useState(voucher?.sourceType ?? (admin ? "PLATFORM" : "SHOP"));
  const [discount, setDiscount] = useState(voucher?.discountType ?? "FIXED"); const [scope, setScope] = useState(voucher?.productScope ?? "ALL");
  const [funding, setFunding] = useState(voucher?.fundingType ?? (admin ? "PLATFORM" : "SELLER"));
  const [validation, setValidation] = useState("");
  const [productText, setProductText] = useState(value?.productIds.join("\n") ?? "");
  const save = useAdminAction((input: VoucherWrite, options) => saveVoucher(voucher?.id, input, options), [queryKeys.promotions.root(auth.sessionId)], saved);
  const locked = save.isPending || voucher?.status !== undefined && voucher.status !== "DRAFT";
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
    }}><fieldset disabled={locked} className="space-y-6">
      <PromotionSection title="Basic information">
        <PromotionField name="code" label="Voucher code" required value={voucher?.code} pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,49}" />
        <PromotionField name="name" label="Voucher name" required value={voucher?.name} />
        <PromotionSelect name="sourceType" label="Source" className="" value={source} values={admin ? ["PLATFORM", "EVENT"] : ["SHOP"]} labels={sourceLabels} disabled={Boolean(voucher)} onChange={(v) => setSource(v as typeof source)} />
        {source === "EVENT" ? <PromotionField name="eventId" label="Event ID" required value={voucher?.eventId} pattern="[0-9a-fA-F-]{36}" /> : <span className="hidden sm:block" />}
        {source === "EVENT" && <><PromotionSelect name="fundingType" label="Funding" className="" value={funding} values={["PLATFORM", "SELLER", "CO_FUNDED"]} labels={fundingLabels} onChange={(v) => setFunding(v as typeof funding)} />{funding === "CO_FUNDED" ? <PromotionField name="sellerFundingPercent" label="Seller funding (%)" type="number" required min={0.01} max={99.99} step="0.01" value={voucher?.sellerFundingPercent} /> : <span className="hidden sm:block" />}</>}
        <PromotionField name="description" label="Description" className="sm:col-span-2" value={voucher?.description} />
      </PromotionSection>
      <PromotionSection title="Discount">
        <PromotionSelect name="discountType" label="Discount type" className="" value={discount} values={["FIXED", "PERCENT"]} labels={discountLabels} onChange={(v) => setDiscount(v as typeof discount)} />
        {discount === "PERCENT" ? <PromotionField key="percent" name="discountValue" label="Discount (%)" type="number" required min={1} max={100} step="0.01" value={voucher?.discountValue} /> : <PromotionField key="fixed" name="discountValue" label="Discount (VND)" required money value={voucher?.discountValue} />}
        <PromotionField name="minOrderAmount" label="Minimum order (VND)" money value={voucher?.minOrderAmount} />
        <PromotionField name="maxDiscountAmount" label="Maximum discount (VND, optional)" money value={voucher?.maxDiscountAmount} />
        <PromotionSelect name="productScope" label="Product scope" className="" value={scope} values={["ALL", "SELECTED"]} labels={scopeLabels} onChange={(v) => setScope(v as typeof scope)} />
      </PromotionSection>
      <PromotionSection title="Limits" hint="Leave empty for no limit.">
        <PromotionField name="claimLimit" label="Claim limit (optional)" type="number" min={1} step="1" value={voucher?.claimLimit} />
        <PromotionField name="usageLimit" label="Usage limit (optional)" type="number" min={1} step="1" value={voucher?.usageLimit} />
        <PromotionField name="discountBudget" label="Discount budget (VND, optional)" money value={voucher?.discountBudget} />
      </PromotionSection>
      <PromotionSection title="Schedule" hint="Times use your local timezone. Claiming must close before the voucher expires.">
        {(["claimStartAt", "claimEndAt", "validFrom", "validUntil"] as const).map((key, i) => <PromotionField key={key} name={key} label={["Claims open", "Claims close", "Valid from", "Valid until"][i]} required type="datetime-local" value={localDateTime(voucher?.[key])} />)}
      </PromotionSection>
      <PromotionSection title="Terms">
        <textarea name="termsText" aria-label="Terms" defaultValue={voucher?.termsText ?? ""} className="min-h-24 rounded-sm border border-border p-3 text-sm sm:col-span-2" />
      </PromotionSection>
    </fieldset>
    {validation && <p role="alert" className="text-sm text-danger">{validation}</p>}<AdminError error={save.error} />
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
      {scope === "SELECTED" && !voucher && <p className="mr-auto text-xs text-muted-foreground">Save the draft first, then pick products.</p>}
      <button type="button" className={sellerButton} onClick={close}>Close editor</button>
      <button className={sellerPrimary} disabled={locked}>Save voucher</button>
    </div></form>
    {voucher?.status === "DRAFT" && voucher.productScope === "SELECTED" && <form className="space-y-3 border-t border-border pt-5" onSubmit={(e) => { e.preventDefault(); products.run([...new Set(productText.split(/[\s,]+/).filter(Boolean))]); }}>
      <fieldset disabled={products.isPending}><VoucherProductChoices admin={admin} selected={productText.split(/[\s,]+/).filter(Boolean)} onChange={(ids) => setProductText(ids.join("\n"))} /></fieldset>
      
      <p className="text-xs text-muted-foreground">Only published products are listed. Select up to 500.</p><AdminError error={products.error?.status === 404 ? { ...products.error, detail: "One of the selected products is not published or no longer exists. Publish it first, then try again." } : products.error} /><button className={sellerPrimary} disabled={products.isPending}>Save products</button>
    </form>}
  </PromotionPanel>;
}
export default VoucherEditor;
