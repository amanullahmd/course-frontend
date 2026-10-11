import type { CefrLevel } from "@/lib/api/types";
import { cn, hashString } from "@/lib/utils";

const gradients = [
  "from-[#151C38] via-[#26336b] to-[#d99a2b]",
  "from-[#0f2a3d] via-[#1f5a73] to-[#f0c36a]",
  "from-[#2a1840] via-[#4b2d73] to-[#e8a64c]",
  "from-[#13302a] via-[#22594d] to-[#e9c46a]",
  "from-[#2b1a1a] via-[#5a2e2e] to-[#f2b544]",
  "from-[#1a2240] via-[#3b4d8f] to-[#a7c4f2]",
];

/** Cover image, or a calm generated gradient with typographic accent. */
export function CourseCover({
  title,
  src,
  level,
  className,
  size = "md",
}: {
  title: string;
  src?: string | null;
  level?: CefrLevel;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed media URLs are not optimisable
      <img src={src} alt="" className={cn("size-full object-cover", className)} loading="lazy" />
    );
  }
  const g = gradients[hashString(title) % gradients.length];
  const word = title.split(/\s+/).find((w) => w.length > 3) ?? title;
  return (
    <div className={cn("relative size-full overflow-hidden bg-gradient-to-br", g, className)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.18),transparent_45%)]" />
      <svg className="absolute inset-x-0 bottom-0 h-1/2 w-full opacity-30" viewBox="0 0 400 100" preserveAspectRatio="none">
        <path d="M0 80 C 80 80, 120 20, 200 20 S 320 80, 400 80" stroke="white" strokeWidth="2" fill="none" />
        <path d="M0 95 C 100 95, 140 45, 220 45 S 340 95, 400 95" stroke="white" strokeWidth="1" fill="none" opacity="0.6" />
      </svg>
      <span
        className={cn(
          "absolute -right-2 -bottom-3 font-semibold tracking-tighter text-white/15 select-none",
          size === "sm" ? "text-4xl" : size === "lg" ? "text-8xl" : "text-6xl",
        )}
      >
        {level ?? word.slice(0, 10)}
      </span>
    </div>
  );
}
