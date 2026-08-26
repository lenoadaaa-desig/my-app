"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";

// `retry` (stable as of Next 16.3.0 — this project's pinned version, see
// node_modules/next/dist/docs/.../file-conventions/error.md's version
// history) re-fetches and re-renders this segment; prefer it over the
// older `reset()` unless there's a specific reason to skip the re-fetch.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas px-4 py-16 text-center">
      <AlertTriangle className="size-12 text-bad" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.errorPage.title}</h1>
        <p className="text-sm text-ink-soft">{MESSAGES.errorPage.description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>{MESSAGES.common.retry}</Button>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          {MESSAGES.common.backToHome}
        </Link>
      </div>
    </div>
  );
}
