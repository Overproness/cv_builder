"use client";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import {
  LuCheck,
  LuKey,
  LuLoader,
  LuSettings,
  LuUser,
  LuZap,
} from "react-icons/lu";

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

  // API Key
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  // Token usage
  const [tokenUsage, setTokenUsage] = useState(null);

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
        setHasApiKey(data.hasApiKey || false);
        setMaskedApiKey(data.maskedApiKey || "");
        setTokenUsage(data.tokenUsage || null);
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

  const handleSaveApiKey = async () => {
    setSavingKey(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiApiKey }),
      });
      if (res.ok) {
        const data = await res.json();
        setHasApiKey(data.hasApiKey);
        setMaskedApiKey(data.maskedApiKey || "");
        setGeminiApiKey("");
        setShowApiKeyInput(false);
        showMessage("API key saved!", "success");
      } else {
        const d = await res.json();
        showMessage(d.error || "Failed to save API key", "error");
      }
    } catch {
      showMessage("Failed to save API key", "error");
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveApiKey = async () => {
    setSavingKey(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiApiKey: "" }),
      });
      if (res.ok) {
        setHasApiKey(false);
        setMaskedApiKey("");
        setGeminiApiKey("");
        showMessage("API key removed.", "success");
      }
    } catch {
      showMessage("Failed to remove API key", "error");
    } finally {
      setSavingKey(false);
    }
  };

  const formatCost = (cost) => {
    if (!cost || cost === 0) return "$0.00";
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  const formatTokens = (n) => {
    if (!n) return "0";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
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
                Manage your personal info, API key, and usage
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
                <Input
                  value={authName}
                  disabled
                  className="bg-muted/40 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Account email</Label>
                <Input
                  value={authEmail}
                  disabled
                  className="bg-muted/40 h-9 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Gemini API Key */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <LuKey className="h-4 w-4 text-primary" />
                Gemini API Key
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Your own Google Gemini API key is required for AI features.{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Get one free from Google AI Studio
                </a>
              </p>
            </CardHeader>
            <CardContent className="pt-0 flex flex-col gap-3">
              {hasApiKey && !showApiKeyInput ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 text-sm font-mono">
                    <LuCheck className="h-4 w-4 text-green-500" />
                    <span>{maskedApiKey}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApiKeyInput(true)}
                  >
                    Change
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveApiKey}
                    disabled={savingKey}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Paste your Gemini API key (e.g. AIzaSy...)"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      className="h-9 text-sm font-mono flex-1"
                    />
                    <Button
                      onClick={handleSaveApiKey}
                      disabled={savingKey || !geminiApiKey.trim()}
                      size="sm"
                    >
                      {savingKey ? (
                        <LuLoader className="animate-spin h-4 w-4" />
                      ) : (
                        "Save Key"
                      )}
                    </Button>
                    {hasApiKey && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowApiKeyInput(false);
                          setGeminiApiKey("");
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your key is encrypted and stored securely. It is only used
                    to call Gemini on your behalf.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Token Usage */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <LuZap className="h-4 w-4 text-primary" />
                API Usage &amp; Cost
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Token usage and estimated cost (Gemini 2.0 Flash pricing:
                $0.10/1M input, $0.40/1M output)
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {tokenUsage ? (
                <div className="flex flex-col gap-4">
                  {/* Summary stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Total Tokens
                      </p>
                      <p className="text-lg font-bold text-primary">
                        {formatTokens(tokenUsage.totalTokens)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Input Tokens
                      </p>
                      <p className="text-lg font-bold">
                        {formatTokens(tokenUsage.totalInputTokens)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Output Tokens
                      </p>
                      <p className="text-lg font-bold">
                        {formatTokens(tokenUsage.totalOutputTokens)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Total Cost
                      </p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCost(tokenUsage.totalCost)}
                      </p>
                    </div>
                  </div>

                  {/* Recent requests */}
                  {tokenUsage.requests && tokenUsage.requests.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        Recent Requests
                      </p>
                      <div className="max-h-60 overflow-y-auto border border-border rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr>
                              <th className="text-left p-2 font-medium">
                                Type
                              </th>
                              <th className="text-right p-2 font-medium">
                                Input
                              </th>
                              <th className="text-right p-2 font-medium">
                                Output
                              </th>
                              <th className="text-right p-2 font-medium">
                                Total
                              </th>
                              <th className="text-right p-2 font-medium">
                                Cost
                              </th>
                              <th className="text-right p-2 font-medium">
                                Time
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...tokenUsage.requests]
                              .reverse()
                              .map((req, i) => (
                                <tr
                                  key={i}
                                  className="border-t border-border hover:bg-muted/30"
                                >
                                  <td className="p-2 capitalize">
                                    {req.type}
                                  </td>
                                  <td className="p-2 text-right">
                                    {req.inputTokens?.toLocaleString()}
                                  </td>
                                  <td className="p-2 text-right">
                                    {req.outputTokens?.toLocaleString()}
                                  </td>
                                  <td className="p-2 text-right font-medium">
                                    {req.totalTokens?.toLocaleString()}
                                  </td>
                                  <td className="p-2 text-right text-green-600 dark:text-green-400">
                                    {formatCost(req.cost)}
                                  </td>
                                  <td className="p-2 text-right text-muted-foreground">
                                    {new Date(req.timestamp).toLocaleDateString(
                                      undefined,
                                      {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No usage data yet. Start generating to see your token usage.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cover Letter Defaults */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cover Letter Defaults</CardTitle>
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
                  <span className="text-muted-foreground">
                    (body content only)
                  </span>
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

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto"
              >
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
