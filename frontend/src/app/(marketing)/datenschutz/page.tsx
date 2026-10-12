import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("datenschutz");
}

export default function Page() {
  return <LegalPage doc="datenschutz" />;
}
