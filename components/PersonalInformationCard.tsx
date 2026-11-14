"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import { Label } from "@/components/label";
import { Button } from "@/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/select";
import type { UserResponse } from "@/types/authResponseType";
import type { UpdateProfileRequest } from "@/types/accountType";
import type { ApiResult } from "@/types/commonResponseType";
import { profileFormValues, profileSchema, profileUpdate, todayLocal, type ProfileFormValues } from "@/features/profileSchema";
import { ACCOUNT_EXTENSIONS_ENABLED } from "@/configs/account";

interface PersonalInformationCardProps {
  user: UserResponse;
  onSave: (input: UpdateProfileRequest) => Promise<ApiResult<UserResponse>>;
}

const textFields = [
  { name: "fullName", label: "Full Name", type: "text", autoComplete: "name", maxLength: 150 },
  { name: "email", label: "Email", type: "email", autoComplete: "email", maxLength: 255 },
  { name: "phone", label: "Phone Number", type: "tel", autoComplete: "tel", readOnly: true },
  { name: "dateOfBirth", label: "Date of Birth", type: "date", autoComplete: "bday" },
] as const;

const genders = [
  { value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }, { value: "OTHER", label: "Other" },
] as const;

function FieldError({ name, errors }: { name: keyof ProfileFormValues; errors: FieldErrors<ProfileFormValues> }) {
  return errors[name]?.message ? <p id={`profile-${name}-error`} role="alert" className="text-xs leading-5 text-danger">{errors[name]?.message}</p> : null;
}

function PersonalInformationCard({ user, onSave }: PersonalInformationCardProps) {
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const { register, control, handleSubmit, reset, setError, clearErrors, formState: { errors, isSubmitting, isDirty, dirtyFields } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema), defaultValues: profileFormValues(user), mode: "onBlur",
  });

  useEffect(() => {
    if (!isDirty && !isSubmitting) reset(profileFormValues(user));
  }, [user, isDirty, isSubmitting, reset]);

  async function submit(values: ProfileFormValues) {
    setMessage(null);
    clearErrors();
    if (user.dateOfBirth && !values.dateOfBirth) {
      setError("dateOfBirth", { type: "validate", message: "Date of birth cannot be cleared. Choose a date or cancel to keep the current value." });
      return;
    }
    const result = await onSave(profileUpdate(values, dirtyFields));
    if (result.ok) {
      reset(profileFormValues(result.data));
      setMessage({ kind: "success", text: "Your profile has been updated." });
      return;
    }
    let mapped = false;
    for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
      if (Object.hasOwn(profileFormValues(user), field)) {
        setError(field as keyof ProfileFormValues, { type: "server", message: messages.join(" ") });
        mapped = true;
      }
    }
    if (result.error.status === 409 && result.error.code === "USER_EMAIL_ALREADY_USED") {
      setError("email", { type: "server", message: "This email is already in use." }, { shouldFocus: true });
      mapped = true;
    }
    setMessage({ kind: "error", text: mapped ? "Please check the highlighted fields." : result.error.detail || "Unable to save your profile. Please try again." });
  }

  function cancel() {
    reset(profileFormValues(user));
    setMessage(null);
  }

  return (
    <Card id="personal-information" className="scroll-mt-6 rounded-md">
      <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
      <CardContent>
        <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5" aria-label="Personal information">
          <fieldset disabled={isSubmitting} className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <legend className="sr-only">Edit your personal information</legend>
            {textFields.map((field) => {
              const readOnly = "readOnly" in field && field.readOnly;
              const help = readOnly ? `profile-${field.name}-help` : undefined;
              return (
                <div key={field.name} className="min-w-0 space-y-1.5">
                  <Label htmlFor={`profile-${field.name}`} className="text-sm font-normal text-gray-900">{field.label}</Label>
                  <Input id={`profile-${field.name}`} type={field.type} autoComplete={field.autoComplete}
                    maxLength={"maxLength" in field ? field.maxLength : undefined} max={field.type === "date" ? todayLocal() : undefined}
                    readOnly={readOnly} aria-readonly={readOnly || undefined}
                    aria-invalid={Boolean(errors[field.name])}
                    aria-describedby={[help, errors[field.name] ? `profile-${field.name}-error` : undefined].filter(Boolean).join(" ") || undefined}
                    {...register(field.name)} className={`h-11 rounded-md px-3 text-sm ${readOnly ? "bg-muted text-muted-foreground" : ""}`} />
                  {readOnly && <p id={help} className="text-xs leading-5 text-muted-foreground">{ACCOUNT_EXTENSIONS_ENABLED ? "Update and verify your phone in Phone verification below." : "Phone number updates are not available yet."}</p>}
                  <FieldError name={field.name} errors={errors} />
                </div>
              );
            })}
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="profile-gender" className="text-sm font-normal text-gray-900">Gender</Label>
              <Controller name="gender" control={control} render={({ field }) => (
                <Select value={field.value || null} onValueChange={(value) => field.onChange(value)} disabled={isSubmitting}>
                  <SelectTrigger id="profile-gender" ref={field.ref} onBlur={field.onBlur} aria-invalid={Boolean(errors.gender)}
                    aria-describedby={errors.gender ? "profile-gender-error" : undefined}>
                    <SelectValue placeholder="Not specified">{genders.find((gender) => gender.value === field.value)?.label ?? "Not specified"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>{genders.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              )} />
              <FieldError name="gender" errors={errors} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="profile-identity" className="text-sm font-normal text-gray-900">Identity Number</Label>
              <Input id="profile-identity" value="" placeholder="Kept private" readOnly aria-describedby="profile-identity-help" className="h-11 rounded-md bg-muted px-3 text-sm" />
              <p id="profile-identity-help" className="text-xs leading-5 text-muted-foreground">Your identity number is kept private.</p>
            </div>
            <div className="min-w-0 space-y-1.5 sm:col-span-2">
              <Label htmlFor="profile-address" className="text-sm font-normal text-gray-900">Address</Label>
              <Textarea id="profile-address" autoComplete="street-address" rows={3} {...register("address")} aria-invalid={Boolean(errors.address)}
                aria-describedby={errors.address ? "profile-address-error" : undefined} className="min-h-24 resize-y leading-6 sm:h-11 sm:min-h-11" />
              <FieldError name="address" errors={errors} />
            </div>
          </fieldset>
          {message && <p role={message.kind === "error" ? "alert" : "status"} className={`flex items-start gap-2 text-sm leading-5 ${message.kind === "error" ? "text-danger" : "text-success"}`}>
            {message.kind === "success" && <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}{message.text}
          </p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={isSubmitting || !isDirty} onClick={cancel} className="min-h-11 rounded-md px-4">Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !isDirty} className="min-h-11 rounded-md px-4">
              {isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default PersonalInformationCard;
