import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas px-4 py-16 text-center">
      <SearchX className="size-12 text-ink-mute" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.notFoundPage.title}</h1>
        <p className="text-sm text-ink-soft">{MESSAGES.notFoundPage.description}</p>
      </div>
      <Link href="/" className={cn(buttonVariants())}>
        {MESSAGES.common.backToHome}
      </Link>
    </div>
  );
}
