import Link from "next/link";
import { useTranslations } from "next-intl";
import { Compass } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations();
  return (
    <main id="main" className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <p className="text-7xl font-semibold tracking-tighter text-brand">404</p>
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("pages.notFoundTitle")}</h1>
        <p className="max-w-md text-muted-foreground">{t("pages.notFoundText")}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">{t("common.goHome")}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/courses">
            <Compass /> {t("common.browseCourses")}
          </Link>
        </Button>
      </div>
    </main>
  );
}
