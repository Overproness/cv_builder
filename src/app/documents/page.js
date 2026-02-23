"use client";

import { Footer } from "@/components/Footer";
import { useLatexCompiler } from "@/components/LatexCompiler";
import { Navbar } from "@/components/Navbar";
import PdfPreview from "@/components/PdfPreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Editor from "@monaco-editor/react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  LuLoader,
  LuPlus,
  LuSparkles,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import {
  downloadCoverLetterAsDocx,
  printCoverLetterAsPdf,
} from "@/lib/coverLetterUtils";

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState("resumes");
  const [resumes, setResumes] = useState([]);
  const [coverLetters, setCoverLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Resume viewer modal
  const [viewingResume, setViewingResume] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Cover letter viewer modal
  const [viewingCL, setViewingCL] = useState(null);
  const [editedCLContent, setEditedCLContent] = useState("");
  const [savingCL, setSavingCL] = useState(false);

  const { compileLatexOnServer, isLoading: engineLoading } = useLatexCompiler();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [resumeRes, clRes] = await Promise.all([
        fetch("/api/resume"),
        fetch("/api/cover-letter"),
      ]);
      if (resumeRes.ok) setResumes(await resumeRes.json());
      if (clRes.ok) setCoverLetters(await clRes.json());
    } catch (err) {
      console.error("Error fetching documents", err);
    } finally {
      setLoading(false);
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
            cl._id === viewingCL._id ? { ...cl, content: editedCLContent } : cl
          )
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
                    <p className="text-sm text-muted-foreground">{viewingResume.company}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadTeX(viewingResume)}>
                    <LuDownload className="h-4 w-4 mr-1" /> .tex
                  </Button>
                  <Button variant="outline" size="sm" onClick={compilePdf} disabled={isCompiling}>
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
                  <Button variant="ghost" size="icon" onClick={() => setViewingResume(null)}>
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
                      {viewingCL.position ? `${viewingCL.position} @ ` : ""}{viewingCL.company}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadCoverLetterAsDocx(
                        editedCLContent,
                        viewingCL.title || "cover-letter"
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
                  <Button variant="ghost" size="icon" onClick={() => setViewingCL(null)}>
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
                  ✏️ Edit the cover letter above, then click "Save Edits" to update.
                </p>
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

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-border pb-0">
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
                {resumes.length}
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
                {coverLetters.length}
              </span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <LuLoader className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : activeTab === "resumes" ? (
            /* ── RESUMES TAB ── */
            resumes.length === 0 ? (
              <EmptyState
                icon={<LuFileText className="h-10 w-10 text-muted-foreground" />}
                title="No Saved Resumes"
                description="Generate and save a tailored resume to see it here."
                action={
                  <Link href="/tailor">
                    <Button>
                      Create Resume <LuArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {resumes.map((resume) => (
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
          ) : (
            /* ── COVER LETTERS TAB ── */
            coverLetters.length === 0 ? (
              <EmptyState
                icon={<LuFilePen className="h-10 w-10 text-muted-foreground" />}
                title="No Saved Cover Letters"
                description="Generate and save a cover letter to see it here."
                action={
                  <Link href="/tailor">
                    <Button>
                      Create Cover Letter <LuArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {coverLetters.map((cl) => (
                  <DocumentCard
                    key={cl._id}
                    icon={<LuFilePen className="h-5 w-5 text-primary" />}
                    title={cl.title}
                    company={cl.company}
                    position={cl.position}
                    date={cl.createdAt}
                    formatDate={formatDate}
                    onView={() => openCoverLetter(cl)}
                    onDownload={() => downloadCoverLetterAsDocx(cl.content, cl.title || "cover-letter")}
                    onDelete={() => deleteCoverLetter(cl._id)}
                    viewLabel="View & Edit"
                    downloadLabel="DOCX"
                  />
                ))}
              </div>
            )
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
            <CardTitle className="text-sm font-semibold truncate">{title}</CardTitle>
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
              {position && company ? `${position} @ ${company}` : company || position}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <LuCalendar className="h-3 w-3" />
          <span>{formatDate(date)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" className="flex-1" onClick={onView}>
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
