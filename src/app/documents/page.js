"use client";

import { Footer } from "@/components/Footer";
import { useLatexCompiler } from "@/components/LatexCompiler";
import { Navbar } from "@/components/Navbar";
import PdfPreview from "@/components/PdfPreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  downloadCoverLetterAsDocx,
  printCoverLetterAsPdf,
  renderCoverLetterHtml,
} from "@/lib/coverLetterUtils";
import Editor from "@monaco-editor/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  LuArrowRight,
  LuBuilding2,
  LuCalendar,
  LuCheck,
  LuDownload,
  LuEye,
  LuFilePen,
  LuFileText,
  LuFiles,
  LuLink,
  LuLoader,
  LuMessageSquare,
  LuPlus,
  LuSearch,
  LuSparkles,
  LuTrash2,
  LuX,
} from "react-icons/lu";

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState("applications");
  const [resumes, setResumes] = useState([]);
  const [coverLetters, setCoverLetters] = useState([]);
  const [applicationGroups, setApplicationGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Resume viewer modal
  const [viewingResume, setViewingResume] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Cover letter viewer modal
  const [viewingCL, setViewingCL] = useState(null);
  const [editedCLContent, setEditedCLContent] = useState("");
  const [savingCL, setSavingCL] = useState(false);

  // Application group detail modal
  const [viewingGroup, setViewingGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [loadingGroup, setLoadingGroup] = useState(false);

  const { compileLatexOnServer, isLoading: engineLoading } = useLatexCompiler();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (debouncedSearch) {
      fetchApplicationGroups();
    }
  }, [debouncedSearch]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [resumeRes, clRes, groupRes] = await Promise.all([
        fetch("/api/resume"),
        fetch("/api/cover-letter"),
        fetch("/api/application-group"),
      ]);
      if (resumeRes.ok) setResumes(await resumeRes.json());
      if (clRes.ok) setCoverLetters(await clRes.json());
      if (groupRes.ok) setApplicationGroups(await groupRes.json());
    } catch (err) {
      console.error("Error fetching documents", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicationGroups = async () => {
    try {
      const url = debouncedSearch
        ? `/api/application-group?search=${encodeURIComponent(debouncedSearch)}`
        : "/api/application-group";
      const res = await fetch(url);
      if (res.ok) setApplicationGroups(await res.json());
    } catch (err) {
      console.error("Error searching application groups", err);
    }
  };

  const openGroupDetail = async (group) => {
    setViewingGroup(group);
    setLoadingGroup(true);
    try {
      const res = await fetch(`/api/application-group/${group._id}`);
      if (res.ok) {
        setGroupDetail(await res.json());
      }
    } catch (err) {
      console.error("Error fetching group detail", err);
    } finally {
      setLoadingGroup(false);
    }
  };

  const deleteGroup = async (id) => {
    if (!confirm("Delete this application group?")) return;
    try {
      const res = await fetch(`/api/application-group/${id}`, { method: "DELETE" });
      if (res.ok) {
        setApplicationGroups((prev) => prev.filter((g) => g._id !== id));
        showMessage("Application group deleted", "success");
        if (viewingGroup?._id === id) {
          setViewingGroup(null);
          setGroupDetail(null);
        }
      }
    } catch {
      showMessage("Failed to delete", "error");
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const deleteResume = async (id) => {
    if (!confirm("Delete this resume?")) return;
    try {
      const res = await fetch(`/api/resume/${id}`, { method: "DELETE" });
      if (res.ok) {
        setResumes((prev) => prev.filter((r) => r._id !== id));
        showMessage("Resume deleted", "success");
        if (viewingResume?._id === id) setViewingResume(null);
      }
    } catch {
      showMessage("Failed to delete", "error");
    }
  };

  const deleteCoverLetter = async (id) => {
    if (!confirm("Delete this cover letter?")) return;
    try {
      const res = await fetch(`/api/cover-letter/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCoverLetters((prev) => prev.filter((cl) => cl._id !== id));
        showMessage("Cover letter deleted", "success");
        if (viewingCL?._id === id) setViewingCL(null);
      }
    } catch {
      showMessage("Failed to delete", "error");
    }
  };

  const openResume = (resume) => {
    setViewingResume(resume);
    setPdfBlob(null);
    setShowPdfPreview(false);
  };

  const openCoverLetter = (cl) => {
    setViewingCL(cl);
    setEditedCLContent(cl.content);
  };

  const compilePdf = async () => {
    if (!viewingResume?.latex) return;
    setIsCompiling(true);
    try {
      const result = await compileLatexOnServer(viewingResume.latex);
      if (result) {
        setPdfBlob(result);
        setShowPdfPreview(true);
        showMessage("PDF compiled!", "success");
      } else {
        showMessage("Compilation failed", "error");
      }
    } catch (err) {
      showMessage(`Error: ${err.message}`, "error");
    } finally {
      setIsCompiling(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${viewingResume?.title || "resume"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTeX = (resume) => {
    const a = document.createElement("a");
    const file = new Blob([resume.latex], { type: "text/plain" });
    a.href = URL.createObjectURL(file);
    a.download = `${resume.title || "resume"}.tex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const saveCLEdits = async () => {
    if (!viewingCL) return;
    setSavingCL(true);
    try {
      const res = await fetch(`/api/cover-letter/${viewingCL._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editedCLContent }),
      });
      if (res.ok) {
        setCoverLetters((prev) =>
          prev.map((cl) =>
            cl._id === viewingCL._id ? { ...cl, content: editedCLContent } : cl,
          ),
        );
        setViewingCL({ ...viewingCL, content: editedCLContent });
        showMessage("Cover letter updated!", "success");
      }
    } catch {
      showMessage("Failed to save", "error");
    } finally {
      setSavingCL(false);
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  // Filter resumes and cover letters by search query (client-side)
  const filterBySearch = useCallback(
    (items) => {
      if (!debouncedSearch) return items;
      const q = debouncedSearch.toLowerCase();
      return items.filter(
        (item) =>
          (item.title && item.title.toLowerCase().includes(q)) ||
          (item.company && item.company.toLowerCase().includes(q)) ||
          (item.position && item.position.toLowerCase().includes(q)) ||
          (item.jobDescription && item.jobDescription.toLowerCase().includes(q)) ||
          (item.content && item.content.toLowerCase().includes(q)),
      );
    },
    [debouncedSearch],
  );

  const filteredResumes = filterBySearch(resumes);
  const filteredCoverLetters = filterBySearch(coverLetters);

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
            className={`toast ${message.type === "success" ? "toast-success" : "toast-error"}`}
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
                latexSource={viewingResume?.latex}
                fileName={`${viewingResume?.title || "resume"}.pdf`}
                onClose={() => setShowPdfPreview(false)}
              />
            </div>
          </div>
        )}

        {/* Resume Viewer Modal */}
        {viewingResume && !showPdfPreview && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h2 className="font-semibold">{viewingResume.title}</h2>
                  {viewingResume.company && (
                    <p className="text-sm text-muted-foreground">
                      {viewingResume.company}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadTeX(viewingResume)}
                  >
                    <LuDownload className="h-4 w-4 mr-1" /> .tex
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={compilePdf}
                    disabled={isCompiling}
                  >
                    {isCompiling ? (
                      <LuLoader className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <LuSparkles className="h-4 w-4 mr-1" />
                    )}
                    Compile PDF
                  </Button>
                  {pdfBlob && (
                    <Button variant="outline" size="sm" onClick={downloadPdf}>
                      <LuDownload className="h-4 w-4 mr-1" /> PDF
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewingResume(null)}
                  >
                    <LuX className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
                <Editor
                  height="100%"
                  defaultLanguage="latex"
                  value={viewingResume.latex}
                  theme="vs-dark"
                  options={{
                    readOnly: false,
                    minimap: { enabled: false },
                    fontSize: 12,
                    scrollBeyondLastLine: false,
                    padding: { top: 12 },
                  }}
                  onChange={(val) =>
                    setViewingResume({ ...viewingResume, latex: val || "" })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Cover Letter Viewer/Editor Modal */}
        {viewingCL && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h2 className="font-semibold">{viewingCL.title}</h2>
                  {viewingCL.company && (
                    <p className="text-sm text-muted-foreground">
                      {viewingCL.position ? `${viewingCL.position} @ ` : ""}
                      {viewingCL.company}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const win = window.open("", "_blank");
                      if (win) {
                        win.document.write(
                          renderCoverLetterHtml(editedCLContent, false),
                        );
                        win.document.close();
                      }
                    }}
                  >
                    <LuEye className="h-4 w-4 mr-1" /> Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadCoverLetterAsDocx(
                        editedCLContent,
                        viewingCL.title || "cover-letter",
                      )
                    }
                  >
                    <LuDownload className="h-4 w-4 mr-1" /> DOCX
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => printCoverLetterAsPdf(editedCLContent)}
                  >
                    <LuFileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={saveCLEdits}
                    disabled={savingCL || editedCLContent === viewingCL.content}
                  >
                    {savingCL ? (
                      <LuLoader className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <LuCheck className="h-4 w-4 mr-1" />
                    )}
                    Save Edits
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewingCL(null)}
                  >
                    <LuX className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden p-4 flex flex-col">
                <textarea
                  value={editedCLContent}
                  onChange={(e) => setEditedCLContent(e.target.value)}
                  className="flex-1 w-full rounded-lg border border-border bg-background p-4 text-sm font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  style={{ minHeight: "400px" }}
                  spellCheck={true}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  ✏️ Edit the cover letter above, then click "Save Edits" to
                  update.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Application Group Detail Modal */}
        {viewingGroup && !viewingResume && !viewingCL && !showPdfPreview && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h2 className="font-semibold">{viewingGroup.title}</h2>
                  {viewingGroup.company && (
                    <p className="text-sm text-muted-foreground">
                      {viewingGroup.position ? `${viewingGroup.position} @ ` : ""}
                      {viewingGroup.company}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setViewingGroup(null);
                    setGroupDetail(null);
                  }}
                >
                  <LuX className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {loadingGroup ? (
                  <div className="flex items-center justify-center py-12">
                    <LuLoader className="h-6 w-6 text-primary animate-spin" />
                  </div>
                ) : groupDetail ? (
                  <div className="flex flex-col gap-6">
                    {/* Linked Documents */}
                    <div className="flex flex-wrap gap-2">
                      {groupDetail.resume && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openResume(groupDetail.resume)}
                        >
                          <LuFileText className="h-4 w-4 mr-1" />
                          View Resume
                        </Button>
                      )}
                      {groupDetail.coverLetter && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCoverLetter(groupDetail.coverLetter)}
                        >
                          <LuFilePen className="h-4 w-4 mr-1" />
                          View Cover Letter
                        </Button>
                      )}
                    </div>

                    {/* Questions & Answers */}
                    {groupDetail.questions && groupDetail.questions.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <LuMessageSquare className="h-4 w-4 text-primary" />
                          Application Questions & Answers
                        </h3>
                        <div className="flex flex-col gap-3">
                          {groupDetail.questions.map((qa, i) => (
                            <div
                              key={i}
                              className="border border-border rounded-lg p-4"
                            >
                              <p className="text-sm font-medium mb-2 flex items-start gap-2">
                                <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                {qa.question}
                              </p>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-7">
                                {qa.answer}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Company Info */}
                    {groupDetail.companyInfo && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <LuBuilding2 className="h-4 w-4 text-primary" />
                          Company Info
                        </h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap border border-border rounded-lg p-3">
                          {groupDetail.companyInfo}
                        </p>
                      </div>
                    )}

                    {/* Job Description */}
                    {groupDetail.jobDescription && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">
                          Job Description
                        </h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap border border-border rounded-lg p-3 max-h-48 overflow-auto">
                          {groupDetail.jobDescription}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Failed to load details
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <LuFiles className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">My Documents</h1>
              </div>
              <p className="text-muted-foreground">
                All your saved resumes and cover letters
              </p>
            </div>
            <Link href="/tailor">
              <Button className="flex items-center gap-2">
                <LuPlus className="h-4 w-4" />
                Create New
              </Button>
            </Link>
          </div>

          {/* Search Bar */}
          <div className="relative mb-6">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company, position, questions, answers, or anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <LuX className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-border pb-0">
            <button
              onClick={() => setActiveTab("applications")}
              className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === "applications"
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LuLink className="h-4 w-4" />
              Applications
              <span className="text-xs bg-muted rounded-full px-2 py-0.5">
                {applicationGroups.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("resumes")}
              className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === "resumes"
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LuFileText className="h-4 w-4" />
              Resumes
              <span className="text-xs bg-muted rounded-full px-2 py-0.5">
                {filteredResumes.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("coverletters")}
              className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === "coverletters"
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LuFilePen className="h-4 w-4" />
              Cover Letters
              <span className="text-xs bg-muted rounded-full px-2 py-0.5">
                {filteredCoverLetters.length}
              </span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <LuLoader className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : activeTab === "applications" ? (
            /* ── APPLICATIONS TAB ── */
            applicationGroups.length === 0 ? (
              <EmptyState
                icon={
                  <LuLink className="h-10 w-10 text-muted-foreground" />
                }
                title={debouncedSearch ? "No Matching Applications" : "No Saved Applications"}
                description={
                  debouncedSearch
                    ? "Try a different search term."
                    : "When you save a resume with questions or cover letter, they'll appear here as a linked application."
                }
                action={
                  !debouncedSearch && (
                    <Link href="/tailor">
                      <Button>
                        Create Application <LuArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  )
                }
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {applicationGroups.map((group) => (
                  <Card
                    key={group._id}
                    className="group hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <LuLink className="h-5 w-5 text-primary" />
                          </div>
                          <CardTitle className="text-sm font-semibold truncate">
                            {group.title}
                          </CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive flex-shrink-0"
                          onClick={() => deleteGroup(group._id)}
                          title="Delete"
                        >
                          <LuTrash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {(group.company || group.position) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <LuBuilding2 className="h-3 w-3" />
                          <span className="truncate">
                            {group.position && group.company
                              ? `${group.position} @ ${group.company}`
                              : group.company || group.position}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <LuCalendar className="h-3 w-3" />
                        <span>{formatDate(group.createdAt)}</span>
                      </div>
                      {/* Show what's linked */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {group.resumeId && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                            Resume
                          </span>
                        )}
                        {group.coverLetterId && (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                            Cover Letter
                          </span>
                        )}
                        {group.questions && group.questions.length > 0 && (
                          <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">
                            {group.questions.length} Q&A
                          </span>
                        )}
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full"
                        onClick={() => openGroupDetail(group)}
                      >
                        <LuEye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : activeTab === "resumes" ? (
            /* ── RESUMES TAB ── */
            filteredResumes.length === 0 ? (
              <EmptyState
                icon={
                  <LuFileText className="h-10 w-10 text-muted-foreground" />
                }
                title={debouncedSearch ? "No Matching Resumes" : "No Saved Resumes"}
                description={
                  debouncedSearch
                    ? "Try a different search term."
                    : "Generate and save a tailored resume to see it here."
                }
                action={
                  !debouncedSearch && (
                    <Link href="/tailor">
                      <Button>
                        Create Resume <LuArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  )
                }
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResumes.map((resume) => (
                  <DocumentCard
                    key={resume._id}
                    icon={<LuFileText className="h-5 w-5 text-primary" />}
                    title={resume.title}
                    company={resume.company}
                    position={resume.position}
                    date={resume.createdAt}
                    formatDate={formatDate}
                    onView={() => openResume(resume)}
                    onDownload={() => downloadTeX(resume)}
                    onDelete={() => deleteResume(resume._id)}
                    viewLabel="View LaTeX"
                    downloadLabel=".tex"
                  />
                ))}
              </div>
            )
          ) : /* ── COVER LETTERS TAB ── */
          filteredCoverLetters.length === 0 ? (
            <EmptyState
              icon={<LuFilePen className="h-10 w-10 text-muted-foreground" />}
              title={debouncedSearch ? "No Matching Cover Letters" : "No Saved Cover Letters"}
              description={
                debouncedSearch
                  ? "Try a different search term."
                  : "Generate and save a cover letter to see it here."
              }
              action={
                !debouncedSearch && (
                  <Link href="/tailor">
                    <Button>
                      Create Cover Letter{" "}
                      <LuArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                )
              }
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCoverLetters.map((cl) => (
                <DocumentCard
                  key={cl._id}
                  icon={<LuFilePen className="h-5 w-5 text-primary" />}
                  title={cl.title}
                  company={cl.company}
                  position={cl.position}
                  date={cl.createdAt}
                  formatDate={formatDate}
                  onView={() => openCoverLetter(cl)}
                  onDownload={() =>
                    downloadCoverLetterAsDocx(
                      cl.content,
                      cl.title || "cover-letter",
                    )
                  }
                  onDelete={() => deleteCoverLetter(cl._id)}
                  viewLabel="View & Edit"
                  downloadLabel="DOCX"
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function DocumentCard({
  icon,
  title,
  company,
  position,
  date,
  formatDate,
  onView,
  onDownload,
  onDelete,
  viewLabel,
  downloadLabel,
}) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
            <CardTitle className="text-sm font-semibold truncate">
              {title}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive flex-shrink-0"
            onClick={onDelete}
            title="Delete"
          >
            <LuTrash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {(company || position) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <LuBuilding2 className="h-3 w-3" />
            <span className="truncate">
              {position && company
                ? `${position} @ ${company}`
                : company || position}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <LuCalendar className="h-3 w-3" />
          <span>{formatDate(date)}</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={onView}
          >
            <LuEye className="h-4 w-4 mr-1" />
            {viewLabel}
          </Button>
          <Button variant="outline" size="sm" onClick={onDownload}>
            <LuDownload className="h-4 w-4 mr-1" />
            {downloadLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">{description}</p>
      {action}
    </div>
  );
}
