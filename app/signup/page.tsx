import type { Metadata } from "next";
import { MESSAGES } from "@/constants/messages";
import { SignupView } from "./signup-view";

// Server Component wrapper only so this page can export metadata — see
// app/restaurants/page.tsx's comment for why this needs to be a separate
// file from the "use client" form itself.
export const metadata: Metadata = { title: MESSAGES.nav.signup };

export default function SignupPage() {
  return <SignupView />;
}
