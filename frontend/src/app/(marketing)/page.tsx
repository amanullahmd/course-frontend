import { Suspense } from "react";
import { FeaturedCourses, FeaturedCoursesSkeleton, FeaturedHeader } from "@/components/marketing/featured-courses";
import { Features, FinalCta, Hero, HowItWorks, LevelStrip, Testimonials } from "@/components/marketing/sections";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <LevelStrip />
      <Features />
      <HowItWorks />
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FeaturedHeader />
          <Suspense fallback={<FeaturedCoursesSkeleton />}>
            <FeaturedCourses />
          </Suspense>
        </div>
      </section>
      <Testimonials />
      <FinalCta />
    </>
  );
}
