"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Controller,
  useForm,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetError,
} from "react-hook-form";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/checkbox";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { Separator } from "@/components/separator";
import Logo from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import type { ApiError } from "@/types/commonResponseType";
import { signInSchema, type SignInFormValues } from "./signInSchema";

const defaultValues: SignInFormValues = {
  email: "",
  password: "",
  rememberMe: true,
};

function mapServerErrors(
  error: ApiError,
  setError: UseFormSetError<SignInFormValues>,
): string {
  const fieldErrors = error.fieldErrors ?? {};
  let mapped = false;
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (field !== "email" && field !== "password") continue;
    mapped = true;
    setError(field, { type: "server", message: messages.join(" ") });
  }

  if (error.status === 401) return "Email or password is incorrect";
  return mapped
    ? ""
    : error.detail || error.title || "Unable to sign in. Please try again.";
}

function TextField({
  name,
  label,
  type,
  register,
  errors,
  autoComplete,
}: {
  name: "email" | "password";
  label: string;
  type: "email" | "password";
  register: UseFormRegister<SignInFormValues>;
  errors: FieldErrors<SignInFormValues>;
  autoComplete: string;
}) {
  const error = errors[name];
  return (
    <Label
      className="block min-w-0 text-sm font-normal leading-5 text-foreground"
      htmlFor={name}
    >
      <span className="mb-1 block">{label}</span>
      <Input
        id={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        {...register(name)}
        className="h-11 rounded-md px-3 text-sm"
      />
      {error?.message ? (
        <p
          id={`${name}-error`}
          role="alert"
          className="mt-1 text-xs leading-4 text-danger"
        >
          {String(error.message)}
        </p>
      ) : null}
    </Label>
  );
}

function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues,
    mode: "onBlur",
  });

  async function submit(values: SignInFormValues) {
    setFormError(null);
    const result = await signIn({
      email: values.email.trim(),
      password: values.password,
    });
    if (!result.ok) {
      const message = mapServerErrors(result.error, setError);
      setFormError(message || null);
      return;
    }
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-white text-foreground">
      <header className="mx-auto flex w-full max-w-[400px] justify-start px-6 py-6 sm:px-10">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-[400px] flex-col px-6 pb-10 sm:px-10">
        <section aria-labelledby="sign-in-title" className="w-full">
          <h1 id="sign-in-title" className="text-heading-32 text-left">
            Sign in
          </h1>

          {formError ? (
            <p
              role="alert"
              className="mt-5 rounded-md border border-danger/40 bg-red-100 px-3 py-2 text-sm text-danger"
            >
              {formError}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-4 h-11 w-full gap-2 rounded-md bg-card px-4 text-sm"
          >
            <span aria-hidden="true" className="font-bold text-blue-600">
              G
            </span>
            Continue with Google
          </Button>
          <div
            className="my-4 flex items-center gap-3 text-xs text-muted-foreground"
            aria-hidden="true"
          >
            <Separator className="flex-1" />
            <span>or</span>
            <Separator className="flex-1" />
          </div>

          <form
            noValidate
            onSubmit={handleSubmit(submit)}
            className="space-y-3"
          >
            <TextField
              name="email"
              label="Email"
              type="email"
              register={register}
              errors={errors}
              autoComplete="email"
            />
            <div className="relative">
              <TextField
                name="password"
                label="Password"
                type="password"
                register={register}
                errors={errors}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-0 top-0 text-xs text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Label
              className="flex min-h-11 items-start gap-2 text-sm font-normal leading-5 text-foreground"
              htmlFor="rememberMe"
            >
              <Controller
                name="rememberMe"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="rememberMe"
                    checked={field.value}
                    onBlur={field.onBlur}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                    className="mt-1"
                  />
                )}
              />
              <span>Keep me signed in on this device</span>
            </Label>

            <Button
              type="submit"
              disabled={isSubmitting}
              size="lg"
              className="h-11 w-full rounded-md px-4 text-sm font-semibold"
            >
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-primary hover:underline">
              Sign Up
            </Link>
          </p>
        </section>
      </main>
      <footer className="mx-auto w-full max-w-[400px] px-6 pb-6 text-xs text-muted-foreground sm:px-10">
        © 2026 Nexus · Terms · Privacy
      </footer>
    </div>
  );
}

export default SignInPage;
