'use client';

import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Editor from '@monaco-editor/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
    LuArrowRight,
    LuBriefcase,
    LuCheck,
    LuCopy, LuDownload,
    LuExternalLink,
    LuFileOutput,
    LuFileQuestion,
    LuLoader,
    LuSparkles
} from 'react-icons/lu';

export default function TailorPage() {
  const [jobDescription, setJobDescription] = useState('');
  const [masterCV, setMasterCV] = useState(null);
  const [tailoredLatex, setTailoredLatex] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [message, setMessage] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkMasterCV();
  }, []);

  const checkMasterCV = async () => {
    try {
      const res = await fetch('/api/cv');
      if (res.ok) {
        const data = await res.json();
        if (data && data.personal_info) {
          setMasterCV(data);
        }
      }
    } catch (error) {
      console.error("Error fetching master CV", error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const tailorResume = async () => {
    if (!jobDescription.trim()) {
      showMessage('Please enter a job description', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/resume/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          masterCV, 
          jobDescription 
        })
      });

      const data = await res.json();
      
      if (res.ok && data.latex) {
        setTailoredLatex(data.latex);
        showMessage('Resume tailored successfully!', 'success');
      } else {
        showMessage(data.error || 'Failed to tailor resume', 'error');
      }
    } catch (error) {
      showMessage('Failed to generate resume. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(tailoredLatex);
      setCopied(true);
      showMessage('Copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showMessage('Failed to copy', 'error');
    }
  };

  const downloadTeX = () => {
    const element = document.createElement('a');
    const file = new Blob([tailoredLatex], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = 'resume.tex';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center relative">
          <div className="hero-pattern"></div>
          <div className="glow-orb glow-orb-primary"></div>
          <LuLoader className="animate-spin text-primary" size={40} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 relative">
        {/* Background Elements */}
        <div className="hero-pattern"></div>
        <div className="glow-orb glow-orb-primary"></div>
        <div className="glow-orb glow-orb-secondary"></div>

        {/* Toast Message */}
        {message && (
          <div className={`toast ${message.type === 'success' ? 'toast-success' : 'toast-error'} flex items-center gap-2`}>
            {message.text}
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <LuSparkles className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">Tailor Resume</h1>
              </div>
              <p className="text-muted-foreground">
                Customize your resume for a specific job application
              </p>
            </div>
          </div>

          {!masterCV ? (
            /* No Master CV State */
            <Card className="animate-[fade-in-up_0.5s_ease-out_forwards]">
              <CardContent className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
                  <LuFileQuestion className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-semibold mb-3">No Master CV Found</h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  You need to create a Master CV before you can tailor it for specific jobs.
                  Your Master CV serves as the source of truth for all your experience.
                </p>
                <Link href="/cv">
                  <Button size="lg">
                    Create Master CV <LuArrowRight className="ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            /* Split View Editor */
            <div className="grid lg:grid-cols-2 gap-6 animate-[fade-in-up_0.5s_ease-out_forwards]">
              
              {/* Left Column: Job Description */}
              <div className="flex flex-col h-[calc(100vh-240px)] min-h-[500px]">
                <Card className="flex-1 flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LuBriefcase className="h-5 w-5 text-primary" /> Job Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="relative flex-1">
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the job description here...

Key Responsibilities:
- Experience with React and Node.js
- Knowledge of AWS infrastructure
- 5+ years of software development..."
                        className="textarea-field h-full absolute inset-0 resize-none font-mono text-sm leading-relaxed"
                      />
                    </div>
                    
                    <Button 
                      onClick={tailorResume}
                      disabled={loading}
                      className="w-full mt-6"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <LuLoader className="animate-spin mr-2" />
                          Analyzing & Tailoring...
                        </>
                      ) : (
                        <>
                          <LuSparkles className="mr-2" /> Generate Tailored Resume
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Result */}
              <div className="flex flex-col h-[calc(100vh-240px)] min-h-[500px]">
                <Card className="flex-1 flex flex-col overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <LuFileOutput className="h-5 w-5 text-primary" /> Tailored Resume (LaTeX)
                    </CardTitle>
                    
                    {tailoredLatex && (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={copyToClipboard}
                          title="Copy to Clipboard"
                        >
                          {copied ? <LuCheck className="h-4 w-4 text-primary" /> : <LuCopy className="h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={downloadTeX}
                          title="Download .tex"
                        >
                          <LuDownload className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col overflow-hidden pb-4">
                    {tailoredLatex ? (
                      <div className="flex-1 border border-border rounded-lg overflow-hidden bg-[#1e1e1e]">
                        <Editor
                          height="100%"
                          defaultLanguage="latex"
                          value={tailoredLatex}
                          theme="vs-dark"
                          options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            scrollBeyondLastLine: false,
                            padding: { top: 16, bottom: 16 },
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-lg bg-muted/30">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <LuFileOutput className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium mb-2">Ready to Generate</h3>
                        <p className="text-muted-foreground max-w-sm">
                          Paste a job description on the left and click "Generate Tailored Resume" to create your ATS-optimized LaTeX code.
                        </p>
                      </div>
                    )}

                    <div className="mt-4 p-4 rounded-lg bg-accent/50 border border-accent">
                      <h3 className="font-semibold mb-2 flex items-center gap-2 text-foreground">
                        <LuExternalLink className="h-4 w-4" /> Compile Online
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        To generate the PDF, copy the code above and paste it into Overleaf.
                      </p>
                      <a 
                        href="https://www.overleaf.com/project" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                        onClick={(e) => {
                          if (tailoredLatex) {
                            e.preventDefault();
                            copyToClipboard();
                            window.open('https://www.overleaf.com/project', '_blank');
                          }
                        }}
                      >
                        Open Overleaf <LuExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
