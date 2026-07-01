import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  LuCompass,
  LuRocket,
  LuShieldCheck,
  LuSparkles,
  LuTarget,
} from "react-icons/lu";

export const metadata = {
  title: "About Us - ResumeAI",
  description:
    "Learn about ResumeAI's mission to help professionals build job-winning resumes with the power of AI.",
};

const values = [
  {
    icon: LuCompass,
    title: "Precision",
    description:
      "Every template is meticulously structured for optimal readability and impact.",
  },
  {
    icon: LuTarget,
    title: "Technology",
    description:
      "Leveraging AI to ensure your resume passes modern ATS filters every time.",
  },
];

const timeline = [
  {
    year: "The Blueprint",
    title: "Identifying the Problem",
    description:
      "We noticed highly qualified professionals being rejected due to poor document formatting and generic resumes. The idea for a precision-focused, AI-driven resume builder was born.",
  },
  {
    year: "Development",
    title: "Building the Engine",
    description:
      "We built an AI pipeline that understands job descriptions and aligns your experience with what recruiters and applicant tracking systems are actually looking for.",
  },
  {
    year: "Today",
    title: "Helping Job Seekers Everywhere",
    description:
      "ResumeAI is live, offering a seamless, distraction-free environment for professionals to build documents that move their careers forward.",
  },
];

const team = [
  {
    name: "Elena Rostova",
    role: "Founder & CEO",
    description:
      "Former HR Director turning recruitment inefficiencies into streamlined tech solutions.",
  },
  {
    name: "David Chen",
    role: "Lead Architect",
    description:
      "Ensures the platform's logic aligns perfectly with modern Applicant Tracking Systems.",
  },
  {
    name: "Sarah Jenkins",
    role: "Head of Design",
    description:
      "Advocates for whitespace and clarity to reduce cognitive load for every user.",
  },
  {
    name: "Marcus Thorne",
    role: "Career Strategist",
    description:
      "Bridges the gap between software output and real hiring manager expectations.",
  },
];

export default function AboutUsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="hero-pattern"></div>
          <div className="glow-orb glow-orb-primary"></div>
          <div className="glow-orb glow-orb-secondary"></div>

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
            <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm gap-2">
              <LuSparkles className="h-4 w-4" />
              About ResumeAI
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 leading-tight">
              Engineering Your{" "}
              <span className="text-gradient">Professional Future</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              We believe a resume is more than a document — it&apos;s the
              architecture of your career. ResumeAI blends AI with deep
              industry expertise to build pathways to success.
            </p>
          </div>
        </section>

        {/* Mission Section */}
        <section className="pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-12 gap-6">
              <Card className="md:col-span-8 flex flex-col justify-center p-8">
                <CardContent className="p-0">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <LuRocket className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                    Our Mission
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    To demystify the hiring process through precision-engineered
                    tools. We empower modern professionals by translating
                    complex career histories into compelling, algorithm-friendly
                    narratives that demand attention. We don&apos;t just format
                    text — we optimize potential.
                  </p>
                </CardContent>
              </Card>

              <div className="md:col-span-4 flex flex-col gap-6">
                {values.map((value) => (
                  <Card key={value.title} className="flex-1">
                    <CardContent className="p-6 flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                        <value.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{value.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {value.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Timeline Section */}
        <section className="py-20 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-16">
              The Story of <span className="text-gradient">ResumeAI</span>
            </h2>

            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"></div>
              <div className="flex flex-col gap-10">
                {timeline.map((item, index) => (
                  <div key={item.title} className="relative flex gap-6">
                    <div
                      className={`relative z-10 w-8 h-8 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        index === timeline.length - 1
                          ? "bg-primary border-primary"
                          : "bg-background border-primary"
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full bg-primary-foreground/80"></div>
                    </div>
                    <div className="bg-background rounded-xl border border-border p-6 flex-1">
                      <span className="text-sm font-medium text-primary mb-2 block">
                        {item.year}
                      </span>
                      <h4 className="text-lg font-semibold mb-2">
                        {item.title}
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                The Experts Behind the Platform
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A multidisciplinary team dedicated to optimizing the
                intersection of technology and human potential.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {team.map((member) => (
                <Card key={member.name} className="text-center">
                  <CardContent className="pt-8 pb-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center mx-auto mb-4 text-primary font-semibold text-xl">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <h4 className="font-semibold">{member.name}</h4>
                    <p className="text-sm text-primary mb-2">{member.role}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Trust Strip */}
        <section className="pb-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-br from-primary/10 via-transparent to-accent/10 rounded-3xl p-10 border border-border flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <LuShieldCheck className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">
                  Built on trust and precision
                </h3>
                <p className="text-muted-foreground">
                  Your data stays yours. We build tools that respect your
                  privacy while helping you land the interview.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
