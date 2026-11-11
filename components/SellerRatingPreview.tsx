"use client";

import { useRef, useState } from "react";
import { Star, X } from "lucide-react";

const tags = ["Fast shipping", "As described", "Good communication", "Well packed"];

function SellerRatingPreview({ orderNumber }: { orderNumber: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);
  return <>
    <button type="button" className="min-h-11 rounded-sm border border-border px-4 text-sm font-medium hover:bg-muted" onClick={() => dialog.current?.showModal()}>Preview seller rating</button>
    <dialog ref={dialog} aria-label="Rate your seller" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-md border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-foreground/40">
      <form onSubmit={(event) => { event.preventDefault(); setReviewed(true); }} className="p-6">
        <div className="flex items-start justify-between gap-4"><h2 id="rating-title" className="text-heading-24">Rate your seller</h2><button type="button" aria-label="Close rating preview" onClick={() => dialog.current?.close()} className="flex size-9 shrink-0 items-center justify-center rounded-sm hover:bg-muted"><X size={18} aria-hidden="true" /></button></div>
        <p className="mt-2 break-words text-sm text-muted-foreground">How was your experience with order {orderNumber}?</p>
        <p className="mt-4 rounded-sm bg-muted p-3 text-xs leading-5"><strong>Sample preview.</strong> Rating submission is unavailable. No rating or reputation will be saved.</p>
        <fieldset className="mt-5"><legend className="text-sm font-medium">Choose a rating</legend><div className="mt-2 flex flex-wrap gap-1">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"><input className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="radio" name="rating" value={value} checked={rating === value} onChange={() => { setRating(value); setReviewed(false); }} aria-label={`${value} ${value === 1 ? "star" : "stars"}`} required /><Star className={`pointer-events-none size-8 ${value <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`} aria-hidden="true" /></label>)}</div></fieldset>
        <p className="mt-1 text-sm font-medium">{rating ? `${rating} out of 5` : "Select 1–5 stars"}</p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Rating tags">{tags.map((tag) => <button key={tag} type="button" aria-pressed={selectedTags.includes(tag)} onClick={() => { setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]); setReviewed(false); }} className={`min-h-9 rounded-full border px-3 text-xs ${selectedTags.includes(tag) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>{tag}</button>)}</div>
        <label htmlFor="rating-comment" className="mt-5 block text-sm font-medium">Your review (optional)</label><textarea id="rating-comment" maxLength={1000} value={comment} onChange={(event) => { setComment(event.target.value); setReviewed(false); }} className="mt-2 min-h-28 w-full rounded-sm border border-input bg-background p-3 text-sm" placeholder="Tell us about your experience" />
        <p className="mt-3 text-xs leading-5 text-muted-foreground">This preview does not check completed-order eligibility or one-rating-per-transaction rules. Those require the rating API.</p>
        {reviewed && <p role="status" className="mt-4 text-sm text-success">Preview reviewed: {rating} out of 5. Nothing was submitted.</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-sm border border-border px-4 text-sm">Skip for Now</button><button type="submit" disabled={!rating} className="min-h-11 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">Review sample rating</button></div>
      </form>
    </dialog>
  </>;
}

export default SellerRatingPreview;
