"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Globe, Calendar, DollarSign, Users, X } from "lucide-react";
import { useAction } from "convex/react";
import { tenantControl } from "@/lib/convex/tenantControl";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

export function NewOrganizationForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    ownerEmail: "",
    ownerName: "",
    country: "",
    timezone: "",
    currency: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createTenant = useAction(tenantControl.provisionTenant);

  const countries = [
    { code: "KE", name: "Kenya", currency: "KES", timezone: "Africa/Nairobi" },
    { code: "UG", name: "Uganda", currency: "UGX", timezone: "Africa/Kampala" },
    { code: "TZ", name: "Tanzania", currency: "TZS", timezone: "Africa/Dar_es_Salaam" },
    { code: "RW", name: "Rwanda", currency: "RWF", timezone: "Africa/Kigali" },
    { code: "ET", name: "Ethiopia", currency: "ETB", timezone: "Africa/Addis_Ababa" },
  ];

  const handleCountryChange = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    if (country) {
      setFormData(prev => ({
        ...prev,
        country: country.name,
        currency: country.currency,
        timezone: country.timezone,
      }));
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      slug: generateSlug(value),
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Organization name is required";
    } else if (formData.name.length < 3) {
      newErrors.name = "Name must be at least 3 characters";
    }
    
    if (!formData.slug.trim()) {
      newErrors.slug = "Slug is required";
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = "Slug must contain only lowercase letters, numbers, and hyphens";
    }

    if (!formData.ownerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail.trim())) {
      newErrors.ownerEmail = "Enter a valid administrator email";
    }
    
    if (!formData.country) {
      newErrors.country = "Country is required";
    }
    
    if (!formData.currency) {
      newErrors.currency = "Currency is required";
    }
    
    if (!formData.timezone) {
      newErrors.timezone = "Timezone is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      const result = await createTenant({
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        ownerEmail: formData.ownerEmail.trim(),
        ...(formData.ownerName.trim() ? { ownerName: formData.ownerName.trim() } : {}),
        country: formData.country,
        timezone: formData.timezone,
        currency: formData.currency,
      });
      if (result.status !== "ready") {
        setErrors({ submit: result.status === "authentication_required"
          ? "Your session expired. Sign in again before provisioning the organization."
          : "The organization could not be provisioned. Try again or contact your administrator." });
        return;
      }
      router.push(`/platform/organizations/${result.tenantId}`);
    } catch (error) {
      setErrors({ submit: userFacingMessage(error, "The organization could not be provisioned. Try again or contact your administrator.") });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/platform/organizations"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-muted-foreground transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Back to Organizations
          </Link>
          <h1 className="text-3xl font-semibold text-muted-foreground tracking-tight mb-2">
            Create New Organization
          </h1>
          <p className="text-muted-foreground">
            Set up a new tenant organization. Configure basic settings before inviting team members.
          </p>
        </div>

        {/* Form */}
        <div className="bg-background rounded-xl border border-border shadow-sm">
          <form onSubmit={handleSubmit} className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Organization Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Organization Name <span className="text-foreground">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Building2 size={20} />
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Enter organization name"
                    className={`w-full pl-12 pr-4 py-3 bg-background border rounded-lg text-muted-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 ${
                      errors.name ? "border-destructive" : "border-border"
                    }`}
                  />
                </div>
                {errors.name && (
                  <p className="mt-1.5 text-sm text-foreground flex items-center gap-1">
                    <X size={14} />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Slug */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Organization Slug <span className="text-foreground">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Globe size={20} />
                  </div>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="organization-slug"
                    className={`w-full pl-12 pr-4 py-3 bg-background border rounded-lg text-muted-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 font-mono text-sm ${
                      errors.slug ? "border-destructive" : "border-border"
                    }`}
                  />
                </div>
                {errors.slug && (
                  <p className="mt-1.5 text-sm text-foreground flex items-center gap-1">
                    <X size={14} />
                    {errors.slug}
                  </p>
                )}
                <p className="mt-1.5 text-sm text-muted-foreground">
                  This address will identify the organization&apos;s workspace.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2" htmlFor="organization-owner-email">
                  Administrator email <span className="text-foreground">*</span>
                </label>
                <input
                  id="organization-owner-email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, ownerEmail: e.target.value }))}
                  className={`w-full px-4 py-3 bg-background border rounded-lg text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 ${errors.ownerEmail ? "border-destructive" : "border-border"}`}
                />
                {errors.ownerEmail ? <p className="mt-1.5 text-sm text-foreground">{errors.ownerEmail}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2" htmlFor="organization-owner-name">
                  Administrator name <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="organization-owner-name"
                  type="text"
                  maxLength={120}
                  autoComplete="name"
                  value={formData.ownerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, ownerName: e.target.value }))}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Country <span className="text-foreground">*</span>
                </label>
                <select
                  value={countries.find(c => c.name === formData.country)?.code || ""}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className={`w-full px-4 py-3 bg-background border rounded-lg text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 ${
                    errors.country ? "border-destructive" : "border-border"
                  }`}
                >
                  <option value="">Select country</option>
                  {countries.map(country => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {errors.country && (
                  <p className="mt-1.5 text-sm text-foreground flex items-center gap-1">
                    <X size={14} />
                    {errors.country}
                  </p>
                )}
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Currency <span className="text-foreground">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <DollarSign size={20} />
                  </div>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    readOnly
                    className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-lg text-muted-foreground cursor-not-allowed"
                  />
                </div>
                {errors.currency && (
                  <p className="mt-1.5 text-sm text-foreground flex items-center gap-1">
                    <X size={14} />
                    {errors.currency}
                  </p>
                )}
              </div>

              {/* Timezone */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Timezone <span className="text-foreground">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Calendar size={20} />
                  </div>
                  <input
                    type="text"
                    value={formData.timezone}
                    onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                    readOnly
                    className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-lg text-muted-foreground cursor-not-allowed"
                  />
                </div>
                {errors.timezone && (
                  <p className="mt-1.5 text-sm text-foreground flex items-center gap-1">
                    <X size={14} />
                    {errors.timezone}
                  </p>
                )}
              </div>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="mt-6 p-4 bg-muted border border-destructive rounded-lg">
                <p className="text-sm text-foreground">{errors.submit}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex items-center justify-end gap-4 pt-6 border-t border-border">
              <Link
                href="/platform/organizations"
                className="px-5 py-2.5 text-muted-foreground hover:text-muted-foreground font-medium transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-border/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Users size={18} />
                    Create Organization
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-muted border border-destructive rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Users size={16} className="text-foreground" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-1">Next Steps</h3>
              <p className="text-sm text-foreground">
                The administrator will receive secure access instructions. You can review the organization&apos;s provisioning status from its detail page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
