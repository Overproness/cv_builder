import { ContactForm } from "@/components/ContactForm";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { LuClock, LuGithub, LuLinkedin, LuMail, LuTwitter } from "react-icons/lu";

export const metadata = {
  title: "Contact Us - ResumeAI",
  description:
    "Get in touch with the ResumeAI team for support, feedback, or partnership inquiries.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 relative">
        <div className="hero-pattern"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              Get in <span className="text-gradient">touch</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Have questions about optimizing your resume? Need technical
              support? Our team is here to help you advance your career
              journey.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Contact Info */}
            <div className="lg:col-span-5">
              <Card className="h-full flex flex-col justify-center">
                <CardContent className="p-8">
                  <h2 className="text-xl font-semibold mb-6">
                    Contact Information
                  </h2>
                  <ul className="space-y-6">
                    <li className="flex items-start gap-4">
                      <div className="bg-accent p-3 rounded-full flex-shrink-0 text-primary">
                        <LuMail className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">Email Support</h3>
                        <p className="text-sm text-muted-foreground mb-1">
                          Our team typically responds within 2 business days.
                        </p>
                        <a
                          href="mailto:support@resumeai.app"
                          className="text-primary hover:underline font-medium"
                        >
                          support@resumeai.app
                        </a>
                      </div>
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="bg-accent p-3 rounded-full flex-shrink-0 text-primary">
                        <LuClock className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">Support Hours</h3>
                        <p className="text-sm text-muted-foreground">
                          Monday – Friday
                          <br />
                          9:00 AM – 6:00 PM (GMT)
                        </p>
                      </div>
                    </li>
                  </ul>

                  <div className="mt-8 pt-8 border-t border-border">
                    <h3 className="font-medium mb-4">Connect with us</h3>
                    <div className="flex gap-3">
                      {[
                        { icon: LuTwitter, label: "Twitter" },
                        { icon: LuGithub, label: "GitHub" },
                        { icon: LuLinkedin, label: "LinkedIn" },
                      ].map((social) => (
                        <a
                          key={social.label}
                          href="#"
                          aria-label={social.label}
                          className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                        >
                          <social.icon className="h-4 w-4" />
                        </a>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-7">
              <Card>
                <CardContent className="p-8">
                  <h2 className="text-xl font-semibold mb-2">
                    Send us a message
                  </h2>
                  <p className="text-sm text-muted-foreground mb-8">
                    Fill out the form below and we&apos;ll get back to you shortly.
                  </p>
                  <ContactForm />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
