"use client";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LuBriefcase,
  LuChevronRight,
  LuFileText,
  LuGithub,
  LuGlobe,
  LuGraduationCap,
  LuLinkedin,
  LuLoader,
  LuMail,
  LuPhone,
  LuPlus,
  LuRefreshCw,
  LuRocket,
  LuSave,
  LuSparkles,
  LuTrash2,
  LuUser,
  LuWrench,
} from "react-icons/lu";

// Empty CV template
const emptyCVTemplate = {
  personal_info: {
    name: "",
    phone: "",
    email: "",
    linkedin: "",
    github: "",
    website: "",
  },
  education: [],
  experience: [],
  projects: [],
  skills: {
    languages: [],
    frameworks: [],
    tools: [],
    libraries: [],
  },
};

export default function CVPage() {
  const [mode, setMode] = useState("raw"); // 'raw', 'structured', or 'add'
  const [rawText, setRawText] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addType, setAddType] = useState("auto"); // 'auto', 'experience', 'project'
  const [cv, setCV] = useState(emptyCVTemplate);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [cvId, setCvId] = useState(null);

  // Load existing CV on mount
  useEffect(() => {
    fetchCV();
  }, []);

  const fetchCV = async () => {
    try {
      const res = await fetch("/api/cv");
      if (res.ok) {
        const data = await res.json();
        if (data && data.personal_info) {
          setCV(data);
          setCvId(data._id);
          setMode("structured");
        }
      }
    } catch (error) {
      console.error("Error fetching CV:", error);
    }
  };

  const parseWithAI = async () => {
    if (!rawText.trim()) {
      showMessage("Please enter some text to parse", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/cv/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });

      const data = await res.json();

      if (res.ok && data.cv) {
        setCV(data.cv);
        setMode("structured");
        showMessage("CV parsed successfully!", "success");
      } else {
        showMessage(data.error || "Failed to parse CV", "error");
      }
    } catch (error) {
      showMessage("Failed to parse CV. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const addToExistingCV = async () => {
    if (!addContent.trim()) {
      showMessage("Please enter content to add", "error");
      return;
    }

    if (!cv.personal_info?.name) {
      showMessage("Please create or load a CV first", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/resume/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingCV: cv,
          newContent: addContent,
          contentType: addType,
        }),
      });

      const data = await res.json();

      if (res.ok && data.updatedCV) {
        setCV(data.updatedCV);
        setAddContent("");
        setMode("structured");
        showMessage("Content added successfully!", "success");
      } else {
        showMessage(data.error || "Failed to add content", "error");
      }
    } catch (error) {
      showMessage("Failed to add content. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const saveCV = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cv, _id: cvId }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.id) setCvId(data.id);
        showMessage("CV saved successfully!", "success");
      } else {
        showMessage(data.error || "Failed to save CV", "error");
      }
    } catch (error) {
      showMessage("Failed to save CV. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const updatePersonalInfo = (field, value) => {
    setCV((prev) => ({
      ...prev,
      personal_info: { ...prev.personal_info, [field]: value },
    }));
  };

  const addEducation = () => {
    setCV((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        { institution: "", location: "", degree: "", dates: "" },
      ],
    }));
  };

  const updateEducation = (index, field, value) => {
    setCV((prev) => ({
      ...prev,
      education: prev.education.map((edu, i) =>
        i === index ? { ...edu, [field]: value } : edu,
      ),
    }));
  };

  const removeEducation = (index) => {
    setCV((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

  const addExperience = () => {
    setCV((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        { role: "", company: "", location: "", dates: "", points: [""] },
      ],
    }));
  };

  const updateExperience = (index, field, value) => {
    setCV((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === index ? { ...exp, [field]: value } : exp,
      ),
    }));
  };

  const updateExperiencePoint = (expIndex, pointIndex, value) => {
    setCV((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === expIndex
          ? {
              ...exp,
              points: exp.points.map((p, j) => (j === pointIndex ? value : p)),
            }
          : exp,
      ),
    }));
  };

  const addExperiencePoint = (expIndex) => {
    setCV((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === expIndex ? { ...exp, points: [...exp.points, ""] } : exp,
      ),
    }));
  };

  const removeExperiencePoint = (expIndex, pointIndex) => {
    setCV((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === expIndex
          ? { ...exp, points: exp.points.filter((_, j) => j !== pointIndex) }
          : exp,
      ),
    }));
  };

  const removeExperience = (index) => {
    setCV((prev) => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index),
    }));
  };

  const addProject = () => {
    setCV((prev) => ({
      ...prev,
      projects: [
        ...prev.projects,
        { name: "", technologies: "", dates: "", demo_link: "", points: [""] },
      ],
    }));
  };

  const updateProject = (index, field, value) => {
    setCV((prev) => ({
      ...prev,
      projects: prev.projects.map((proj, i) =>
        i === index ? { ...proj, [field]: value } : proj,
      ),
    }));
  };

  const updateProjectPoint = (projIndex, pointIndex, value) => {
    setCV((prev) => ({
      ...prev,
      projects: prev.projects.map((proj, i) =>
        i === projIndex
          ? {
              ...proj,
              points: proj.points.map((p, j) => (j === pointIndex ? value : p)),
            }
          : proj,
      ),
    }));
  };

  const addProjectPoint = (projIndex) => {
    setCV((prev) => ({
      ...prev,
      projects: prev.projects.map((proj, i) =>
        i === projIndex ? { ...proj, points: [...proj.points, ""] } : proj,
      ),
    }));
  };

  const removeProjectPoint = (projIndex, pointIndex) => {
    setCV((prev) => ({
      ...prev,
      projects: prev.projects.map((proj, i) =>
        i === projIndex
          ? { ...proj, points: proj.points.filter((_, j) => j !== pointIndex) }
          : proj,
      ),
    }));
  };

  const removeProject = (index) => {
    setCV((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }));
  };

  const updateSkills = (category, value) => {
    const skills = value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    setCV((prev) => ({
      ...prev,
      skills: { ...prev.skills, [category]: skills },
    }));
  };

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
          <div
            className={`toast ${message.type === "success" ? "toast-success" : "toast-error"} flex items-center gap-2`}
          >
            {message.text}
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <LuFileText className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">Master CV</h1>
              </div>
              <p className="text-muted-foreground">
                Your complete professional history
              </p>
            </div>

            {mode === "structured" && (
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setMode("add")}>
                  <LuPlus className="mr-2 h-4 w-4" /> Add to CV
                </Button>
                <Button variant="outline" onClick={() => setMode("raw")}>
                  <LuRefreshCw className="mr-2 h-4 w-4" /> Parse New
                </Button>
                <Button onClick={saveCV} disabled={saving}>
                  {saving ? (
                    <LuLoader className="animate-spin mr-2 h-4 w-4" />
                  ) : (
                    <LuSave className="mr-2 h-4 w-4" />
                  )}
                  {saving ? "Saving..." : "Save CV"}
                </Button>
              </div>
            )}
          </div>

          {mode === "add" ? (
            /* Add to Existing CV Mode */
            <Card className="animate-[fade-in-up_0.5s_ease-out_forwards]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LuPlus className="h-5 w-5 text-primary" />
                  Add Experience or Project
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-muted-foreground">
                  Describe a new job, internship, or project you've completed.
                  AI will parse it and add it to your CV.
                </p>

                <div className="space-y-2">
                  <Label>What are you adding?</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={addType === "auto" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAddType("auto")}
                    >
                      Auto-detect
                    </Button>
                    <Button
                      variant={addType === "experience" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAddType("experience")}
                    >
                      Experience
                    </Button>
                    <Button
                      variant={addType === "project" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAddType("project")}
                    >
                      Project
                    </Button>
                  </div>
                </div>

                <textarea
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                  placeholder="Describe your new experience or project...

Example:
Senior Software Engineer at Microsoft (Jan 2025 - Present)
- Led team of 5 engineers building cloud infrastructure
- Reduced deployment time by 40% using Kubernetes
- Implemented CI/CD pipeline serving 100K+ requests/day

Or for a project:
E-commerce Platform (2024)
Built with React, Node.js, PostgreSQL
Demo: myshop.com
- Created full-stack shopping platform with payment integration
- Implemented real-time inventory management"
                  className="textarea-field font-mono text-sm leading-relaxed min-h-[350px]"
                />

                <div className="flex gap-4">
                  <Button onClick={addToExistingCV} disabled={loading}>
                    {loading ? (
                      <>
                        <LuLoader className="animate-spin mr-2 h-4 w-4" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <LuSparkles className="mr-2 h-4 w-4" /> Add to CV
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setMode("structured")}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : mode === "raw" ? (
            /* Raw Text Input Mode */
            <Card className="animate-[fade-in-up_0.5s_ease-out_forwards]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LuFileText className="h-5 w-5 text-primary" />
                  Paste Your Resume or Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-muted-foreground">
                  Dump your existing resume, LinkedIn export, or any notes about
                  your experience. Our AI will extract and structure everything
                  for you.
                </p>

                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste your resume text here...

Example:
John Doe
john@example.com | (555) 123-4567 | linkedin.com/in/johndoe

EDUCATION
BS Computer Science, MIT, 2020

EXPERIENCE
Software Engineer at Google (2020-Present)
- Built scalable microservices serving 10M+ users
- Led migration to Kubernetes..."
                  className="textarea-field font-mono text-sm leading-relaxed min-h-[400px]"
                />

                <div className="flex gap-4">
                  <Button onClick={parseWithAI} disabled={loading}>
                    {loading ? (
                      <>
                        <LuLoader className="animate-spin mr-2 h-4 w-4" />
                        Parsing with AI...
                      </>
                    ) : (
                      <>
                        <LuSparkles className="mr-2 h-4 w-4" /> Parse with AI
                      </>
                    )}
                  </Button>

                  {cv.personal_info?.name && (
                    <Button
                      variant="outline"
                      onClick={() => setMode("structured")}
                    >
                      View Existing CV{" "}
                      <LuChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Structured Editor Mode */
            <div className="space-y-6 animate-[fade-in-up_0.5s_ease-out_forwards]">
              {/* Personal Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LuUser className="h-5 w-5 text-primary" /> Personal
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <div className="relative">
                        <LuUser className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={cv.personal_info?.name || ""}
                          onChange={(e) =>
                            updatePersonalInfo("name", e.target.value)
                          }
                          className="pl-10"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <div className="relative">
                        <LuMail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          value={cv.personal_info?.email || ""}
                          onChange={(e) =>
                            updatePersonalInfo("email", e.target.value)
                          }
                          className="pl-10"
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <div className="relative">
                        <LuPhone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={cv.personal_info?.phone || ""}
                          onChange={(e) =>
                            updatePersonalInfo("phone", e.target.value)
                          }
                          className="pl-10"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>LinkedIn</Label>
                      <div className="relative">
                        <LuLinkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={cv.personal_info?.linkedin || ""}
                          onChange={(e) =>
                            updatePersonalInfo("linkedin", e.target.value)
                          }
                          className="pl-10"
                          placeholder="linkedin.com/in/johndoe"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>GitHub</Label>
                      <div className="relative">
                        <LuGithub className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={cv.personal_info?.github || ""}
                          onChange={(e) =>
                            updatePersonalInfo("github", e.target.value)
                          }
                          className="pl-10"
                          placeholder="github.com/johndoe"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Website (Optional)</Label>
                      <div className="relative">
                        <LuGlobe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={cv.personal_info?.website || ""}
                          onChange={(e) =>
                            updatePersonalInfo("website", e.target.value)
                          }
                          className="pl-10"
                          placeholder="johndoe.com"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Education */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <LuGraduationCap className="h-5 w-5 text-primary" />{" "}
                    Education
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addEducation}>
                    <LuPlus className="mr-2 h-4 w-4" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cv.education?.map((edu, index) => (
                    <div
                      key={index}
                      className="p-4 bg-muted/30 rounded-lg border border-border"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant="secondary">Entry #{index + 1}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEducation(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <LuTrash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          value={edu.institution || ""}
                          onChange={(e) =>
                            updateEducation(
                              index,
                              "institution",
                              e.target.value,
                            )
                          }
                          placeholder="Institution"
                        />
                        <Input
                          value={edu.location || ""}
                          onChange={(e) =>
                            updateEducation(index, "location", e.target.value)
                          }
                          placeholder="Location"
                        />
                        <Input
                          value={edu.degree || ""}
                          onChange={(e) =>
                            updateEducation(index, "degree", e.target.value)
                          }
                          placeholder="Degree"
                        />
                        <Input
                          value={edu.dates || ""}
                          onChange={(e) =>
                            updateEducation(index, "dates", e.target.value)
                          }
                          placeholder="Dates (e.g., Aug 2018 - May 2022)"
                        />
                      </div>
                    </div>
                  ))}

                  {(!cv.education || cv.education.length === 0) && (
                    <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                      <p className="text-muted-foreground">
                        No education entries yet.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Experience */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <LuBriefcase className="h-5 w-5 text-primary" /> Experience
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addExperience}>
                    <LuPlus className="mr-2 h-4 w-4" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cv.experience?.map((exp, index) => (
                    <div
                      key={index}
                      className="p-4 bg-muted/30 rounded-lg border border-border"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant="secondary">Position #{index + 1}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExperience(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <LuTrash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3 mb-4">
                        <Input
                          value={exp.role || ""}
                          onChange={(e) =>
                            updateExperience(index, "role", e.target.value)
                          }
                          placeholder="Job Title"
                        />
                        <Input
                          value={exp.company || ""}
                          onChange={(e) =>
                            updateExperience(index, "company", e.target.value)
                          }
                          placeholder="Company"
                        />
                        <Input
                          value={exp.location || ""}
                          onChange={(e) =>
                            updateExperience(index, "location", e.target.value)
                          }
                          placeholder="Location"
                        />
                        <Input
                          value={exp.dates || ""}
                          onChange={(e) =>
                            updateExperience(index, "dates", e.target.value)
                          }
                          placeholder="Dates"
                        />
                      </div>

                      <Label className="mb-2 block">Bullet Points</Label>
                      <div className="space-y-2">
                        {exp.points?.map((point, pIndex) => (
                          <div key={pIndex} className="flex gap-2">
                            <span className="text-muted-foreground mt-2.5">
                              •
                            </span>
                            <textarea
                              value={point}
                              onChange={(e) =>
                                updateExperiencePoint(
                                  index,
                                  pIndex,
                                  e.target.value,
                                )
                              }
                              className="textarea-field flex-1 min-h-[60px] text-sm"
                              placeholder="Describe an achievement or responsibility..."
                              rows={2}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                removeExperiencePoint(index, pIndex)
                              }
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 mt-1"
                            >
                              <LuTrash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => addExperiencePoint(index)}
                        className="mt-2 text-primary"
                      >
                        <LuPlus className="mr-1 h-3 w-3" /> Add bullet point
                      </Button>
                    </div>
                  ))}

                  {(!cv.experience || cv.experience.length === 0) && (
                    <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                      <p className="text-muted-foreground">
                        No experience entries yet.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Projects */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <LuRocket className="h-5 w-5 text-primary" /> Projects
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addProject}>
                    <LuPlus className="mr-2 h-4 w-4" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cv.projects?.map((proj, index) => (
                    <div
                      key={index}
                      className="p-4 bg-muted/30 rounded-lg border border-border"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant="secondary">Project #{index + 1}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProject(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <LuTrash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3 mb-4">
                        <Input
                          value={proj.name || ""}
                          onChange={(e) =>
                            updateProject(index, "name", e.target.value)
                          }
                          placeholder="Project Name"
                        />
                        <Input
                          value={proj.dates || ""}
                          onChange={(e) =>
                            updateProject(index, "dates", e.target.value)
                          }
                          placeholder="Dates"
                        />
                        <Input
                          value={proj.technologies || ""}
                          onChange={(e) =>
                            updateProject(index, "technologies", e.target.value)
                          }
                          className="md:col-span-2"
                          placeholder="Technologies (e.g., React, Node.js, MongoDB)"
                        />
                        <div className="md:col-span-2 space-y-2">
                          <Label className="flex items-center gap-2">
                            <LuGlobe className="h-4 w-4" /> Demo/Live Link
                            (Optional)
                          </Label>
                          <Input
                            value={proj.demo_link || ""}
                            onChange={(e) =>
                              updateProject(index, "demo_link", e.target.value)
                            }
                            placeholder="https://myproject.com or github.com/username/project"
                          />
                        </div>
                      </div>

                      <Label className="mb-2 block">Bullet Points</Label>
                      <div className="space-y-2">
                        {proj.points?.map((point, pIndex) => (
                          <div key={pIndex} className="flex gap-2">
                            <span className="text-muted-foreground mt-2.5">
                              •
                            </span>
                            <textarea
                              value={point}
                              onChange={(e) =>
                                updateProjectPoint(
                                  index,
                                  pIndex,
                                  e.target.value,
                                )
                              }
                              className="textarea-field flex-1 min-h-[60px] text-sm"
                              placeholder="Describe the project..."
                              rows={2}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProjectPoint(index, pIndex)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 mt-1"
                            >
                              <LuTrash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => addProjectPoint(index)}
                        className="mt-2 text-primary"
                      >
                        <LuPlus className="mr-1 h-3 w-3" /> Add bullet point
                      </Button>
                    </div>
                  ))}

                  {(!cv.projects || cv.projects.length === 0) && (
                    <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                      <p className="text-muted-foreground">No projects yet.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Skills */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LuWrench className="h-5 w-5 text-primary" /> Technical
                    Skills
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Programming Languages</Label>
                      <Input
                        value={cv.skills?.languages?.join(", ") || ""}
                        onChange={(e) =>
                          updateSkills("languages", e.target.value)
                        }
                        placeholder="Python, JavaScript, Java, C++"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Frameworks</Label>
                      <Input
                        value={cv.skills?.frameworks?.join(", ") || ""}
                        onChange={(e) =>
                          updateSkills("frameworks", e.target.value)
                        }
                        placeholder="React, Node.js, Django, Spring"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Developer Tools</Label>
                      <Input
                        value={cv.skills?.tools?.join(", ") || ""}
                        onChange={(e) => updateSkills("tools", e.target.value)}
                        placeholder="Git, Docker, AWS, VS Code"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Libraries</Label>
                      <Input
                        value={cv.skills?.libraries?.join(", ") || ""}
                        onChange={(e) =>
                          updateSkills("libraries", e.target.value)
                        }
                        placeholder="TensorFlow, NumPy, Pandas"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-4 justify-end pt-4">
                <Button onClick={saveCV} disabled={saving} size="lg">
                  {saving ? (
                    <LuLoader className="animate-spin mr-2 h-4 w-4" />
                  ) : (
                    <LuSave className="mr-2 h-4 w-4" />
                  )}
                  {saving ? "Saving..." : "Save Master CV"}
                </Button>
                <Link href="/tailor">
                  <Button variant="outline" size="lg">
                    Tailor for Job <LuChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
