"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { LuCircleCheck, LuLoader, LuSend } from "react-icons/lu";

export function ContactForm() {
  const [status, setStatus] = useState("idle");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    await new Promise((resolve) => setTimeout(resolve, 600));
    setStatus("sent");
    e.target.reset();
  };

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <LuCircleCheck className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Message sent</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Thanks for reaching out. Our team typically responds within 2
          business days.
        </p>
        <Button variant="outline" onClick={() => setStatus("idle")}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" name="name" placeholder="Jane Doe" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="jane@example.com"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <select
          id="subject"
          name="subject"
          defaultValue=""
          required
          className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 transition-all duration-200"
        >
          <option value="" disabled>
            Select a topic
          </option>
          <option value="support">Technical Support</option>
          <option value="billing">Billing Inquiry</option>
          <option value="feedback">Product Feedback</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          rows={5}
          placeholder="How can we help you today?"
          required
          className="flex w-full rounded-lg border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 transition-all duration-200 resize-y"
        />
      </div>

      <Button type="submit" size="lg" disabled={status === "sending"}>
        {status === "sending" ? (
          <>
            <LuLoader className="animate-spin" />
            Sending...
          </>
        ) : (
          <>
            Send Message
            <LuSend />
          </>
        )}
      </Button>
    </form>
  );
}
