/**
 * Public website content — the ONE place to edit company details and copy.
 *
 * Rules:
 * - Anything set to `null` (or an empty list) is hidden on the website, in the
 *   footer, in the mobile call/WhatsApp bar and in search-engine structured data.
 * - Never put placeholder numbers, addresses, testimonials or awards here. Only
 *   real, confirmed facts. Search for `TODO(client)` to see what is still missing.
 * - Keep this file free of `@/` imports: it is shared by server code, client
 *   components and unit tests.
 */

export type PostalAddress = {
  streetAddress: string;
  locality: string; // city / town
  region: string; // state, e.g. "Tamil Nadu"
  postalCode: string;
  country: "IN";
};

export type SocialLinks = {
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  linkedin: string | null;
  pinterest: string | null;
};

export type Stat = { value: string; label: string };

export type SiteConfig = {
  name: string;
  description: string;
  /** Absolute origin of the public site, no trailing slash. */
  url: string;
  email: string;
  /** Sales phone in international format, e.g. "+91 98765 43210". */
  phone: string | null;
  /** WhatsApp Business number, digits only with country code, e.g. "919876543210". */
  whatsapp: string | null;
  /** Message pre-filled when a visitor taps "WhatsApp". Never include personal data. */
  whatsappMessage: string;
  address: PostalAddress | null;
  /** Primary city, used in page titles and structured data. */
  city: string | null;
  serviceAreas: string[] | null;
  /** Human-readable opening hours, e.g. "Mon–Sat, 10am–7pm". */
  openingHours: string | null;
  foundingYear: number | null;
  stats: Stat[] | null;
  social: SocialLinks;
  /** Shown after an enquiry is sent. */
  callbackPromise: string;
};

