import { Footer } from "@/components/Footer";
import { LegalToc } from "@/components/LegalToc";
import { Navbar } from "@/components/Navbar";
import {
  LuCircleCheck,
  LuCookie,
  LuDatabase,
  LuLock,
  LuUserCog,
} from "react-icons/lu";

export const metadata = {
  title: "Privacy Policy - ResumeAI",
  description:
    "Read ResumeAI's privacy policy to understand how we collect, use, and protect your personal data.",
};

const tocItems = [
  { id: "introduction", label: "Introduction" },
  { id: "data-collection", label: "Data Collection" },
  { id: "usage", label: "Usage" },
  { id: "security", label: "Security" },
  // { id: "cookies", label: "Cookies" },
  // { id: "contact", label: "Contact Us" },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="mb-12 max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground">Last updated: July 1, 2026</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Table of Contents */}
          <aside className="md:col-span-4 lg:col-span-3 hidden md:block sticky top-24 rounded-xl bg-card border border-border p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Contents
            </h2>
            <LegalToc items={tocItems} />
          </aside>

          {/* Document */}
          <article className="md:col-span-8 lg:col-span-9 bg-card rounded-xl border border-border p-6 md:p-10">
            <section id="introduction" className="mb-10 scroll-mt-24">
              <p className="text-muted-foreground leading-relaxed">
                Welcome to ResumeAI&apos;s Privacy Policy. We respect your
                privacy and are committed to protecting your personal data. This
                policy explains how we look after your personal data when you
                use our website and tells you about your privacy rights and how
                the law protects you.
              </p>
            </section>

            <hr className="border-border mb-10" />

            <section id="data-collection" className="mb-10 scroll-mt-24">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <LuDatabase className="h-5 w-5 text-primary" />
                Data Collection
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We may collect, use, store and transfer different kinds of
                personal data about you, grouped as follows:
              </p>
              <ul className="list-disc list-outside ml-6 text-muted-foreground space-y-2">
                <li>
                  <strong className="text-foreground">Identity Data</strong>{" "}
                  includes your first name, last name, and username or similar
                  identifier.
                </li>
                <li>
                  <strong className="text-foreground">Contact Data</strong>{" "}
                  includes your email address and any phone number you provide.
                </li>
                <li>
                  <strong className="text-foreground">Professional Data</strong>{" "}
                  includes your employment history, educational background,
                  skills, and any other information you provide when using our
                  resume building tools.
                </li>
                <li>
                  <strong className="text-foreground">Technical Data</strong>{" "}
                  includes your IP address, login data, browser type and
                  version, time zone setting and location.
                </li>
              </ul>
            </section>

            <section id="usage" className="mb-10 scroll-mt-24">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <LuUserCog className="h-5 w-5 text-primary" />
                Usage
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We will only use your personal data when the law allows us to.
                Most commonly, we use your personal data in the following
                circumstances:
              </p>
              <div className="bg-background rounded-lg p-4 border border-border">
                <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <LuCircleCheck className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>
                      Where we need to perform the contract we have entered into
                      with you (e.g., providing the resume generation service).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <LuCircleCheck className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>
                      Where it is necessary for our legitimate interests and
                      your interests and fundamental rights do not override
                      those interests.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <LuCircleCheck className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>
                      Where we need to comply with a legal obligation.
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            <section id="security" className="mb-10 scroll-mt-24">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <LuLock className="h-5 w-5 text-primary" />
                Security
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We have put in place appropriate security measures to prevent
                your personal data from being accidentally lost, used, or
                accessed in an unauthorized way, altered, or disclosed. We limit
                access to your personal data to those who have a genuine
                business need to know it.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We have put in place procedures to deal with any suspected
                personal data breach and will notify you and any applicable
                regulator of a breach where we are legally required to do so.
              </p>
            </section>

            {/* <section id="cookies" className="mb-10 scroll-mt-24">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <LuCookie className="h-5 w-5 text-primary" />
                Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You can set your browser to refuse all or some browser
                cookies, or to alert you when websites set or access cookies.
                If you disable or refuse cookies, please note that some parts
                of this website may become inaccessible or not function
                properly.
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-background text-sm">
                      <th className="p-3 border-b border-border font-semibold">
                        Cookie Type
                      </th>
                      <th className="p-3 border-b border-border font-semibold">
                        Purpose
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-muted-foreground">
                    <tr>
                      <td className="p-3 border-b border-border font-medium text-foreground">
                        Essential
                      </td>
                      <td className="p-3 border-b border-border">
                        Required for basic site functionality and security.
                        Cannot be disabled.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 border-b border-border font-medium text-foreground">
                        Analytics
                      </td>
                      <td className="p-3 border-b border-border">
                        Helps us understand how visitors interact with the
                        website so we can improve it.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-foreground">
                        Preferences
                      </td>
                      <td className="p-3">
                        Remembers choices you make, such as your theme (light
                        or dark mode).
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section> */}

            {/* <section
              id="contact"
              className="scroll-mt-24 bg-background p-6 rounded-lg border border-border"
            >
              <h3 className="text-lg font-semibold mb-2">Questions?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                If you have any questions about this privacy policy or our
                privacy practices, please reach out to our team.
              </p>
              <a
                href="mailto:privacy@resumeai.app"
                className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Contact Privacy Team
              </a>
            </section> */}
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
