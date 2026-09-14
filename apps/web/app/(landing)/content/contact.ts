export const MYLESCORP_SOCIAL_LINKS = {
  linkedin: "https://www.linkedin.com/company/mylescorptech",
  facebook: "https://www.facebook.com/mylescorptech",
  twitter: "https://www.twitter.com/mylescorptech",
  youtube: "https://www.youtube.com/@mylescorptech",
  instagram: "https://www.instagram.com/mylescorptech",
  tiktok: "https://www.tiktok.com/@mylescorptech",
} as const;

export type CompanyContact = {
  infoEmail: string | null;
  contactEmail: string | null;
  salesEmail: string | null;
  technicalPhone: string | null;
  salesPhone: string | null;
};

export function getCompanyContact(): CompanyContact {
  return {
    infoEmail: process.env.NEXT_PUBLIC_COMPANY_INFO_EMAIL || null,
    contactEmail: process.env.NEXT_PUBLIC_COMPANY_CONTACT_EMAIL || null,
    salesEmail: process.env.NEXT_PUBLIC_COMPANY_SALES_EMAIL || null,
    technicalPhone: process.env.NEXT_PUBLIC_COMPANY_TECHNICAL_PHONE || null,
    salesPhone: process.env.NEXT_PUBLIC_COMPANY_SALES_PHONE || null,
  };
}