function originFromEnv(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

export const site: SiteConfig = {
  name: "Velan Spaces",
  description:
    "Velan Spaces designs and builds home interiors, modular kitchens, wardrobes and workspaces, with itemised quotations and live progress updates in our client app.",
  // Public origin used for canonical URLs, sitemap, robots and structured data.
  // Reads APP_URL (same variable the root layout uses for metadataBase); public
  // pages are prerendered, so set it at BUILD time as well as at runtime.
  // TODO(client): confirm the production domain (fallback assumed from the email domain).
  url: originFromEnv(process.env.APP_URL) ?? "https://velanspaces.com",
  email: "support@velanspaces.com",
  phone: null, // TODO(client): sales phone number, e.g. "+91 9xxxx xxxxx"
  whatsapp: null, // TODO(client): WhatsApp Business number, digits only with country code
  whatsappMessage: "Hi Velan Spaces, I'd like to talk about an interior project.",
  address: null, // TODO(client): studio address (shown in footer, contact page and Google structured data)
  city: null, // TODO(client): primary city, e.g. "Chennai"
  serviceAreas: null, // TODO(client): cities/areas you take projects in
  openingHours: null, // TODO(client): e.g. "Mon–Sat, 10am–7pm"
  foundingYear: null, // TODO(client): year founded — only if you want it shown
  stats: null, // TODO(client): real numbers only, e.g. [{ value: "120+", label: "Homes delivered" }]
  social: {
    instagram: null, // TODO(client): full profile URL
    facebook: null, // TODO(client)
    youtube: null, // TODO(client)
    linkedin: null, // TODO(client)
    pinterest: null, // TODO(client)
  },
  callbackPromise: "We'll call you within one working day.", // TODO(client): confirm SLA
};

/* -------------------------------------------------------------------------- */
/* Services                                                                    */
/* -------------------------------------------------------------------------- */

export type Service = {
  slug: string;
  title: string;
  /** One line for cards. */
  summary: string;
  /** Short paragraph for the services page. */
  description: string;
  includes: string[];
  /** Line-art illustration in /public/marketing. */
  illustration: string;
};

// TODO(client): confirm list — services, wording and what each one includes.
export const services: Service[] = [
  {
    slug: "full-home-interiors",
    title: "Full home interiors (turnkey)",
    summary: "One team from the first drawing to the day you move in.",
    description:
      "We design the whole home, then manage every trade that builds it: civil changes, carpentry, electrical, painting and final styling. You deal with one team and one plan.",
    includes: [
      "Space planning and design for every room",
      "Material, finish and lighting selection",
      "Civil, carpentry, electrical and painting work",
      "Site supervision through to handover",
    ],
    illustration: "/marketing/room-living.svg",
  },
  {
    slug: "modular-kitchens",
    title: "Modular kitchens",
    summary: "Kitchens planned around how you cook and what you store.",
    description:
      "We start with how your household cooks, then plan the layout, storage and appliances before anything is made, so every drawer has a job.",
    includes: [
      "Layout planning for the space you have",
      "Base, wall and tall storage units",
      "Countertop, backsplash and hardware selection",
      "Appliance and lighting placement",
    ],
    illustration: "/marketing/room-kitchen.svg",
  },
  {
    slug: "wardrobes-storage",
    title: "Wardrobes & storage",
    summary: "Wardrobes, lofts and built-ins made to fit your rooms.",
    description:
      "Storage designed for the room it sits in and the things you own, from full-height wardrobes to lofts, shoe racks and study units.",
    includes: [
      "Hinged and sliding wardrobes",
      "Lofts and overhead storage",
      "Internal layouts: drawers, hanging and shelves",
      "Study, crockery and utility units",
    ],
    illustration: "/marketing/room-wardrobe.svg",
  },
  {
    slug: "living-bedroom-interiors",
    title: "Living & bedroom interiors",
    summary: "The rooms you use most, finished properly.",
    description:
      "TV units, wall treatments, ceilings, lighting and furniture that make living rooms and bedrooms feel complete and easy to live in.",
    includes: [
      "TV and display units",
      "Wall panelling and feature walls",
      "False ceilings and lighting design",
      "Beds, side tables and loose furniture",
    ],
    illustration: "/marketing/room-bedroom.svg",
  },
  {
    slug: "office-commercial",
    title: "Office & commercial fit-outs",
    summary: "Workspaces and shops planned for how people move through them.",
    description:
      "Offices, studios and retail spaces designed around your team and your customers, then built with minimal disruption to your business.",
    includes: [
      "Workstations, cabins and meeting rooms",
      "Reception and customer areas",
      "Storage, display and branding walls",
      "Electrical, data and lighting layouts",
    ],
    illustration: "/marketing/room-office.svg",
  },
  {
    slug: "renovation-civil",
    title: "Renovation & civil work",
    summary: "Wall changes, flooring, tiling, plumbing and electrical upgrades.",
    description:
      "Structural and civil changes handled alongside the interior work, so the base of the room is right before the finishes go on.",
    includes: [
      "Wall changes and openings",
      "Flooring and tiling",
      "Plumbing and electrical upgrades",
      "Painting and finishing",
    ],
    illustration: "/marketing/room-renovation.svg",
  },
];

/* -------------------------------------------------------------------------- */
/* Process — a real sequence, so it is numbered on the site                    */
/* -------------------------------------------------------------------------- */

export type ProcessStep = { title: string; description: string };

export const processSteps: ProcessStep[] = [
  {
    title: "Consultation",
    description:
      "A conversation about your space, how you live or work in it, your timeline and your budget range.",
  },
  {
    title: "Site visit & measurement",
    description:
      "We visit, measure every wall and opening, and note what needs to change before design starts.",
  },
  {
    title: "Design & 3D",
    description:
      "Layouts and 3D views of each space, revised with you until you are happy with how it will look.",
  },
  {
    title: "Transparent quotation",
    description:
      "An itemised quotation that lists materials, quantities and rates, so you know what you are paying for.",
  },
  {
    title: "Execution & handover",
    description:
      "We build it. Site photos, approved designs and the project timeline appear in the Velan Spaces app as work happens, through to handover.",
  },
];

/* -------------------------------------------------------------------------- */
/* Client app / portal — the real differentiator                               */
/* -------------------------------------------------------------------------- */

export const portalFeatures: { title: string; description: string }[] = [
  {
    title: "Site photos and updates",
    description: "See progress notes and photos from site as soon as the team posts them.",
  },
  {
    title: "Your designs in one place",
    description: "Every approved drawing and 3D view, without digging through chats.",
  },
  {
    title: "A timeline you can read",
    description: "What is done, what is happening now and what comes next.",
  },
  {
    title: "Questions, tracked",
    description: "Raise a question or concern and follow it until it is resolved.",
  },
];

/* -------------------------------------------------------------------------- */
/* About — approach and values (no invented history)                           */
/* -------------------------------------------------------------------------- */

// TODO(client): review the wording of these values.
export const values: { title: string; description: string }[] = [
  {
    title: "Drawn before it is built",
    description:
      "You see layouts and 3D views of your space and approve them before work starts on site. Changes are cheapest on paper.",
  },
  {
    title: "Prices you can read",
    description:
      "Our quotations are itemised: materials, quantities and rates on separate lines, so you can compare and decide with confidence.",
  },
  {
    title: "Progress you can see",
    description:
      "Clients follow their project in the Velan Spaces app and web portal: site photos, designs and the timeline, updated as work happens.",
  },
  {
    title: "One team, start to finish",
    description:
      "Design and execution stay with the same team, so what you approved is what gets built.",
  },
];

/* -------------------------------------------------------------------------- */
/* Enquiry form options                                                        */
/* -------------------------------------------------------------------------- */

export const budgetRanges = ["Under ₹5 L", "₹5–10 L", "₹10–20 L", "₹20–50 L", "₹50 L+"] as const;

export const otherProjectType = "Something else";

/* -------------------------------------------------------------------------- */
/* Navigation                                                                  */
/* -------------------------------------------------------------------------- */

export const mainNav: { href: string; label: string; segment: string | null }[] = [
  { href: "/", label: "Home", segment: null },
  { href: "/services", label: "Services", segment: "services" },
  { href: "/portfolio", label: "Portfolio", segment: "portfolio" },
  { href: "/about", label: "About", segment: "about" },
  { href: "/contact", label: "Contact", segment: "contact" },
];

/* -------------------------------------------------------------------------- */
/* Helpers for optional contact channels                                       */
/* -------------------------------------------------------------------------- */

/** `tel:` href, or null when no phone is configured. */
export function telHref(phone: string | null = site.phone): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 8 ? `tel:${digits}` : null;
}

/** `https://wa.me/...` href with a pre-filled message, or null when not configured. */
export function whatsappHref(
  number: string | null = site.whatsapp,
  message: string = site.whatsappMessage,
): string | null {
  if (!number) return null;
  const digits = number.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Social profile links that are actually set. */
export function socialLinks(social: SocialLinks = site.social): { label: string; href: string }[] {
  const labels: Record<keyof SocialLinks, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    youtube: "YouTube",
    linkedin: "LinkedIn",
    pinterest: "Pinterest",
  };
  return (Object.keys(labels) as (keyof SocialLinks)[])
    .map((key) => ({ label: labels[key], href: social[key] }))
    .filter((link): link is { label: string; href: string } => typeof link.href === "string" && link.href.startsWith("https://"));
}
