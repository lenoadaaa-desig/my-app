"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MESSAGES, ERROR_MESSAGES_TH, DAY_OF_WEEK_LABELS_TH } from "@/constants/messages";
import type { BookingSetting } from "@prisma/client";
import type { RestaurantWithOpeningHours } from "@/modules/restaurant/restaurant.service";

type OwnerRestaurant = RestaurantWithOpeningHours & { bookingSetting: BookingSetting | null };

type ApiError = { code: string; message: string };
type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiError };

function errorText(err: ApiError): string {
  return ERROR_MESSAGES_TH[err.code as keyof typeof ERROR_MESSAGES_TH] ?? MESSAGES.common.errorGeneric;
}

type GeneralInfo = {
  name: string;
  category: string;
  description: string;
  phone: string;
  address: string;
  coverImage: string;
};

function GeneralInfoTab({ restaurant }: { restaurant: OwnerRestaurant }) {
  const [form, setForm] = useState<GeneralInfo>({
    name: restaurant.name,
    category: restaurant.category,
    description: restaurant.description ?? "",
    phone: restaurant.phone ?? "",
    address: restaurant.address ?? "",
    coverImage: restaurant.coverImage ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  // See CLAUDE.md's note on stale-closure double-submit guards — `saving`
  // state alone can't block a same-tick double click.
  const savingRef = useRef(false);

  function update<K extends keyof GeneralInfo>(key: K, value: GeneralInfo[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (savingRef.current) return;
    if (!form.name.trim()) {
      setError({ code: "", message: MESSAGES.restaurant.nameRequired });
      return;
    }
    if (!form.category.trim()) {
      setError({ code: "", message: MESSAGES.restaurant.categoryRequired });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim(),
          description: form.description.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          coverImage: form.coverImage.trim(),
        }),
      });
      const result = (await res.json()) as ApiResult<unknown>;
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
    } catch {
      setError({ code: "", message: MESSAGES.common.errorGeneric });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-name">{MESSAGES.owner.nameLabel}</Label>
          <Input id="settings-name" value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-category">{MESSAGES.owner.categoryLabel}</Label>
          <Input
            id="settings-category"
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-description">{MESSAGES.owner.descriptionLabel}</Label>
          <Textarea
            id="settings-description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-phone">{MESSAGES.owner.phoneLabel}</Label>
          <Input
            id="settings-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-address">{MESSAGES.owner.addressLabel}</Label>
          <Textarea
            id="settings-address"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            rows={2}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-cover">{MESSAGES.owner.coverImageLabel}</Label>
          <Input
            id="settings-cover"
            value={form.coverImage}
            onChange={(e) => update("coverImage", e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-bad">{errorText(error)}</p>}
        {saved && <p className="text-sm text-ok">{MESSAGES.owner.saveSuccess}</p>}

        <Button type="button" disabled={saving} onClick={handleSave} className="w-fit">
          {saving ? (
            <>
              <Loader2 className="animate-spin" />
              {MESSAGES.owner.savePending}
            </>
          ) : (
            MESSAGES.owner.saveButton
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

type OpeningHourRow = { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean };

function OpeningHoursTab({ restaurant }: { restaurant: OwnerRestaurant }) {
  const [hours, setHours] = useState<OpeningHourRow[]>(
    Array.from({ length: 7 }, (_, dayOfWeek) => {
      const existing = restaurant.openingHours.find((h) => h.dayOfWeek === dayOfWeek);
      return existing ?? { dayOfWeek, openTime: "10:00", closeTime: "22:00", isClosed: false };
    })
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  // Guards `submit` itself (not just `handleSave`) since the confirm
  // dialog's "save anyway" button calls submit(true) directly — see
  // CLAUDE.md's stale-closure note.
  const savingRef = useRef(false);

  function updateRow(dayOfWeek: number, patch: Partial<OpeningHourRow>) {
    setHours((prev) => prev.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)));
    setSaved(false);
  }

  async function submit(confirm: boolean) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours, confirm }),
      });
      const result = (await res.json()) as ApiResult<unknown>;
      if (!result.success) {
        if (result.error.code === "CONFIRMATION_REQUIRED") {
          setConfirmMessage(result.error.message);
          return;
        }
        setError(result.error);
        return;
      }
      setConfirmMessage(null);
      setSaved(true);
    } catch {
      setError({ code: "", message: MESSAGES.common.errorGeneric });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handleSave() {
    if (savingRef.current) return;
    setSaved(false);
    submit(false);
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3">
          {hours.map((row) => (
            <div key={row.dayOfWeek} className="flex flex-wrap items-center gap-3 border-b border-gold-dim pb-3 last:border-b-0 last:pb-0">
              <p className="w-24 shrink-0 text-sm font-medium text-ink">
                {DAY_OF_WEEK_LABELS_TH[row.dayOfWeek]}
              </p>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <Switch
                  checked={!row.isClosed}
                  onCheckedChange={(checked) => updateRow(row.dayOfWeek, { isClosed: !checked })}
                />
                {row.isClosed ? MESSAGES.restaurant.closedLabel : MESSAGES.owner.closedToggleLabel}
              </label>
              {!row.isClosed && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="time"
                    value={row.openTime}
                    onChange={(e) => updateRow(row.dayOfWeek, { openTime: e.target.value })}
                    className="w-28"
                  />
                  <span className="text-ink-mute">–</span>
                  <Input
                    type="time"
                    value={row.closeTime}
                    onChange={(e) => updateRow(row.dayOfWeek, { closeTime: e.target.value })}
                    className="w-28"
                  />
                </div>
              )}
            </div>
          ))}

          {error && <p className="text-sm text-bad">{errorText(error)}</p>}
          {saved && <p className="text-sm text-ok">{MESSAGES.owner.saveSuccess}</p>}

          <Button type="button" disabled={saving} onClick={handleSave} className="w-fit">
            {saving ? (
              <>
                <Loader2 className="animate-spin" />
                {MESSAGES.owner.savePending}
              </>
            ) : (
              MESSAGES.owner.saveButton
            )}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmMessage !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setConfirmMessage(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{MESSAGES.owner.confirmSaveWarningTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{MESSAGES.owner.confirmDialogCancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                submit(true);
              }}
            >
              {saving ? MESSAGES.owner.savePending : MESSAGES.owner.confirmSaveAnyway}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type BookingSettingsForm = {
  slotDuration: string;
  capacityPerSlot: string;
  maxPartySize: string;
  advanceDays: string;
  minLeadHours: string;
  autoConfirm: boolean;
};

function BookingSettingsTab({ restaurant }: { restaurant: OwnerRestaurant }) {
  const setting = restaurant.bookingSetting;
  const [form, setForm] = useState<BookingSettingsForm>({
    slotDuration: String(setting?.slotDuration ?? 60),
    capacityPerSlot: String(setting?.capacityPerSlot ?? 40),
    maxPartySize: String(setting?.maxPartySize ?? 10),
    advanceDays: String(setting?.advanceDays ?? 30),
    minLeadHours: String(setting?.minLeadHours ?? 2),
    autoConfirm: setting?.autoConfirm ?? false,
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  // Guards `submit` itself (not just `handleSave`) since the confirm
  // dialog's "save anyway" button calls submit(true) directly — see
  // CLAUDE.md's stale-closure note.
  const savingRef = useRef(false);

  function update<K extends keyof BookingSettingsForm>(key: K, value: BookingSettingsForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setValidationError(null);
    setSaved(false);
  }

  // Client-side validation per CLAUDE.md's note: slot.engine.ts doesn't
  // reject negative/zero settings itself (it just produces nonsense output
  // — negative capacity, a no-op lead time, advanceDays blocking every
  // day) — this is the first guard. The server (updateBookingSettingSchema)
  // re-checks the same rules, so this is purely to avoid a round trip for
  // an obviously invalid form.
  function validate(): string | null {
    if (!(Number(form.slotDuration) > 0)) return MESSAGES.owner.slotDurationInvalid;
    if (!(Number(form.capacityPerSlot) > 0)) return MESSAGES.owner.capacityPerSlotInvalid;
    if (!(Number(form.maxPartySize) > 0)) return MESSAGES.owner.maxPartySizeInvalid;
    if (Number(form.maxPartySize) > Number(form.capacityPerSlot)) return MESSAGES.owner.maxPartySizeExceedsCapacity;
    if (!(Number(form.advanceDays) >= 1)) return MESSAGES.owner.advanceDaysInvalid;
    if (!(Number(form.minLeadHours) >= 0)) return MESSAGES.owner.minLeadHoursInvalid;
    return null;
  }

  async function submit(confirm: boolean) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/restaurants/${restaurant.id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotDuration: Number(form.slotDuration),
          capacityPerSlot: Number(form.capacityPerSlot),
          maxPartySize: Number(form.maxPartySize),
          advanceDays: Number(form.advanceDays),
          minLeadHours: Number(form.minLeadHours),
          autoConfirm: form.autoConfirm,
          confirm,
        }),
      });
      const result = (await res.json()) as ApiResult<unknown>;
      if (!result.success) {
        if (result.error.code === "CONFIRMATION_REQUIRED") {
          setConfirmMessage(result.error.message);
          return;
        }
        setError(result.error);
        return;
      }
      setConfirmMessage(null);
      setSaved(true);
    } catch {
      setError({ code: "", message: MESSAGES.common.errorGeneric });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handleSave() {
    if (savingRef.current) return;
    setSaved(false);
    const err = validate();
    setValidationError(err);
    if (err) return;
    submit(false);
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slotDuration">{MESSAGES.owner.slotDurationLabel}</Label>
            <Input
              id="slotDuration"
              type="number"
              min={1}
              value={form.slotDuration}
              onChange={(e) => update("slotDuration", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capacityPerSlot">{MESSAGES.owner.capacityPerSlotLabel}</Label>
            <Input
              id="capacityPerSlot"
              type="number"
              min={1}
              value={form.capacityPerSlot}
              onChange={(e) => update("capacityPerSlot", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxPartySize">{MESSAGES.owner.maxPartySizeLabel}</Label>
            <Input
              id="maxPartySize"
              type="number"
              min={1}
              value={form.maxPartySize}
              onChange={(e) => update("maxPartySize", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="advanceDays">{MESSAGES.owner.advanceDaysLabel}</Label>
            <Input
              id="advanceDays"
              type="number"
              min={1}
              value={form.advanceDays}
              onChange={(e) => update("advanceDays", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minLeadHours">{MESSAGES.owner.minLeadHoursLabel}</Label>
            <Input
              id="minLeadHours"
              type="number"
              min={0}
              value={form.minLeadHours}
              onChange={(e) => update("minLeadHours", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <Switch
              checked={form.autoConfirm}
              onCheckedChange={(checked) => update("autoConfirm", checked)}
            />
            {MESSAGES.owner.autoConfirmLabel}
          </label>

          {validationError && <p className="text-sm text-bad">{validationError}</p>}
          {error && <p className="text-sm text-bad">{errorText(error)}</p>}
          {saved && <p className="text-sm text-ok">{MESSAGES.owner.saveSuccess}</p>}

          <Button type="button" disabled={saving} onClick={handleSave} className="w-fit">
            {saving ? (
              <>
                <Loader2 className="animate-spin" />
                {MESSAGES.owner.savePending}
              </>
            ) : (
              MESSAGES.owner.saveButton
            )}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmMessage !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setConfirmMessage(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{MESSAGES.owner.confirmSaveWarningTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{MESSAGES.owner.confirmDialogCancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                submit(true);
              }}
            >
              {saving ? MESSAGES.owner.savePending : MESSAGES.owner.confirmSaveAnyway}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function OwnerSettingsForm({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <Tabs defaultValue="general">
      <TabsList className="w-full">
        <TabsTrigger value="general">{MESSAGES.owner.generalInfoTab}</TabsTrigger>
        <TabsTrigger value="hours">{MESSAGES.owner.openingHoursTab}</TabsTrigger>
        <TabsTrigger value="booking">{MESSAGES.owner.bookingSettingsTab}</TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="mt-3">
        <GeneralInfoTab restaurant={restaurant} />
      </TabsContent>
      <TabsContent value="hours" className="mt-3">
        <OpeningHoursTab restaurant={restaurant} />
      </TabsContent>
      <TabsContent value="booking" className="mt-3">
        <BookingSettingsTab restaurant={restaurant} />
      </TabsContent>
    </Tabs>
  );
}
