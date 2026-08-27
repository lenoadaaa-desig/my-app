import type { Metadata } from "next";
import { getProfile } from "@/lib/dal";
import { MESSAGES } from "@/constants/messages";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: MESSAGES.owner.registerTitle };

export default async function OwnerRegisterPage() {
  // Any logged-in profile can register a restaurant — POST /api/restaurants
  // itself is what promotes a customer to owner (see its own comment), so
  // this can't be gated to role "owner" without locking out the exact
  // people who need it most: first-time registrants.
  await getProfile();

  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col gap-4 bg-canvas px-4 py-6 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.owner.registerTitle}</h1>
      <RegisterForm />
    </div>
  );
}
