import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <p className="text-7xl font-semibold tracking-tighter text-brand">404</p>
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Hier geht&apos;s nicht weiter.</h1>
        <p className="max-w-md text-muted-foreground">This page doesn&apos;t exist, or it isn&apos;t published (yet). Let&apos;s get you back on your path.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/courses">
            <Compass /> Browse courses
          </Link>
        </Button>
      </div>
    </main>
  );
}
