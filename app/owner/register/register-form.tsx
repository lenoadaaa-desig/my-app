"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MESSAGES, ERROR_MESSAGES_TH } from "@/constants/messages";
import { cn } from "@/lib/utils";

type FormData = {
  name: string;
  category: string;
  description: string;
  phone: string;
  address: string;
  coverImage: string;
};

type ApiError = { code: string; message: string };
type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiError };

const TOTAL_STEPS = 4;
const STEP_TITLES = [
  MESSAGES.owner.step1Title,
  MESSAGES.owner.step2Title,
  MESSAGES.owner.step3Title,
  MESSAGES.owner.step4Title,
];

function errorText(err: ApiError): string {
  return ERROR_MESSAGES_TH[err.code as keyof typeof ERROR_MESSAGES_TH] ?? MESSAGES.common.errorGeneric;
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEP_TITLES.map((title, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={title} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                done || active ? "bg-gold text-raised" : "bg-surface text-ink-mute"
              )}
            >
              {n}
            </div>
            {n < TOTAL_STEPS && (
              <div className={cn("h-0.5 flex-1", done ? "bg-gold" : "bg-gold-dim")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    name: "",
    category: "",
    description: "",
    phone: "",
    address: "",
    coverImage: "",
  });
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    if (step === 1) {
      if (!form.name.trim()) {
        setStepError(MESSAGES.restaurant.nameRequired);
        return;
      }
      if (!form.category.trim()) {
        setStepError(MESSAGES.restaurant.categoryRequired);
        return;
      }
    }
    setStepError(null);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function goBack() {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim(),
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(form.address.trim() ? { address: form.address.trim() } : {}),
          ...(form.coverImage.trim() ? { coverImage: form.coverImage.trim() } : {}),
        }),
      });
      const result = (await res.json()) as ApiResult<{ id: string }>;

      if (!result.success) {
        setSubmitError(result.error);
        return;
      }

      router.push("/owner/status");
    } catch {
      setSubmitError({ code: "", message: MESSAGES.common.errorGeneric });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Stepper step={step} />
          <p className="text-center text-sm text-ink-soft">
            {MESSAGES.owner.stepOf(step, TOTAL_STEPS)} · {STEP_TITLES[step - 1]}
          </p>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{MESSAGES.owner.nameLabel}</Label>
              <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">{MESSAGES.owner.categoryLabel}</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">{MESSAGES.owner.descriptionLabel}</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{MESSAGES.owner.phoneLabel}</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">{MESSAGES.owner.addressLabel}</Label>
            <Textarea
              id="address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              rows={3}
            />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coverImage">{MESSAGES.owner.coverImageLabel}</Label>
            <Input
              id="coverImage"
              value={form.coverImage}
              onChange={(e) => update("coverImage", e.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-ink-mute">{MESSAGES.owner.coverImageHint}</p>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink">{MESSAGES.owner.reviewHeading}</p>
            <dl className="grid gap-1.5 text-sm">
              {[
                [MESSAGES.owner.nameLabel, form.name],
                [MESSAGES.owner.categoryLabel, form.category],
                [MESSAGES.owner.descriptionLabel, form.description],
                [MESSAGES.owner.phoneLabel, form.phone],
                [MESSAGES.owner.addressLabel, form.address],
                [MESSAGES.owner.coverImageLabel, form.coverImage],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-gold-dim pb-1.5">
                  <dt className="shrink-0 text-ink-soft">{label}</dt>
                  <dd className="text-right text-ink">{value || MESSAGES.owner.notProvided}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {stepError && <p className="text-sm text-bad">{stepError}</p>}
        {submitError && <p className="text-sm text-bad">{errorText(submitError)}</p>}

        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" disabled={step === 1} onClick={goBack}>
            {MESSAGES.owner.backButton}
          </Button>
          {step < TOTAL_STEPS ? (
            <Button type="button" onClick={goNext}>
              {MESSAGES.owner.nextButton}
            </Button>
          ) : (
            <Button type="button" disabled={submitting} onClick={handleSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  {MESSAGES.owner.submitPending}
                </>
              ) : (
                MESSAGES.owner.submitButton
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
