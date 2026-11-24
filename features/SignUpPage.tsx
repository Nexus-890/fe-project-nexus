"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Controller,
  useForm,
  type DefaultValues,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetError,
} from "react-hook-form";
import { Input } from "@/components/input";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/checkbox";
import { Label } from "@/components/label";
import { Separator } from "@/components/separator";
import Logo from "@/components/Logo";
import { LocalityAddressInput } from "@/components/LocalityAddressInput";
import { useAuth } from "@/hooks/useAuth";
import { ACCOUNT_EXTENSIONS_ENABLED } from "@/configs/account";
import type { ApiError } from "@/types/commonResponseType";
import type { SignUpRequest } from "@/types/authRequestType";
import { signUpSchema, type SignUpFormValues } from "./signUpSchema";

const defaultValues: DefaultValues<SignUpFormValues> = {
  fullName: "",
  email: "",
  phone: "",
  identityNumber: "",
  dateOfBirth: "",
  address: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
};

type FormField = keyof SignUpFormValues;

function FieldError({
  error,
}: {
  error: FieldErrors<SignUpFormValues>[FormField];
}) {
  if (!error?.message) return null;
  return (
    <p role="alert" className="mt-1 text-xs leading-4 text-danger">
      {String(error.message)}
    </p>
  );
}

