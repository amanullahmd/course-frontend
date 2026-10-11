"use client";

import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="flex min-h-[60dvh] flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-destructive-soft text-destructive">
        <TriangleAlert className="size-7" />
      </span>
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="max-w-md text-muted-foreground">An unexpected error occurred. Please try again. If the problem persists, contact support.</p>
        {error.digest && <p className="font-mono text-xs text-muted-foreground">Error ID: {error.digest}</p>}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>
          <RotateCw /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
