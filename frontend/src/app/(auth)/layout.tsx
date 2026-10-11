import Link from "next/link";
import { CircleCheck, Headphones } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Logo } from "@/components/layout/logo";
import { ThemeToggleButton } from "@/components/layout/theme-toggle";
import { CEFR_LEVELS, CEFR_META } from "@/lib/constants";
import { cn } from "@/lib/utils";

function BrandPanel() {
  const t = useTranslations("auth");
  return (
    <div className="relative hidden overflow-hidden bg-[#121831] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="absolute -top-32 -right-32 size-[28rem] rounded-full bg-brand/25 blur-3xl" />
      <div className="absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-indigo-500/20 blur-3xl" />
      <svg className="absolute inset-x-0 bottom-0 h-2/3 w-full opacity-[0.12]" viewBox="0 0 600 400" preserveAspectRatio="none" aria-hidden>
        <path d="M-20 380 C 120 380, 160 120, 300 120 S 480 380, 620 380" stroke="#F2B544" strokeWidth="3" fill="none" />
        <path d="M-20 400 C 140 400, 200 200, 320 200 S 500 400, 640 400" stroke="white" strokeWidth="1.5" fill="none" />
      </svg>

      <div className="relative">
        <p className="text-sm font-medium text-white/60">Sprachweg</p>
        <p className="mt-6 max-w-md text-3xl leading-tight font-semibold tracking-tight">
          {t("panelQuote")}
          <span className="mt-2 block text-lg font-normal text-white/70">{t("panelSub")}</span>
        </p>
      </div>

      <div className="relative grid max-w-sm gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
          <span className="grid size-9 place-items-center rounded-lg bg-violet-400/15 text-violet-200">
            <Headphones className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{t("panelAudio")}</p>
            <div className="mt-1.5 h-1 rounded-full bg-white/10">
              <div className="h-full w-3/5 rounded-full bg-brand" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
          <CircleCheck className="size-5 text-emerald-300" />
          <p className="text-sm">{t("panelQuiz")}</p>
        </div>
        <div className="mt-4 flex gap-1.5" aria-hidden>
          {CEFR_LEVELS.map((l) => (
            <span key={l} className={cn("flex-1 rounded-md py-1 text-center text-xs font-semibold text-white/90", CEFR_META[l].dot, "bg-opacity-80")}>
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: LayoutProps<"/">) {
  const t = useTranslations("auth");
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1.5">
            <LocaleSwitcher />
            <ThemeToggleButton />
          </div>
        </div>
        <main id="main" className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[400px] animate-slide-up">{children}</div>
        </main>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/courses" className="hover:text-foreground">
            {t("browseCourses")}
          </Link>
          <span className="mx-2">·</span>
          <Link href="/" className="hover:text-foreground">
            {t("home")}
          </Link>
        </p>
      </div>
      <BrandPanel />
    </div>
  );
}
