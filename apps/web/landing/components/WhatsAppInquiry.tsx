"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, MapPin, Users } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";

const WHATSAPP_NUMBER = "254743993715";

const SERVICE_OPTIONS = [
  "ISP billing and subscriber management",
  "Hotspot packages and vouchers",
  "Payments and reconciliation",
  "Network operations and monitoring",
  "Estate or apartment internet",
  "Hospitality or guest Wi-Fi",
  "Community network",
  "Other",
];

function WhatsAppMark({ size = 21 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.52 3.48A11.786 11.786 0 0 0 12.04 0C5.45 0 .09 5.36.09 11.95c0 2.1.55 4.14 1.6 5.95L.05 24l6.26-1.64a11.93 11.93 0 0 0 5.72 1.46h.01c6.59 0 11.95-5.36 11.95-11.95 0-3.19-1.24-6.19-3.47-8.39ZM12.04 21.8h-.01a9.92 9.92 0 0 1-5.06-1.39l-.36-.21-3.72.98.99-3.63-.24-.37a9.9 9.9 0 0 1-1.52-5.23c0-5.48 4.46-9.93 9.93-9.93 2.65 0 5.15 1.03 7.02 2.91a9.86 9.86 0 0 1 2.9 7.02c-.01 5.47-4.46 9.93-9.93 9.93Zm5.45-7.44c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.41-1.5-.89-.79-1.49-1.77-1.67-2.07-.18-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.53.07-.8.37-.27.3-1.05 1.02-1.05 2.49s1.08 2.89 1.22 3.09c.15.2 2.12 3.24 5.13 4.54.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.78-.73 2.03-1.44.25-.7.25-1.3.17-1.43-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}

export default function WhatsAppInquiry() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const [networkSize, setNetworkSize] = useState("");
  const [location, setLocation] = useState("");
  const [details, setDetails] = useState("");

  const draftMessage = [
    `Hi MylesNet team, I’m ${name.trim() || "[your name]"}.`,
    `I’m interested in ${service || "[the service you need]"}.`,
    networkSize ? `Our network serves ${networkSize}.` : "",
    location.trim() ? `We’re based in ${location.trim()}.` : "",
    details.trim() ? `A little more about what we need: ${details.trim()}` : "",
    "Please share more information.",
  ].filter(Boolean).join("\n");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(draftMessage)}`;

    window.location.assign(whatsappUrl);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button className="landing-whatsapp-trigger" type="button" aria-label="Chat with MylesNet on WhatsApp">
            <span className="landing-whatsapp-trigger-icon"><WhatsAppMark /></span>
            <span>Chat with us</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="landing-whatsapp-sheet">
          <SheetHeader className="landing-whatsapp-header">
            <span className="landing-whatsapp-brand-mark"><WhatsAppMark size={24} /></span>
            <p className="landing-whatsapp-eyebrow">MYLESNET SALES &amp; SUPPORT</p>
            <SheetTitle>Let’s talk about your network</SheetTitle>
            <SheetDescription>
              Share a few details and we’ll open a WhatsApp draft addressed to our team.
            </SheetDescription>
          </SheetHeader>
          <form className="landing-whatsapp-form" onSubmit={handleSubmit}>
            <label className="landing-whatsapp-field">
              <span>Your name <i>Required</i></span>
              <input name="name" type="text" autoComplete="name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Amina" required />
            </label>
            <label className="landing-whatsapp-field">
              <span>What can we help with? <i>Required</i></span>
              <select name="service" value={service} onChange={(event) => setService(event.target.value)} required>
                <option value="" disabled>Select a service</option>
                {SERVICE_OPTIONS.map((service) => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </label>
            <div className="landing-whatsapp-field-row">
              <label className="landing-whatsapp-field">
                <span><Users size={14} aria-hidden="true" /> Network size</span>
                <select name="networkSize" value={networkSize} onChange={(event) => setNetworkSize(event.target.value)}>
                  <option value="">Choose a range</option>
                  <option>Under 100 subscribers</option>
                  <option>100–500 subscribers</option>
                  <option>501–2,000 subscribers</option>
                  <option>More than 2,000 subscribers</option>
                  <option>Not sure yet</option>
                </select>
              </label>
              <label className="landing-whatsapp-field">
                <span><MapPin size={14} aria-hidden="true" /> Town or county</span>
                <input name="location" type="text" autoComplete="address-level2" maxLength={80} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Nakuru" />
              </label>
            </div>
            <label className="landing-whatsapp-field">
              <span>Anything else we should know? <i>Optional</i></span>
              <textarea name="details" rows={3} maxLength={500} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="A short note about your setup or what you’re looking for" />
              <small>{details.length}/500</small>
            </label>
            <div className="landing-whatsapp-preview" aria-live="polite">
              <span>MESSAGE PREVIEW</span>
              <p>{draftMessage}</p>
            </div>
            <div className="landing-whatsapp-footer">
              <Button className="landing-whatsapp-submit" type="submit">
                Open WhatsApp <ArrowUpRight size={16} aria-hidden="true" />
              </Button>
              <p className="landing-whatsapp-privacy-note">
                Your details go into a draft to +254 743 993 715. Nothing is sent until you press Send in WhatsApp.
              </p>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
