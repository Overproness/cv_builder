"use client";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { LuCheck, LuLoader, LuSettings, LuUser } from "react-icons/lu";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Profile info
  const [authEmail, setAuthEmail] = useState("");
  const [authName, setAuthName] = useState("");

  // Editable settings
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [coverLetterEmail, setCoverLetterEmail] = useState("");
  const [coverLetterWordCount, setCoverLetterWordCount] = useState(250);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setAuthEmail(data.email || "");
        setAuthName(data.name || "");
        setDisplayName(data.settings?.displayName || data.name || "");
        setPhone(data.settings?.phone || "");
        setCoverLetterEmail(
          data.settings?.coverLetterEmail || data.email || "",
        );
        setCoverLetterWordCount(data.settings?.coverLetterWordCount || 250);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          phone,
          coverLetterEmail,
          coverLetterWordCount: Number(coverLetterWordCount),
        }),
      });
      if (res.ok) {
        showMessage("Settings saved successfully!", "success");
      } else {
        const d = await res.json();
        showMessage(d.error || "Failed to save", "error");
      }
    } catch {
      showMessage("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <LuSettings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Profile &amp; Settings</h1>
              <p className="text-sm text-muted-foreground">
                Manage your personal info used in cover letters
              </p>
            </div>
          </div>

          {/* Account Info */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <LuUser className="h-4 w-4 text-primary" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 grid gap-3">
              <div>
                <Label className="text-xs mb-1 block">Account name</Label>
                <Input value={authName} disabled className="bg-muted/40 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Account email</Label>
                <Input value={authEmail} disabled className="bg-muted/40 h-9 text-sm" />
              </div>
            </CardContent>
          </Card>

          {/* Cover Letter Defaults */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Cover Letter Defaults
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                These values are used in the header of every cover letter you
                generate.
              </p>
            </CardHeader>
            <CardContent className="pt-0 grid gap-4">
              <div>
                <Label htmlFor="displayName" className="text-xs mb-1 block">
                  Full name (as it appears on cover letter)
                </Label>
                <Input
                  id="displayName"
                  placeholder="e.g. Muhammad Wasif Shakeel"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-xs mb-1 block">
                  Phone number
                </Label>
                <Input
                  id="phone"
                  placeholder="e.g. +92318510932"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="clEmail" className="text-xs mb-1 block">
                  Email shown on cover letter
                </Label>
                <Input
                  id="clEmail"
                  type="email"
                  placeholder="e.g. your@email.com"
                  value={coverLetterEmail}
                  onChange={(e) => setCoverLetterEmail(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="wordCount" className="text-xs mb-1 block">
                  Default cover letter word count{" "}
                  <span className="text-muted-foreground">(body content only)</span>
                </Label>
                <Input
                  id="wordCount"
                  type="number"
                  min={100}
                  max={600}
                  step={10}
                  value={coverLetterWordCount}
                  onChange={(e) => setCoverLetterWordCount(e.target.value)}
                  className="h-9 text-sm max-w-[140px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: 200–350 words. Default is 250.
                </p>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                {saving ? (
                  <>
                    <LuLoader className="animate-spin mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <LuCheck className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
