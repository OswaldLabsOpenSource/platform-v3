import { AuditStatuses, AuditRepeat } from "../enum";
import { IdRow } from "../general";
import { Webhooks } from "../enum";
import { subscriptions } from "stripe";

export interface Organization extends IdRow {
  name?: string;
  username?: string;
  forceTwoFactor?: boolean;
  autoJoinDomain?: boolean;
  onlyAllowDomain?: boolean;
  ipRestrictions?: string;
  stripeCustomerId?: string;
  profilePicture?: string;
}

export interface ApiKey extends IdRow {
  name?: string;
  description?: string;
  jwtApiKey?: string;
  scopes?: string;
  organizationId: string;
  ipRestrictions?: string;
  referrerRestrictions?: string;
  expiresAt?: Date;
}

export interface Domain extends IdRow {
  organizationId: string;
  domain: string;
  verificationCode?: string;
  isVerified: boolean;
}

export interface Webhook extends IdRow {
  organizationId: string;
  url: string;
  event: Webhooks;
  contentType: "application/json" | "application/x-www-form-urlencoded";
  secret?: string;
  isActive: boolean;
}

export interface Audit extends IdRow {
  status?: AuditStatuses;
  auditUrlId?: string;
  finalUrl?: string;
  timing: number;
  scorePerformance: number;
  scoreAccessibility: number;
  scoreBestPractices: number;
  scoreSeo: number;
  scorePwa: number;
}

export interface AuditWebpage extends IdRow {
  organizationId: string;
  url: string;
  repeatEvery?: AuditRepeat;
  lastAuditAt?: Date;
}

export interface AgastyaApiKey extends IdRow {
  organizationId: string;
  subscriptionId?: string;
  subscription?: subscriptions.ISubscription;
  eventsConsumed?: number;
  eventsUpdatedAt?: Date;
  name: string;
  slug: string;
  backgroundColor?: string;
  foregroundColor?: string;
  domains?: string;
  customCss?:
    | string
    | {
        title: string;
        css: string;
      }[];
  variables?:
    | string
    | {
        [index: string]: string | boolean;
      };
  links?:
    | string
    | {
        [index: string]: string;
      };
  layout?:
    | string
    | {
        type: string;
        slug: string;
        [index: string]: string | boolean | number;
      }[];
  integrations?:
    | string
    | {
        [index: string]:
          | string
          | {
              [index: string]: string | number | boolean;
            };
      };
  protectedInfo?:
    | string
    | {
        [index: string]:
          | string
          | {
              [index: string]: string | number | boolean;
            };
      };
}
