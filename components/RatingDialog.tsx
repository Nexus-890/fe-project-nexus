"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Star } from "lucide-react";
import type { ApiError } from "../types/commonResponseType";

type RatingDialogProps = {
  orderNumber: string;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onSubmit: (score: number, comment: string | null) => void;
};

const descriptions = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
const suggestions = ["Fast shipping", "As described", "Good communication", "Well packed"];

function RatingDialog({ orderNumber, pending, error, onClose, onSubmit }: RatingDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [scoreError, setScoreError] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const fieldScore = scoreError ? "Choose a rating from 1 to 5 stars." : error?.fieldErrors?.score?.join(" ");
  const fieldComment = error?.fieldErrors?.comment?.join(" ");

  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={(event) => {
    if (pending) event.preventDefault();
    else onClose();
  }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[480px] overflow-y-auto rounded-md border border-border bg-card p-0 text-foreground shadow-lg backdrop:bg-foreground/45">
    <form onSubmit={(event) => {
      event.preventDefault();
      if (pending) return;
      if (!score) { setScoreError(true); return; }
      onSubmit(score, comment.trim() || null);
    }}>
      <div className="space-y-5 p-5 sm:p-6">
        <div><h2 id={`${id}-title`} className="text-heading-20">Rate the seller</h2><p id={`${id}-description`} className="mt-2 text-sm leading-6 text-muted-foreground">How was your experience with order {orderNumber}?</p></div>
        <fieldset disabled={pending} aria-describedby={fieldScore ? `${id}-score-error` : undefined}>
          <legend className="sr-only">Your rating</legend>
          <div className="flex flex-wrap gap-1">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="relative cursor-pointer">
            <input type="radio" name={`${id}-score`} value={value} checked={score === value} onChange={() => { setScore(value); setScoreError(false); }} aria-label={`${value} ${value === 1 ? "star" : "stars"}`} className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
            <span className="flex size-11 items-center justify-center rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"><Star aria-hidden="true" className={`size-8 ${value <= score ? "fill-warning text-warning" : "text-border"}`} /></span>
          </label>)}</div>
          <p aria-live="polite" className="mt-2 min-h-5 text-sm font-medium">{score ? `${descriptions[score]} — ${score} out of 5` : "Select a star rating"}</p>
          {fieldScore && <p id={`${id}-score-error`} role="alert" className="mt-2 text-sm text-danger">{fieldScore}</p>}
        </fieldset>
        <div className="flex flex-wrap gap-2" aria-label="Review suggestions">{suggestions.map((suggestion) => {
          const phrase = `${suggestion}.`;
          const selected = comment.split("\n").includes(phrase);
          return <button type="button" key={suggestion} disabled={pending} aria-pressed={selected} onClick={() => setComment((current) => selected ? current.split("\n").filter((line) => line !== phrase).join("\n") : `${current}${current ? "\n" : ""}${phrase}`.slice(0, 1000))} className={`min-h-9 rounded-full border px-3 text-xs disabled:opacity-50 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>{suggestion}</button>;
        })}</div>
        <div><label htmlFor={`${id}-comment`} className="text-sm font-medium">Review (optional)</label><textarea id={`${id}-comment`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} disabled={pending} aria-invalid={!!fieldComment} aria-describedby={`${id}-count${fieldComment ? ` ${id}-comment-error` : ""}`} placeholder="Tell other buyers about your experience" className="mt-2 min-h-28 w-full resize-y rounded-sm border border-input bg-background p-3 text-sm" /><p id={`${id}-count`} className="mt-1 text-right text-xs text-muted-foreground">{comment.length}/1000</p>{fieldComment && <p id={`${id}-comment-error`} role="alert" className="mt-2 text-sm text-danger">{fieldComment}</p>}</div>
        <p className="text-xs leading-5 text-muted-foreground">You can rate each completed order once. Ratings update the seller’s public trust level.</p>
        {error && error.kind !== "aborted" && <p role="alert" className="break-words text-sm text-danger">{error.detail || error.title || "Unable to submit your rating. Please try again."}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/40 p-4">
        <button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-sm border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">Skip for Now</button>
        <button type="submit" disabled={pending} className="min-h-11 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">{pending ? "Submitting…" : "Submit Rating"}</button>
      </div>
    </form>
  </dialog>;
}

export default RatingDialog;
