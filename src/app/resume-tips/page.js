import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  LuArrowRight,
  LuGraduationCap,
  LuLayoutDashboard,
  LuMegaphone,
  LuRadar,
  LuRoute,
  LuTrendingUp,
  LuZap,
} from "react-icons/lu";

export const metadata = {
  title: "Resume Tips - ResumeAI",
  description:
    "Expert resume tips and strategies to help you write a resume that gets past ATS filters and lands interviews.",
};

const tips = [
  {
    icon: LuZap,
    title: "Action Verbs Mastery",
    description:
      "Replace passive descriptions with powerful action verbs like 'Engineered', 'Spearheaded', and 'Optimized' to demonstrate impact and leadership.",
  },
  {
    icon: LuRadar,
    title: "ATS Keyword Optimization",
    description:
      "Learn how to seamlessly integrate industry-specific keywords so your resume passes through Applicant Tracking Systems.",
  },
  {
    icon: LuLayoutDashboard,
    title: "Layout & Whitespace",
    description:
      "Use strategic margins and clear typographical hierarchy to reduce cognitive load for recruiters skimming your document.",
  },
];

const articles = [
  {
    badge: "Entry Level",
    readTime: "5 min read",
    icon: LuGraduationCap,
    title: "The Recent Graduate's Guide to a First Resume",
    description:
      "How to leverage academic achievements, internships, and extracurricular activities when you lack extensive professional experience.",
  },
  {
    badge: "Career Change",
    readTime: "8 min read",
    icon: LuRoute,
    title: "Structuring a Functional Resume for a Career Pivot",
    description:
      "Highlight transferable skills over chronological work history to successfully navigate an industry change.",
  },
];

export default function ResumeTipsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="hero-pattern"></div>
          <div className="glow-orb glow-orb-primary"></div>
          <div className="glow-orb glow-orb-secondary"></div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
            <div className="grid md:grid-cols-12 gap-10 items-center">
              <div className="md:col-span-7">
                <Badge
                  variant="secondary"
                  className="mb-6 px-4 py-2 text-sm gap-2"
                >
                  <LuMegaphone className="h-4 w-4" />
                  Expert Insights
                </Badge>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 leading-tight">
                  Elevate Your Career Trajectory with{" "}
                  <span className="text-gradient">Precision Strategies</span>
                </h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl leading-relaxed">
                  Discover actionable advice, layout secrets, and optimization
                  techniques from top recruiters to ensure your resume stands
                  out in a competitive landscape.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a href="#tips-grid">
                    <Button size="lg" className="w-full sm:w-auto">
                      Explore Tips
                    </Button>
                  </a>
                  <Link href="/cv">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Build My Resume
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="md:col-span-5 relative h-72 hidden md:block">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/20 rounded-2xl border border-border flex items-center justify-center">
                  <LuTrendingUp className="h-24 w-24 text-primary/40" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tips Bento Grid */}
        <section className="py-16 border-t border-border" id="tips-grid">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <h2 className="text-3xl font-bold mb-2">
                Essential <span className="text-gradient">Architectures</span>
              </h2>
              <p className="text-muted-foreground">
                Foundational practices for a compelling resume.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tips.map((tip) => (
                <Card key={tip.title} className="group">
                  <CardContent className="p-6 flex flex-col gap-4 h-full">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <tip.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-lg">{tip.title}</h3>
                    <p className="text-sm text-muted-foreground flex-grow">
                      {tip.description}
                    </p>
                  </CardContent>
                </Card>
              ))}

              {/* Wide card */}
              <Card className="md:col-span-2 group">
                <CardContent className="p-6 flex flex-col gap-4 h-full">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <LuTrendingUp className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-lg">
                    Quantifying Achievements
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Don&apos;t just list responsibilities. Use data and metrics
                    to quantify your success. &quot;Increased sales by 15% over
                    Q3&quot; is stronger than &quot;Responsible for sales.&quot;
                  </p>
                </CardContent>
              </Card>

              {/* CTA card */}
              <Card className="bg-primary text-primary-foreground border-primary flex items-center justify-center text-center">
                <CardContent className="p-6 flex flex-col items-center gap-4">
                  <h3 className="text-lg font-semibold">
                    Ready to apply these?
                  </h3>
                  <p className="text-sm text-primary-foreground/80">
                    Our builder handles the formatting so you can focus on the
                    content.
                  </p>
                  <Link href="/cv">
                    <Button
                      variant="secondary"
                      className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                    >
                      Start Building
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Deep Dives */}
        {/* <section className="py-16 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-3xl font-bold mb-2">Deep Dives</h2>
                <p className="text-muted-foreground">
                  Comprehensive guides for specific career stages.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {articles.map((article) => (
                <div
                  key={article.title}
                  className="group flex flex-col md:flex-row gap-6 p-4 rounded-lg border border-transparent hover:border-border hover:bg-card transition-colors"
                >
                  <div className="w-full md:w-40 h-28 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                    <article.icon className="h-10 w-10 text-primary/60" />
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{article.badge}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {article.readTime}
                      </span>
                    </div>
                    <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {article.title}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {article.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section> */}

        {/* CTA Section */}
        <section className="py-20 bg-card border-t border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Put these tips into practice
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Build your Master CV once, and let ResumeAI tailor it for every
              job you apply to.
            </p>
            <Link href="/signup">
              <Button size="xl">
                Get Started Free
                <LuArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
