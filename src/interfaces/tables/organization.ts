import { AuditStatuses } from "../enum";

export interface Organization {
  id?: number;
  name?: string;
  username?: string;
  forceTwoFactor?: boolean;
  ipRestrictions?: string;
  invitationDomain?: string;
  stripeCustomerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Audit {
  id?: number;
  status?: AuditStatuses;
  auditUrlId?: number;
  finalUrl?: string;
  timing: number;
  scorePerformance: number;
  scoreAccessibility: number;
  scoreBestPractices: number;
  scoreSeo: number;
  scorePwa: number;
  createdAt?: Date;
  updatedAt: Date;
}
