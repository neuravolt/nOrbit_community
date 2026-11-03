export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthlyINR: number;
  priceYearlyINR: number;
  priceMonthlyUSD: number;
  priceYearlyUSD: number;
  maxMembers: number;
  maxProjects: number;
  maxServers: number;
  featureProjectsTasks: boolean;
  featureCrm: boolean;
  featureBilling: boolean;
  featureGuardianByovps: boolean;
  featureClientPortal: boolean;
  featureApiAccess: boolean;
  isPublic: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    subscriptions: number;
  };
}

export interface OrgSubscriptionInfo {
  id: string | null;
  planId: string;
  planName: string;
  planSlug: string;
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED';
  billingInterval: 'MONTHLY' | 'YEARLY';
  currency: 'INR' | 'USD';
  customMaxMembers: number | null;
  customMaxProjects: number | null;
  customMaxServers: number | null;
  expiresAt: string | null;
  trialExpiresAt: string | null;
}

export interface OrgUsageInfo {
  members: number;
  activeMembers: number;
  pendingInvitations: number;
  effectiveMaxMembers: number;
  projects: number;
  effectiveMaxProjects: number;
  servers: number;
  effectiveMaxServers: number;
}

export interface AdminOrganizationRow {
  id: string;
  name: string;
  domain: string | null;
  createdAt: string;
  subscription: OrgSubscriptionInfo;
  usage: OrgUsageInfo;
}

export interface PlanFormData {
  name: string;
  slug: string;
  description: string;
  priceMonthlyINR: number;
  priceYearlyINR: number;
  priceMonthlyUSD: number;
  priceYearlyUSD: number;
  maxMembers: number;
  maxProjects: number;
  maxServers: number;
  featureProjectsTasks: boolean;
  featureCrm: boolean;
  featureBilling: boolean;
  featureGuardianByovps: boolean;
  featureClientPortal: boolean;
  featureApiAccess: boolean;
  isPublic: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface OverrideFormData {
  planId: string;
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED';
  billingInterval: 'MONTHLY' | 'YEARLY';
  currency: 'INR' | 'USD';
  customMaxMembers: string; // string representation in input, converted to number | null
  customMaxProjects: string;
  customMaxServers: string;
  expiresAt: string; // YYYY-MM-DD
  trialExpiresAt: string; // YYYY-MM-DD
}