function TextField({
  name,
  label,
  type = "text",
  placeholder,
  register,
  errors,
  autoComplete,
}: {
  name: Exclude<FormField, "gender" | "termsAccepted">;
  label: string;
  type?: string;
  placeholder?: string;
  register: UseFormRegister<SignUpFormValues>;
  errors: FieldErrors<SignUpFormValues>;
  autoComplete?: string;
}) {
  const error = errors[name];
  return (
    <Label
      className="block min-w-0 text-xs font-normal leading-4 text-foreground"
      htmlFor={name}
    >
      <span className="mb-1.5 block">{label}</span>
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        {...register(name)}
        className="h-12 rounded-md px-3 text-sm"
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

function serverErrorField(field: string): FormField | undefined {
  const names: Record<string, FormField> = {
    fullName: "fullName",
    full_name: "fullName",
    email: "email",
    phone: "phone",
    identityNumber: "identityNumber",
    identity_number: "identityNumber",
    gender: "gender",
    dateOfBirth: "dateOfBirth",
    date_of_birth: "dateOfBirth",
    address: "address",
    password: "password",
  };
  return names[field] ?? names[field.split(".").at(-1) ?? ""];
}

function mapServerError(
  error: ApiError,
  setError: UseFormSetError<SignUpFormValues>,
): string | null {
  let mapped = false;
  for (const [field, messages] of Object.entries(error.fieldErrors ?? {})) {
    const name = serverErrorField(field);
    if (!name) continue;
    mapped = true;
    setError(name, { type: "server", message: messages.join(" ") });
  }

  if (error.status === 409) {
    const duplicateFields: Record<string, FormField> = {
      USER_EMAIL_ALREADY_USED: "email",
      USER_PHONE_ALREADY_USED: "phone",
      USER_IDENTITY_NUMBER_ALREADY_USED: "identityNumber",
    };
    const duplicateField = error.code ? duplicateFields[error.code] : undefined;
    if (duplicateField) {
      setError(duplicateField, {
        type: "server",
        message: error.detail || "This value is already in use",
      });
      mapped = true;
    }
  }

  return mapped
    ? null
    : error.detail ||
        error.title ||
        "Unable to create your account. Please try again.";
}

function SignUpPage() {
  const router = useRouter();
  const { register: registerAccount } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues,
    mode: "onBlur",
  });

  async function submit(values: SignUpFormValues) {
    setFormError(null);
    const payload: SignUpRequest = {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      identityNumber: values.identityNumber.trim(),
      gender: values.gender,
      dateOfBirth: values.dateOfBirth,
      address: values.address.trim(),
      password: values.password,
    };
    const result = await registerAccount(payload);
    if (!result.ok) {
      if (result.error.code === "USER_VERIFICATION_EMAIL_FAILED") {
        router.push(`/check-email?email=${encodeURIComponent(payload.email)}&delivery=failed`);
        return;
      }
      setFormError(mapServerError(result.error, setError));
      return;
    }
    router.push(ACCOUNT_EXTENSIONS_ENABLED ? `/check-email?email=${encodeURIComponent(payload.email)}` : "/sign-in");
  }

  return (
    <div className="min-h-screen bg-white text-foreground">
      <header className="mx-auto w-full max-w-[720px] px-10 py-6">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-[720px] flex-col px-10 pb-10">
        <section aria-labelledby="sign-up-title" className="w-full">
          <h1 id="sign-up-title" className="text-heading-24">
            Create your account
          </h1>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-4 h-11 w-full gap-2 rounded-md bg-card px-4 text-xs"
          >
            <span aria-hidden="true" className="font-bold text-blue-600">
              G
            </span>
            Sign Up with Google
          </Button>
          <div
            className="my-4 flex items-center gap-3 text-xs text-muted-foreground"
            aria-hidden="true"
          >
            <Separator className="flex-1" />
            <span>or</span>
            <Separator className="flex-1" />
          </div>

          {formError ? (
            <p
              role="alert"
              className="mb-4 rounded-md border border-danger/30 bg-red-100 px-3 py-2 text-sm text-danger"
            >
              {formError}
            </p>
          ) : null}

          <form
            noValidate
            onSubmit={handleSubmit(submit)}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField
                name="fullName"
                label="Full Name"
                placeholder="Lan Nguyen"
                register={register}
                errors={errors}
                autoComplete="name"
              />
              <TextField
                name="email"
                label="Email"
                type="email"
                placeholder="lan.nguyen@gmail.com"
                register={register}
                errors={errors}
                autoComplete="email"
              />
              <TextField
                name="phone"
                label="Phone Number"
                placeholder="+84 912 345 678"
                register={register}
                errors={errors}
                autoComplete="tel"
              />
              <TextField
                name="identityNumber"
                label="Identity Number"
                placeholder="079203004512"
                register={register}
                errors={errors}
              />

              <Label
                className="block min-w-0 text-xs font-normal leading-4 text-foreground"
                htmlFor="gender"
              >
                <span className="mb-1.5 block">Gender</span>
                <select
                  id="gender"
                  aria-invalid={Boolean(errors.gender)}
                  {...register("gender")}
                  className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/20 aria-invalid:focus-visible:border-danger aria-invalid:focus-visible:ring-danger/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Select gender</option>
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                </select>
                <FieldError error={errors.gender} />
              </Label>
              <TextField
                name="dateOfBirth"
                label="Date of Birth"
                type="date"
                register={register}
                errors={errors}
              />

              <fieldset className="min-w-0 sm:col-span-2">
                <legend className="mb-1.5 text-xs leading-4 text-foreground">Address</legend>
                <input type="hidden" {...register("address")} />
                <LocalityAddressInput
                  idPrefix="address"
                  invalid={Boolean(errors.address)}
                  describedBy={errors.address ? "address-error" : undefined}
                  controlClassName="h-12 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm outline-none aria-invalid:border-danger focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-muted"
                  onChange={(address) => setValue("address", address ?? "", { shouldValidate: Boolean(errors.address) })}
                />
                {errors.address?.message ? (
                  <p id="address-error" role="alert" className="mt-1 text-xs leading-4 text-danger">
                    {String(errors.address.message)}
                  </p>
                ) : null}
              </fieldset>
              <TextField
                name="password"
                label="Password"
                type="password"
                placeholder="••••••••"
                register={register}
                errors={errors}
                autoComplete="new-password"
              />
              <TextField
                name="confirmPassword"
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                register={register}
                errors={errors}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              8+ characters, a number and a symbol
            </p>

            <Label
              className="flex min-h-11 items-start gap-2 text-xs font-normal leading-5 text-foreground"
              htmlFor="termsAccepted"
            >
              <Controller
                name="termsAccepted"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="termsAccepted"
                    checked={field.value}
                    onBlur={field.onBlur}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                    aria-invalid={Boolean(errors.termsAccepted)}
                    className="mt-1"
                  />
                )}
              />
              <span>
                I agree to the{" "}
                <Link
                  href="/terms"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Privacy Policy
                </Link>
              </span>
            </Label>
            <FieldError error={errors.termsAccepted} />

            <Button
              type="submit"
              disabled={isSubmitting}
              size="lg"
              className="h-11 w-full rounded-md px-4 text-sm font-semibold"
            >
              {isSubmitting ? "Creating account…" : "Create Account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </section>
      </main>
      <footer className="mx-auto w-full max-w-[720px] px-10 pb-6 text-xs text-muted-foreground">
        © 2026 Nexus · Terms · Privacy
      </footer>
    </div>
  );
}

export default SignUpPage;
