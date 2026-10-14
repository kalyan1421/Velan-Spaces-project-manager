/**
 * Hand-written API types matching WEB_APP_PLAN.md §4 (camelCase JSON).
 * When the API is reachable, `npm run gen:api` generates `schema.d.ts` from Swagger;
 * prefer that for new modules and keep these in sync until then.
 */

export type Role = "head" | "manager" | "worker" | "client";
export const ROLES: readonly Role[] = ["head", "manager", "worker", "client"] as const;

/** Postgres `numeric` columns may arrive as strings. Always read them with `toNumber()`. */
export type Money = number | string;

export type User = {
  id: string;
  email: string | null;
  username?: string | null;
  role: Role;
  displayName: string | null;
  isSuspended: boolean;
};

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
};

export type Session = TokenSet & { user: User };

/** Standard error envelope from the API's exception filter. */
export type ApiErrorBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  details?: unknown;
};

// ------------------------------------------------------------------ auth

export type LoginBody =
  | { email: string; password: string }
  | { identifier: string; password: string };

export type InviteDetails = {
  email: string | null;
  displayName: string | null;
  projectName: string | null;
  expiresAt: string | null;
  accountExists: boolean;
};

export type InviteAcceptBody = { password?: string; displayName?: string };
export type InviteAcceptResult = Session | { accountExists: true };

export type ChangePasswordBody = { currentPassword: string; newPassword: string };

// ------------------------------------------------------------------ projects

export type Project = {
  id: string;
  projectCode: string;
  projectName: string;
  clientName: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  location: string | null;
  /** Present only for head and budget-access managers. */
  budget?: Money;
  estimatedCost?: Money;
  currentSpend?: Money;
  completionPercentage: number;
  isComplete: boolean;
  startDate: string | null;
  targetEndDate: string | null;
  createdAt: string;
  updatedAt?: string;
  managerIds?: string[];
  workerIds?: string[];
  clientIds?: string[];
  budgetAccessManagerIds?: string[];
};

// ------------------------------------------------------------------ notifications

export type Notification = {
  id: string;
  recipientId?: string | null;
  title: string | null;
  body: string | null;
  type: string | null;
  projectId: string | null;
  projectName: string | null;
  senderId?: string | null;
  senderName?: string | null;
  isRead: boolean;
  createdAt: string;
};

export type UnreadCount = { unread: number };

// ------------------------------------------------------------------ website (B1)

export type PortfolioCategory = "residential" | "commercial" | "office" | "kitchen" | "other";
export type PortfolioStatus = "draft" | "published" | "hidden";

export type PortfolioItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: PortfolioCategory;
  location: string | null;
  completionYear: number | null;
  coverImageUrl: string | null;
  imageUrls: string[];
  status: PortfolioStatus;
  sortOrder: number;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicPortfolioItem = Omit<PortfolioItem, "status" | "projectId">;

export type EnquiryInput = {
  name: string;
  phone: string;
  email?: string;
  location?: string;
  projectType?: string;
  budgetRange?: string;
  message?: string;
  /** Honeypot: must be empty. */
  company?: string;
};
