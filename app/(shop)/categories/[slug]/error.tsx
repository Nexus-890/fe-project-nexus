"use client";

import { useTransition } from "react";

function Error({ retry }: { retry: () => void }) {
  const [retrying, startTransition] = useTransition();

  return <section role="alert" className="mx-auto w-full max-w-[1248px] space-y-4 px-4 py-12 sm:px-6">
    <h1 className="text-heading-24">Unable to load this category</h1>
    <p>Please try again when the catalog service is available.</p>
    <button type="button" onClick={() => startTransition(retry)} disabled={retrying}
      className="min-h-11 min-w-11 rounded-sm border border-border px-4 hover:bg-muted disabled:cursor-wait disabled:text-muted-foreground">
      {retrying ? "Retrying…" : "Retry category"}
    </button>
  </section>;
}

export default Error;
