import { Footer } from "@/components/Footer";
import { LegalToc } from "@/components/LegalToc";
import { Navbar } from "@/components/Navbar";

export const metadata = {
  title: "Terms and Conditions - ResumeAI",
  description:
    "Read the terms and conditions for using ResumeAI's resume building platform.",
};

const tocItems = [
  { id: "introduction", label: "1. Introduction" },
  { id: "user-obligations", label: "2. User Obligations" },
  { id: "intellectual-property", label: "3. Intellectual Property" },
  { id: "limitation-of-liability", label: "4. Limitation of Liability" },
  { id: "termination", label: "5. Termination" },
];

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="mb-12 pb-8 border-b border-border max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Terms and Conditions
          </h1>
          <p className="text-muted-foreground">Last updated: July 1, 2026</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Table of Contents */}
          <aside className="hidden md:block md:col-span-3">
            <div className="sticky top-24 bg-card border border-border rounded-xl p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Contents
              </h3>
              <LegalToc items={tocItems} />
            </div>
          </aside>

          {/* Legal Document */}
          <div className="col-span-1 md:col-span-9 bg-card border border-border rounded-xl p-6 md:p-10">
            <section id="introduction" className="mb-10 scroll-mt-24">
              <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Welcome to ResumeAI. By accessing or using our resume building
                platform, you agree to be bound by these Terms and Conditions.
                Please read them carefully. If you do not agree with any part
                of these terms, you are prohibited from using or accessing
                this site.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                These terms apply to all visitors, users, and others who
                access or use the Service. We reserve the right to update or
                modify these terms at any time, and your continued use of the
                Service following any such changes constitutes your acceptance
                of the revised terms.
              </p>
            </section>

            <section id="user-obligations" className="mb-10 scroll-mt-24">
              <h2 className="text-xl font-semibold mb-4">
                2. User Obligations
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                As a user of the ResumeAI platform, you are responsible for
                maintaining the confidentiality of your account and password.
                You agree to accept responsibility for all activities that
                occur under your account.
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>
                  You must provide accurate, complete, and current information
                  when creating an account.
                </li>
                <li>
                  You may not use the Service for any illegal or unauthorized
                  purpose.
                </li>
                <li>
                  You must not transmit any worms, viruses, or any code of a
                  destructive nature.
                </li>
                <li>
                  You agree not to reproduce, duplicate, copy, sell, resell, or
                  exploit any portion of the Service without permission.
                </li>
              </ul>
            </section>

            <section id="intellectual-property" className="mb-10 scroll-mt-24">
              <h2 className="text-xl font-semibold mb-4">
                3. Intellectual Property
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Service and its original content, features, and
                functionality are and will remain the exclusive property of
                ResumeAI and its licensors. The Service is protected by
                copyright, trademark, and other applicable laws.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Our trademarks and trade dress may not be used in connection
                with any product or service without our prior written consent.
                Templates and design assets provided within the platform are
                licensed to you solely for creating your personal resume and
                may not be extracted or redistributed.
              </p>
            </section>

            <section
              id="limitation-of-liability"
              className="mb-10 scroll-mt-24"
            >
              <h2 className="text-xl font-semibold mb-4">
                4. Limitation of Liability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                In no event shall ResumeAI, nor its directors, employees,
                partners, agents, suppliers, or affiliates, be liable for any
                indirect, incidental, special, consequential, or punitive
                damages, including without limitation loss of profits, data,
                use, goodwill, or other intangible losses, resulting from your
                access to or use of, or inability to access or use, the
                Service.
              </p>
            </section>

            <section id="termination" className="scroll-mt-24">
              <h2 className="text-xl font-semibold mb-4">5. Termination</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We may terminate or suspend your account and bar access to the
                Service immediately, without prior notice or liability, at our
                sole discretion, for any reason, including but not limited to
                a breach of the Terms.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                If you wish to terminate your account, you may simply
                discontinue using the Service. All provisions of the Terms
                which by their nature should survive termination shall
                survive, including ownership provisions, warranty disclaimers,
                indemnity, and limitations of liability.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
