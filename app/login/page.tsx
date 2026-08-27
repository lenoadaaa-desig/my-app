import type { Metadata } from "next";
import { MESSAGES } from "@/constants/messages";
import { LoginView } from "./login-view";

// Server Component wrapper only so this page can export metadata — see
// app/restaurants/page.tsx's comment for why this needs to be a separate
// file from the "use client" form itself.
export const metadata: Metadata = { title: MESSAGES.nav.login };

export default function LoginPage() {
  return <LoginView />;
}
