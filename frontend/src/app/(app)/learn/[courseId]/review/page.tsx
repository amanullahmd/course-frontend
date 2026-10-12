import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReviewSession } from "@/components/flashcards/review-session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("review") };
}

/** /learn/[courseId]/review: spaced repetition session over the due cards of all decks of the course. */
export default function ReviewPage() {
  return <ReviewSession />;
}
