"use client";

import { Download } from "lucide-react";
import { useApiMutation } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getOrderInvoice, invoiceFileName } from "../service/orderService";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-5 text-sm font-medium hover:bg-secondary disabled:opacity-50";

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function OrderInvoiceButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const auth = useAuth();
  const download = useApiMutation({
    execute: async (sessionId: number) => ({ sessionId, blob: await getOrderInvoice(orderId, { context: auth.requestContext }) }),
  }, {
    onSuccess: ({ sessionId, blob }) => { if (auth.isSessionCurrent(sessionId)) saveFile(blob, invoiceFileName(orderNumber)); },
  });
  return <div className="grid gap-2">
    <button type="button" className={buttonClass} disabled={download.isPending} onClick={() => { download.reset(); download.mutate(auth.sessionId); }}>
      <Download size={16} aria-hidden="true" />{download.isPending ? "Preparing invoice…" : "Download invoice"}
    </button>
    {download.isSuccess && <p role="status" className="text-xs text-muted-foreground">Invoice downloaded.</p>}
    {download.error && <p role="alert" className="max-w-xs text-xs text-danger">{download.error.status === 409 ? "The invoice is available once the order is completed." : download.error.detail || download.error.title || "Unable to download the invoice."}</p>}
  </div>;
}

export default OrderInvoiceButton;
