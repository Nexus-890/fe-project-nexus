"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Store } from "lucide-react";
import { Button, buttonVariants } from "@/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { Textarea } from "@/components/textarea";
import { createCanceledError } from "@/configs/api";
import { queryKeys } from "@/configs/queryKeys";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { getSellerApplication, submitSellerApplication } from "@/service/sellerApplicationService";
import { readBackofficeRoles } from "@/features/backofficeAccess";
import { sellerApplicationSchema, type SellerApplicationFormValues } from "@/features/sellerApplicationSchema";
import type { AuthContextValue } from "@/types/authType";
import type { SellerApplication, SellerApplicationInput } from "@/types/sellerApplicationType";

type SubmitOperation = { body: SellerApplicationInput; sessionId: number; controller: AbortController };

function SellerApplicationContent({ auth }: { auth: AuthContextValue }) {
  const queryClient = useQueryClient();
  const pending = useRef<AbortController | null>(null);
  const { sessionId, isSessionCurrent, requestContext } = auth;
  const key = queryKeys.account.sellerApplication(sessionId);
  const seller = readBackofficeRoles(auth.accessToken).includes("SELLER");
  const application = useApiQuery({
    queryKey: key,
    meta: { requiresAuth: true },
    service: async (signal) => {
      if (!isSessionCurrent(sessionId)) throw createCanceledError();
      const result = await getSellerApplication({ context: requestContext, signal });
      if (!isSessionCurrent(sessionId)) throw createCanceledError();
      return result;
    },
  }, { enabled: !seller });
  const form = useForm<SellerApplicationFormValues>({
    resolver: zodResolver(sellerApplicationSchema),
    defaultValues: { shopName: "", description: "" },
    mode: "onBlur",
  });
  const submit = useApiMutation<SellerApplication, SubmitOperation>({
    mutationKey: ["account", sessionId, "seller-application", "submit"],
    execute: ({ body, controller }) => submitSellerApplication(body, { context: requestContext, signal: controller.signal }),
    isCurrent: (operation) => isSessionCurrent(operation.sessionId) && !operation.controller.signal.aborted,
  }, {
    onSuccess: (data) => { queryClient.setQueryData(key, data); form.reset(); },
    onError: (error, operation) => {
      if (!isSessionCurrent(operation.sessionId) || operation.controller.signal.aborted || error.kind === "aborted") return;
      for (const field of ["shopName", "description"] as const) {
        const messages = error.fieldErrors?.[field];
        if (messages?.length) form.setError(field, { type: "server", message: messages.join(" ") });
      }
      // An application submitted from another tab must replace the form after 409.
      if (error.status === 409) void application.refetch();
    },
  });

  useEffect(() => () => pending.current?.abort(), []);

  function send(values: SellerApplicationFormValues) {
    if (!isSessionCurrent(sessionId) || submit.isPending || application.isFetching) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    submit.mutate({ body: values, sessionId, controller });
  }

  const data = application.data;
  const approved = seller || data?.status === "APPROVED";
  const rejected = data?.status === "REJECTED";
  const busy = submit.isPending || application.isFetching;

  return (
    <div className="min-w-0 space-y-6 pb-12 sm:pb-16">
      <div className="space-y-2">
        <h1 className="text-heading-32">Become a seller</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Start selling on Nexus. Tell us about your shop and track your application here.</p>
      </div>
      {approved ? (
        <Card className="rounded-md">
          <CardHeader><CheckCircle2 className="mb-2 size-8 text-success" aria-hidden="true" /><CardTitle>Your seller account is ready</CardTitle>
            <CardDescription>{seller ? "Manage your products and sales in the seller back office." : "Your application has been approved. Sign in again to activate your seller access."}</CardDescription>
          </CardHeader>
          <CardContent>
            {seller ? <Link href="/backoffice" className={`${buttonVariants()} min-h-11 px-4`}>Open seller back office<ArrowRight aria-hidden="true" /></Link> :
              <Button className="min-h-11 px-4" onClick={() => void auth.signIn("/backoffice")}>Sign in again<ArrowRight aria-hidden="true" /></Button>}
          </CardContent>
        </Card>
      ) : application.isPending ? (
        <Card className="rounded-md"><CardContent><p role="status" className="text-sm text-muted-foreground">Loading your application…</p></CardContent></Card>
      ) : application.error ? (
        <Card className="rounded-md"><CardContent className="space-y-4">
          <div role="alert" className="space-y-2"><AlertCircle className="size-6 text-danger" aria-hidden="true" /><h2 className="font-semibold">Unable to load your application</h2><p className="break-words text-sm text-muted-foreground">{application.error.detail || "Please try again in a moment."}</p></div>
          <Button variant="outline" className="min-h-11 px-4" disabled={application.isFetching} onClick={() => void application.refetch()}>Retry application</Button>
        </CardContent></Card>
      ) : data?.status === "PENDING" ? (
        <Card className="rounded-md">
          <CardHeader><div className="mb-2 flex flex-wrap items-center gap-3"><Clock3 className="size-8 text-warning" aria-hidden="true" /><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">Pending review</span></div><CardTitle>We’re reviewing your application</CardTitle><CardDescription>Our team will review your shop details. You can check the status here.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <dl className="space-y-4 text-sm"><div><dt className="text-muted-foreground">Shop name</dt><dd className="mt-1 break-words font-medium">{data.shopName}</dd></div><div><dt className="text-muted-foreground">About your shop</dt><dd className="mt-1 whitespace-pre-wrap break-words">{data.description}</dd></div></dl>
            <Button variant="outline" className="min-h-11 px-4" disabled={application.isFetching} onClick={() => void application.refetch()}>{application.isFetching ? "Checking…" : "Check status"}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {rejected && <Card className="rounded-md border-danger/30"><CardContent className="space-y-3" role="status"><div className="flex items-center gap-2 font-semibold"><AlertCircle className="size-5 text-danger" aria-hidden="true" />Your application needs changes</div><p className="whitespace-pre-wrap break-words text-sm">{data.rejectionReason}</p><p className="text-sm text-muted-foreground">Review the feedback and submit a new application below.</p></CardContent></Card>}
          <Card className="rounded-md">
            <CardHeader><div className="mb-2 flex size-12 items-center justify-center rounded-md bg-muted"><Store className="size-6 text-primary" aria-hidden="true" /></div><CardTitle>{rejected ? "Apply again" : "Tell us about your shop"}</CardTitle><CardDescription>Your application is reviewed before seller access is enabled.</CardDescription></CardHeader>
            <CardContent>
              <form noValidate className="space-y-5" aria-label="Seller application" onSubmit={(event) => void form.handleSubmit(send)(event)}>
                <fieldset disabled={busy} className="space-y-5">
                  <legend className="sr-only">Shop details</legend>
                  <div className="space-y-1.5"><Label htmlFor="seller-shop-name">Shop name</Label><Input id="seller-shop-name" className="h-11 px-3" maxLength={150} autoComplete="organization" aria-invalid={Boolean(form.formState.errors.shopName)} aria-describedby={form.formState.errors.shopName ? "seller-shop-name-error" : undefined} {...form.register("shopName")} />
                    {form.formState.errors.shopName && <p id="seller-shop-name-error" className="text-xs text-danger" role="alert">{form.formState.errors.shopName.message}</p>}
                  </div>
                  <div className="space-y-1.5"><Label htmlFor="seller-description">About your shop</Label><Textarea id="seller-description" rows={5} maxLength={1000} placeholder="What would you like to sell on Nexus?" aria-invalid={Boolean(form.formState.errors.description)} aria-describedby={`seller-description-help${form.formState.errors.description ? " seller-description-error" : ""}`} {...form.register("description")} />
                    <p id="seller-description-help" className="text-xs text-muted-foreground">Describe your products and your shop in 10–1,000 characters.</p>
                    {form.formState.errors.description && <p id="seller-description-error" className="text-xs text-danger" role="alert">{form.formState.errors.description.message}</p>}
                  </div>
                  <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">You can continue shopping while your application is being reviewed.</div>
                  <Button type="submit" className="min-h-11 w-full px-5 sm:w-auto">{submit.isPending ? "Submitting…" : rejected ? "Submit new application" : "Submit application"}</Button>
                </fieldset>
              </form>
            </CardContent>
          </Card>
        </>
      )}
      {submit.error && submit.error.kind !== "aborted" && <p role="alert" className="break-words rounded-md border border-danger/30 bg-card p-4 text-sm text-danger">{submit.error.status === 409 ? "An application already exists. Its latest status is shown above. Refresh the status if it could not be loaded." : submit.error.detail || "Unable to submit your application. Please try again."}</p>}
    </div>
  );
}

function SellerApplicationPage() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === "anonymous") router.replace("/sign-in?returnTo=%2Fbecome-a-seller");
  }, [auth.status, router]);
  if (auth.status === "error") return <Card className="rounded-md"><CardContent className="space-y-4"><p role="alert" className="text-sm text-danger">Unable to load your account. Please retry before opening your seller application.</p><Button variant="outline" className="min-h-11 px-4" onClick={() => void auth.retryProfile()}>Retry account</Button></CardContent></Card>;
  if (auth.status !== "authenticated") return <p role="status" className="py-8 text-sm text-muted-foreground">Loading your account…</p>;
  return <SellerApplicationContent key={auth.sessionId} auth={auth} />;
}

export default SellerApplicationPage;
