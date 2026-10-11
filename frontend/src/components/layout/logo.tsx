import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="9" className="fill-[#151C38] dark:fill-[#F2B544]" />
      <path
        d="M6.5 21.5c3.2 0 4.6-11 9.5-11s6.3 11 9.5 11"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-[#F2B544] dark:stroke-[#151C38]"
      />
      <circle cx="16" cy="10.5" r="2.2" className="fill-[#FFF7E6] dark:fill-[#151C38]" />
    </svg>
  );
}

export function Logo({ href = "/", className, compact = false }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      aria-label="Sprachweg home"
    >
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6" />
      {!compact && <span className="text-[17px] font-semibold tracking-tight">Sprachweg</span>}
    </Link>
  );
}
