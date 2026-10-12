import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("privacy.goodbye"))("metaTitle"), robots: { index: false } };
}

/** Shown after an account was deleted. */
export default async function GoodbyePage() {
  const t = await getTranslations("privacy.goodbye");
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
        <HeartHandshake className="size-7" />
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("text")}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t("note")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">{t("home")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/courses">{t("courses")}</Link>
        </Button>
      </div>
    </div>
  );
}
