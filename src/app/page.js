import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import {
    LuArrowRight,
    LuCheck,
    LuDownload,
    LuFileText,
    LuShield,
    LuSparkles,
    LuStar,
    LuTarget,
    LuTrendingUp,
    LuUsers,
    LuZap
} from 'react-icons/lu';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background Elements */}
          <div className="hero-pattern"></div>
          <div className="glow-orb glow-orb-primary"></div>
          <div className="glow-orb glow-orb-secondary"></div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
            <div className="text-center max-w-4xl mx-auto">
              {/* Badge */}
              <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm gap-2">
                <LuSparkles className="h-4 w-4" />
                AI-Powered Resume Builder
              </Badge>
              
              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
                Build a Job-Winning{' '}
                <span className="text-gradient">Resume</span>
                <br />
                Effortlessly with AI
              </h1>
              
              {/* Subtitle */}
              <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                Stop rewriting your resume for every job. Maintain one Master CV and let our AI 
                tailor it perfectly for each application in seconds.
              </p>
              
              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link href="/signup">
                  <Button size="xl" className="w-full sm:w-auto">
                    Get Started Free
                    <LuArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button variant="outline" size="xl" className="w-full sm:w-auto">
                    Learn More
                  </Button>
                </Link>
              </div>
              
              {/* Social Proof */}
              <div className="flex items-center justify-center gap-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent border-2 border-background flex items-center justify-center text-xs font-medium text-primary"
                    >
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <LuStar key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">20,000+</span> resumes created
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="py-24 bg-card" id="why-choose">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Why do you need an <span className="text-gradient">AI resume maker?</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Traditional resume building is time-consuming. Our AI understands what recruiters want.
              </p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: LuZap,
                  title: "Save Time",
                  description: "Generate tailored resumes in seconds, not hours"
                },
                {
                  icon: LuShield,
                  title: "ATS-Friendly",
                  description: "Our resumes pass all Applicant Tracking Systems"
                },
                {
                  icon: LuTarget,
                  title: "Targeted Content",
                  description: "AI matches your skills to job requirements"
                },
                {
                  icon: LuTrendingUp,
                  title: "Higher Response",
                  description: "Get more interviews with optimized resumes"
                }
              ].map((feature, index) => (
                <Card key={index} className="text-center p-6 hover:border-primary/50">
                  <CardContent className="pt-6">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <feature.icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24" id="how-it-works">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Create the <span className="text-gradient">perfect resume</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Three simple steps to your dream job
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  icon: LuFileText,
                  title: "Build Your Master CV",
                  description: "Dump all your experience, skills, and projects into one place. Our AI structures it into a comprehensive master record."
                },
                {
                  step: "02",
                  icon: LuTarget,
                  title: "Paste the Job Description",
                  description: "Copy the job listing you want to apply for. Our AI analyzes keywords and requirements instantly."
                },
                {
                  step: "03",
                  icon: LuDownload,
                  title: "Export Your Resume",
                  description: "Get a perfectly tailored, ATS-friendly PDF resume that highlights exactly why you're the best fit."
                }
              ].map((step, index) => (
                <Card key={index} className="relative overflow-hidden group hover:border-primary/50">
                  <div className="absolute top-4 right-4 text-6xl font-bold text-primary/10 group-hover:text-primary/20 transition-colors">
                    {step.step}
                  </div>
                  <CardContent className="pt-8 pb-8 px-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6">
                      <step.icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features Showcase Section */}
        <section className="py-24 bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="secondary" className="mb-4">Powerful Features</Badge>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                  AI-Powered Resume <span className="text-gradient">Tailoring</span> for Every Job
                </h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  Our intelligent system analyzes job descriptions and automatically highlights 
                  your most relevant experience, skills, and achievements.
                </p>
                
                <ul className="space-y-4 mb-8">
                  {[
                    "Smart keyword matching with job requirements",
                    "Professional LaTeX templates for clean formatting",
                    "One-click PDF export ready for applications",
                    "Secure cloud storage for all your resumes"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <LuCheck className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link href="/cv">
                  <Button size="lg">
                    Try It Now
                    <LuArrowRight className="ml-2" />
                  </Button>
                </Link>
              </div>
              
              {/* Mockup/Preview Card */}
              <div className="relative">
                <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl p-8 border border-border">
                  <div className="bg-card rounded-xl shadow-xl overflow-hidden">
                    <div className="bg-muted px-4 py-3 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-destructive/50"></div>
                      <div className="w-3 h-3 rounded-full bg-chart-4/50"></div>
                      <div className="w-3 h-3 rounded-full bg-primary/50"></div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <LuUsers className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                          <div className="h-4 w-32 bg-muted rounded mb-2"></div>
                          <div className="h-3 w-24 bg-muted/70 rounded"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-full bg-muted rounded"></div>
                        <div className="h-3 w-3/4 bg-muted rounded"></div>
                        <div className="h-3 w-5/6 bg-muted rounded"></div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="accent">React</Badge>
                        <Badge variant="accent">Node.js</Badge>
                        <Badge variant="accent">Python</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Loved by <span className="text-gradient">professionals</span> worldwide
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Join thousands who have landed their dream jobs with ResumeAI
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote: "I was spending hours customizing my resume for each job. Now it takes me 2 minutes. Absolutely game-changing!",
                  author: "Sarah Chen",
                  role: "Software Engineer",
                  company: "Google"
                },
                {
                  quote: "The AI perfectly highlights my relevant experience. I've gotten 3x more interview callbacks since using this tool.",
                  author: "Marcus Johnson",
                  role: "Product Manager",
                  company: "Meta"
                },
                {
                  quote: "Clean, professional templates that actually pass ATS systems. Worth every penny.",
                  author: "Emily Rodriguez",
                  role: "Data Scientist",
                  company: "Amazon"
                }
              ].map((testimonial, index) => (
                <Card key={index} className="p-6">
                  <CardContent className="pt-0">
                    <div className="flex gap-1 mb-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <LuStar key={i} className="h-5 w-5 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-foreground mb-6 leading-relaxed">"{testimonial.quote}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center text-primary font-semibold">
                        {testimonial.author.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{testimonial.author}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role} at {testimonial.company}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-card">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bg-gradient-to-br from-primary/10 via-transparent to-accent/10 rounded-3xl p-12 border border-border">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Ready to Land Your Dream Job?
              </h2>
              <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                Join thousands of professionals who are saving hours on applications 
                while increasing their interview rate.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <Button size="xl">
                    Get Started Free
                    <LuArrowRight className="ml-2" />
                  </Button>
                </Link>
                <Link href="/cv">
                  <Button variant="outline" size="xl">
                    Try Demo
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
