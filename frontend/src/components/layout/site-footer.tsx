import Link from "next/link";
import { CEFR_LEVELS } from "@/lib/constants";
import { Logo } from "./logo";

const columns = [
  {
    title: "Learn",
    links: [
      { href: "/courses", label: "Course catalog" },
      ...CEFR_LEVELS.slice(0, 4).map((l) => ({ href: `/courses?level=${l}`, label: `${l} courses` })),
    ],
  },
  {
    title: "Teach",
    links: [
      { href: "/register?role=INSTRUCTOR", label: "Become an instructor" },
      { href: "/#features", label: "Course builder" },
      { href: "/#how-it-works", label: "Publishing & scheduling" },
      { href: "/login", label: "Instructor login" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/register", label: "Create account" },
      { href: "/forgot-password", label: "Reset password" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-sidebar">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div className="max-w-xs space-y-4">
          <Logo />
          <p className="text-sm text-muted-foreground">
            The language path for German teachers and learners. Build courses from any material, release them on your
            schedule, and learn at your own pace.
          </p>
          <p className="text-sm text-muted-foreground italic">„Der Weg ist das Ziel.“</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold">{col.title}</h3>
            <ul className="mt-4 grid gap-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>© Sprachweg. Made for learners of German everywhere.</p>
          <p>Built with care in the spirit of “Schritt für Schritt”.</p>
        </div>
      </div>
    </footer>
  );
}
