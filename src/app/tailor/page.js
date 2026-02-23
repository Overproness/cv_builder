"use client";

import { Footer } from "@/components/Footer";
import { useLatexCompiler } from "@/components/LatexCompiler";
import { Navbar } from "@/components/Navbar";
import PdfPreview from "@/components/PdfPreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assembleCoverLetter,
  downloadCoverLetterAsDocx,
  printCoverLetterAsPdf,
  renderCoverLetterHtml,
} from "@/lib/coverLetterUtils";
import Editor from "@monaco-editor/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LuArrowRight,
  LuBriefcase,
  LuCheck,
  LuCopy,
  LuDownload,
  LuExternalLink,
  LuEye,
  LuFileOutput,
  LuFilePen,
  LuFileQuestion,
  LuFileText,
  LuFiles,
  LuLoader,
  LuSave,
  LuSparkles,
} from "react-icons/lu";

export default function TailorPage() {
  // CV management
  const [allCVs, setAllCVs] = useState([]);
  const [selectedCVId, setSelectedCVId] = useState("");
  const [masterCV, setMasterCV] = useState(null);
  const [loadingCVs, setLoadingCVs] = useState(true);

  // Job details
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  // Generation options
  const [genResume, setGenResume] = useState(true);
  const [genCoverLetter, setGenCoverLetter] = useState(false);
  const [wordCount, setWordCount] = useState(250);

  // User settings for cover letter header
  const [userSettings, setUserSettings] = useState({
    displayName: "",
    phone: "",
    coverLetterEmail: "",
  });

  // Results
  const [tailoredLatex, setTailoredLatex] = useState("");
  const [tailoredCV, setTailoredCV] = useState(null);
  const [coverLetterContent, setCoverLetterContent] = useState("");
  const [activeTab, setActiveTab] = useState("resume");
  const [loading, setLoading] = useState(false);

  // Save state
  const [savedResumeId, setSavedResumeId] = useState(null);
  const [savedCLId, setSavedCLId] = useState(null);
  const [savingResume, setSavingResume] = useState(false);
  const [savingCL, setSavingCL] = useState(false);

  // PDF compilation
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  // Toast
  const [message, setMessage] = useState(null);

  const {
    compileLatexOnServer,
    isEngineReady,
    isLoading: engineLoading,
    loadingProgress,
    error: engineError,
  } = useLatexCompiler();

  useEffect(() => {
    loadAllCVs();
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setUserSettings({
          displayName: data.settings?.displayName || data.name || "",
          phone: data.settings?.phone || "",
          coverLetterEmail: data.settings?.coverLetterEmail || data.email || "",
        });
        if (data.settings?.coverLetterWordCount) {
          setWordCount(data.settings.coverLetterWordCount);
        }
      }
    } catch {
      // silently ignore — defaults remain
    }
  };

  useEffect(() => {
    if (selectedCVId) {
      loadSelectedCV(selectedCVId);
    }
  }, [selectedCVId]);

  const loadAllCVs = async () => {
    try {
      const res = await fetch("/api/cv?all=true");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAllCVs(data);
          setSelectedCVId(data[0]._id);
        }
      }
    } catch (error) {
      console.error("Error loading CVs", error);
    } finally {
      setLoadingCVs(false);
    }
  };

  const loadSelectedCV = async (id) => {
    try {
      const res = await fetch(`/api/cv?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setMasterCV(data);
      }
    } catch (error) {
      console.error("Error loading CV", error);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      showMessage("Please enter a job description", "error");
      return;
    }
    if (!masterCV) {
      showMessage("Please select a Master CV", "error");
      return;
    }
    if (!genResume && !genCoverLetter) {
      showMessage("Please select at least one generation option", "error");
      return;
    }

    setLoading(true);
    setPdfBlob(null);
    setShowPdfPreview(false);
    setSavedResumeId(null);
    setSavedCLId(null);
    setTailoredLatex("");
    setCoverLetterContent("");

    try {
      const promises = [];

      if (genResume) {
        promises.push(
          fetch("/api/resume/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ masterCV, jobDescription }),
          }).then((r) =>
            r.json().then((d) => ({ type: "resume", data: d, ok: r.ok })),
          ),
        );
      }

      if (genCoverLetter) {
        promises.push(
          fetch("/api/cover-letter/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              masterCV,
              jobDescription,
              company,
              position,
              wordCount,
            }),
          }).then((r) =>
            r.json().then((d) => ({ type: "cl", data: d, ok: r.ok })),
          ),
        );
      }

      const results = await Promise.all(promises);
      let success = false;

      for (const result of results) {
        if (result.type === "resume") {
          if (result.ok && result.data.latex) {
            setTailoredLatex(result.data.latex);
            setTailoredCV(result.data.tailoredCV);
            success = true;
            if (genResume && !genCoverLetter) setActiveTab("resume");
          } else {
            showMessage(
              result.data.error || "Failed to tailor resume",
              "error",
            );
          }
        } else if (result.type === "cl") {
          if (result.ok && result.data.content) {
            // Assemble full formatted letter: header (from user settings) + body (from AI)
            const assembled = assembleCoverLetter({
              name:
                userSettings.displayName || masterCV?.personal_info?.name || "",
              email:
                userSettings.coverLetterEmail ||
                masterCV?.personal_info?.email ||
                "",
              phone: userSettings.phone || masterCV?.personal_info?.phone || "",
              company: company || "",
              body: result.data.content,
            });
            setCoverLetterContent(assembled);
            success = true;
            if (!genResume && genCoverLetter) setActiveTab("coverletter");
          } else {
            showMessage(
              result.data.error || "Failed to generate cover letter",
              "error",
            );
          }
        }
      }

      if (success) {
        if (genResume && genCoverLetter) setActiveTab("resume");
        showMessage("Generated successfully!", "success");
      }
    } catch (error) {
      showMessage("Failed to generate. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const saveResume = async () => {
    if (!tailoredLatex) return;
    setSavingResume(true);
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:
            company && position
              ? `${position} at ${company}`
              : "Tailored Resume",
          company,
          position,
          jobDescription,
          latex: tailoredLatex,
          tailoredCV,
          masterCVId: selectedCVId || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedResumeId(data.id);
        showMessage("Resume saved to your account!", "success");
      } else {
        showMessage(data.error || "Failed to save resume", "error");
      }
    } catch {
      showMessage("Failed to save resume", "error");
    } finally {
      setSavingResume(false);
    }
  };

  const saveCoverLetter = async () => {
    if (!coverLetterContent) return;
    setSavingCL(true);
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:
            company && position ? `${position} at ${company}` : "Cover Letter",
          company,
          position,
          jobDescription,
          content: coverLetterContent,
          masterCVId: selectedCVId || null,
          resumeId: savedResumeId || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedCLId(data.id);
        showMessage("Cover letter saved to your account!", "success");
      } else {
        showMessage(data.error || "Failed to save cover letter", "error");
      }
    } catch {
      showMessage("Failed to save cover letter", "error");
    } finally {
      setSavingCL(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(tailoredLatex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showMessage("Failed to copy", "error");
    }
  };

  const downloadTeX = () => {
    const a = document.createElement("a");
    const file = new Blob([tailoredLatex], { type: "text/plain" });
    a.href = URL.createObjectURL(file);
    a.download = "resume.tex";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openInOverleaf = () => {
    if (!tailoredLatex) return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://www.overleaf.com/docs";
    form.target = "_blank";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "snip";
    input.value = tailoredLatex;
    const nameInput = document.createElement("input");
    nameInput.type = "hidden";
    nameInput.name = "snip_name";
    nameInput.value = "resume.tex";
    form.appendChild(input);
    form.appendChild(nameInput);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const compilePdf = async () => {
    if (!tailoredLatex) return;
    setIsCompiling(true);
    try {
      const pdfResult = await compileLatexOnServer(tailoredLatex);
      if (pdfResult) {
        setPdfBlob(pdfResult);
        setShowPdfPreview(true);
        showMessage("PDF compiled successfully!", "success");
      } else {
        showMessage("PDF compilation failed.", "error");
      }
    } catch (err) {
      showMessage(`Compilation error: ${err.message}`, "error");
    } finally {
      setIsCompiling(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCVDisplayName = (cv) => {
    return (
      cv.cv_name ||
      cv.personal_info?.name ||
      `CV (${new Date(cv.updatedAt).toLocaleDateString()})`
    );
  };

  if (loadingCVs) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
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
        <div className="hero-pattern" />
        <div className="glow-orb glow-orb-primary" />
        <div className="glow-orb glow-orb-secondary" />

        {/* Toast */}
        {message && (
          <div
            className={`toast ${message.type === "success" ? "toast-success" : "toast-error"} flex items-center gap-2`}
          >
            {message.text}
          </div>
        )}

        {/* PDF Preview Modal */}
        {showPdfPreview && pdfBlob && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <PdfPreview
                pdfBlob={pdfBlob}
                latexSource={tailoredLatex}
                fileName="tailored_resume.pdf"
                onClose={() => setShowPdfPreview(false)}
                className="h-full"
              />
            </div>
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
                <h1 className="text-2xl sm:text-3xl font-bold">
                  AI Resume &amp; Cover Letter
                </h1>
              </div>
              <p className="text-muted-foreground">
                Generate a tailored resume and personalized cover letter for any
                job
              </p>
            </div>
            <Link href="/documents">
              <Button
                variant="outline"
                className="hidden sm:flex items-center gap-2"
              >
                <LuFiles className="h-4 w-4" />
                My Documents
              </Button>
            </Link>
          </div>

          {allCVs.length === 0 ? (
            /* No CVs */
            <Card className="animate-[fade-in-up_0.5s_ease-out_forwards]">
              <CardContent className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
                  <LuFileQuestion className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-semibold mb-3">
                  No Master CV Found
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  You need to create a Master CV before generating tailored
                  resumes and cover letters.
                </p>
                <Link href="/cv">
                  <Button size="lg">
                    Create Master CV <LuArrowRight className="ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid lg:grid-cols-[420px_1fr] gap-6 animate-[fade-in-up_0.5s_ease-out_forwards]">
              {/* ── LEFT COLUMN: Inputs ── */}
              <div className="flex flex-col gap-4">
                {/* CV Selector */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <LuFileText className="h-4 w-4 text-primary" />
                      Select Master CV
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-2">
                      <select
                        value={selectedCVId}
                        onChange={(e) => setSelectedCVId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {allCVs.map((cv) => (
                          <option key={cv._id} value={cv._id}>
                            {getCVDisplayName(cv)}
                          </option>
                        ))}
                      </select>
                      <Link href="/cv">
                        <Button
                          variant="outline"
                          size="icon"
                          title="Manage CVs"
                        >
                          <LuFilePen className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                    {masterCV && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {masterCV.experience?.length || 0} experiences &bull;{" "}
                        {masterCV.projects?.length || 0} projects &bull;{" "}
                        {masterCV.education?.length || 0} education
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Job Details */}
                <Card className="flex-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <LuBriefcase className="h-4 w-4 text-primary" />
                      Job Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="company" className="text-xs mb-1 block">
                          Company
                        </Label>
                        <Input
                          id="company"
                          placeholder="e.g. Google"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="position"
                          className="text-xs mb-1 block"
                        >
                          Position
                        </Label>
                        <Input
                          id="position"
                          placeholder="e.g. Software Engineer"
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="jobdesc" className="text-xs mb-1 block">
                        Job Description *
                      </Label>
                      <textarea
                        id="jobdesc"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the full job description here..."
                        className="textarea-field resize-none text-sm leading-relaxed w-full"
                        style={{ minHeight: "240px" }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Generation Options */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <LuSparkles className="h-4 w-4 text-primary" />
                      What to Generate
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex flex-col gap-2">
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors border border-border">
                      <input
                        type="checkbox"
                        checked={genResume}
                        onChange={(e) => setGenResume(e.target.checked)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div>
                        <p className="text-sm font-medium">
                          Tailored Resume (LaTeX / PDF)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          1-page, ATS-optimized, compile to PDF
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors border border-border">
                      <input
                        type="checkbox"
                        checked={genCoverLetter}
                        onChange={(e) => setGenCoverLetter(e.target.checked)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div>
                        <p className="text-sm font-medium">
                          Cover Letter (DOCX / PDF)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Personalized letter, editable, downloadable as Word or
                          PDF
                        </p>
                      </div>
                    </label>

                    {/* Word count — only shown when CL is selected */}
                    {genCoverLetter && (
                      <div className="flex items-center gap-3 px-2 pb-1">
                        <Label
                          htmlFor="wordCount"
                          className="text-xs text-muted-foreground whitespace-nowrap"
                        >
                          Body word count
                        </Label>
                        <Input
                          id="wordCount"
                          type="number"
                          min={100}
                          max={600}
                          step={10}
                          value={wordCount}
                          onChange={(e) => setWordCount(Number(e.target.value))}
                          className="h-7 text-xs w-24"
                        />
                        <span className="text-xs text-muted-foreground">
                          words (default 250)
                        </span>
                      </div>
                    )}
                    {genCoverLetter && (
                      <p className="text-xs text-muted-foreground px-2">
                        Name, email &amp; phone are pulled from{" "}
                        <Link
                          href="/settings"
                          className="underline text-primary"
                        >
                          Settings
                        </Link>
                        .
                      </p>
                    )}

                    <Button
                      onClick={handleGenerate}
                      disabled={loading || (!genResume && !genCoverLetter)}
                      className="w-full mt-1"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <LuLoader className="animate-spin mr-2" />
                          Generating with AI...
                        </>
                      ) : (
                        <>
                          <LuSparkles className="mr-2" />
                          Generate{" "}
                          {genResume && genCoverLetter
                            ? "Resume & Cover Letter"
                            : genResume
                              ? "Resume"
                              : "Cover Letter"}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* ── RIGHT COLUMN: Results ── */}
              <div className="flex flex-col" style={{ minHeight: "600px" }}>
                {!tailoredLatex && !coverLetterContent && !loading ? (
                  <Card className="flex-1 flex items-center justify-center">
                    <CardContent className="p-12 text-center">
                      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                        <LuFileOutput className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">
                        Ready to Generate
                      </h3>
                      <p className="text-muted-foreground max-w-sm">
                        Fill in the job details, choose what to generate, and
                        click the button.
                      </p>
                    </CardContent>
                  </Card>
                ) : loading ? (
                  <Card className="flex-1 flex items-center justify-center">
                    <CardContent className="p-12 text-center flex flex-col items-center">
                      <LuLoader className="h-12 w-12 text-primary animate-spin mb-4" />
                      <p className="font-medium">Generating with AI...</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        This may take up to 30 seconds
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="flex-1 flex flex-col overflow-hidden">
                    {/* Tabs — only show when both are present */}
                    {tailoredLatex && coverLetterContent && (
                      <div className="flex border-b border-border px-4 pt-3 gap-1">
                        <button
                          onClick={() => setActiveTab("resume")}
                          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
                            activeTab === "resume"
                              ? "bg-primary/10 text-primary border-b-2 border-primary"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <LuFileText className="h-4 w-4" /> Resume
                          <LuCheck className="h-3 w-3 text-green-500" />
                        </button>
                        <button
                          onClick={() => setActiveTab("coverletter")}
                          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
                            activeTab === "coverletter"
                              ? "bg-primary/10 text-primary border-b-2 border-primary"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <LuFilePen className="h-4 w-4" /> Cover Letter
                          <LuCheck className="h-3 w-3 text-green-500" />
                        </button>
                      </div>
                    )}

                    {/* ── RESUME PANEL ── */}
                    {tailoredLatex &&
                      (activeTab === "resume" || !coverLetterContent) && (
                        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
                          {/* Toolbar */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold flex items-center gap-2 mr-auto">
                              <LuFileOutput className="h-4 w-4 text-primary" />
                              Tailored Resume (LaTeX)
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={openInOverleaf}
                              title="Open in Overleaf"
                            >
                              <LuExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={copyToClipboard}
                              title="Copy"
                            >
                              {copied ? (
                                <LuCheck className="h-4 w-4 text-primary" />
                              ) : (
                                <LuCopy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={downloadTeX}
                              title="Download .tex"
                            >
                              <LuDownload className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={savedResumeId ? "outline" : "default"}
                              size="sm"
                              onClick={saveResume}
                              disabled={savingResume || !!savedResumeId}
                              title={
                                savedResumeId ? "Saved" : "Save to account"
                              }
                            >
                              {savingResume ? (
                                <LuLoader className="h-4 w-4 animate-spin mr-1" />
                              ) : savedResumeId ? (
                                <LuCheck className="h-4 w-4 text-green-500 mr-1" />
                              ) : (
                                <LuSave className="h-4 w-4 mr-1" />
                              )}
                              {savedResumeId ? "Saved" : "Save"}
                            </Button>
                          </div>

                          {/* Monaco Editor */}
                          <div
                            className="flex-1 border border-border rounded-lg overflow-hidden bg-[#1e1e1e]"
                            style={{ minHeight: "300px" }}
                          >
                            <Editor
                              height="100%"
                              defaultLanguage="latex"
                              value={tailoredLatex}
                              onChange={(val) => setTailoredLatex(val || "")}
                              theme="vs-dark"
                              options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                scrollBeyondLastLine: false,
                                padding: { top: 12, bottom: 12 },
                              }}
                            />
                          </div>

                          {/* PDF section */}
                          <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className="text-sm font-medium flex items-center gap-1 mr-auto">
                                <LuFileText className="h-4 w-4" /> Compile &amp;
                                Export PDF
                              </span>
                              {engineLoading && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <LuLoader className="h-3 w-3 animate-spin" />
                                  {loadingProgress || "Loading..."}
                                </span>
                              )}
                              <Button
                                onClick={compilePdf}
                                disabled={isCompiling}
                                size="sm"
                              >
                                {isCompiling ? (
                                  <>
                                    <LuLoader className="animate-spin mr-1 h-3 w-3" />
                                    Compiling...
                                  </>
                                ) : (
                                  <>
                                    <LuSparkles className="mr-1 h-3 w-3" />
                                    Compile PDF
                                  </>
                                )}
                              </Button>
                              {pdfBlob && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={downloadPdf}
                                  >
                                    <LuDownload className="mr-1 h-3 w-3" />
                                    Download PDF
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowPdfPreview(true)}
                                  >
                                    <LuEye className="mr-1 h-3 w-3" />
                                    Preview
                                  </Button>
                                </>
                              )}
                            </div>
                            {savedResumeId && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                                <LuCheck className="h-3 w-3" /> Saved —{" "}
                                <Link href="/documents" className="underline">
                                  View in My Documents
                                </Link>
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                    {/* ── COVER LETTER PANEL ── */}
                    {coverLetterContent &&
                      (activeTab === "coverletter" || !tailoredLatex) && (
                        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
                          {/* Toolbar */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold flex items-center gap-2 mr-auto">
                              <LuFilePen className="h-4 w-4 text-primary" />
                              Cover Letter
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const win = window.open("", "_blank");
                                if (win) {
                                  win.document.write(
                                    renderCoverLetterHtml(
                                      coverLetterContent,
                                      false,
                                    ),
                                  );
                                  win.document.close();
                                }
                              }}
                              title="Preview formatted cover letter"
                            >
                              <LuEye className="h-4 w-4 mr-1" />
                              Preview
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                downloadCoverLetterAsDocx(
                                  coverLetterContent,
                                  `cover-letter-${company || "application"}`,
                                )
                              }
                              title="Download as Word (.docx)"
                            >
                              <LuDownload className="h-4 w-4 mr-1" />
                              DOCX
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                printCoverLetterAsPdf(coverLetterContent)
                              }
                              title="Print / Save as PDF"
                            >
                              <LuFileText className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                            <Button
                              variant={savedCLId ? "outline" : "default"}
                              size="sm"
                              onClick={saveCoverLetter}
                              disabled={savingCL || !!savedCLId}
                              title={savedCLId ? "Saved" : "Save to account"}
                            >
                              {savingCL ? (
                                <LuLoader className="h-4 w-4 animate-spin mr-1" />
                              ) : savedCLId ? (
                                <LuCheck className="h-4 w-4 text-green-500 mr-1" />
                              ) : (
                                <LuSave className="h-4 w-4 mr-1" />
                              )}
                              {savedCLId ? "Saved" : "Save"}
                            </Button>
                          </div>

                          {/* Editable textarea */}
                          <textarea
                            value={coverLetterContent}
                            onChange={(e) =>
                              setCoverLetterContent(e.target.value)
                            }
                            className="flex-1 w-full rounded-lg border border-border bg-background p-4 text-sm font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                            style={{ minHeight: "400px" }}
                            spellCheck={true}
                          />

                          {savedCLId ? (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                              <LuCheck className="h-3 w-3" /> Saved —{" "}
                              <Link href="/documents" className="underline">
                                View in My Documents
                              </Link>
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              ✏️ Edit the cover letter above before saving or
                              downloading.
                            </p>
                          )}
                        </div>
                      )}
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
