import {
  query,
  tableValues,
  setValues,
  removeReadOnlyValues,
  tableName
} from "../helpers/mysql";
import {
  Organization,
  Domain,
  Webhook,
  Audit,
  AgastyaApiKey
} from "../interfaces/tables/organization";
import {
  capitalizeFirstAndLastLetter,
  createSlug,
  dateToDateTime
} from "../helpers/utils";
import { KeyValue } from "../interfaces/general";
import { cachedQuery, deleteItemFromCache } from "../helpers/cache";
import {
  CacheCategories,
  ErrorCode,
  AuditRepeat,
  Webhooks
} from "../interfaces/enum";
import cryptoRandomString from "crypto-random-string";
import { getPaginatedData } from "./data";
import { scheduleAudit } from "./api";
import { ApiKey, AuditWebpage } from "../interfaces/tables/organization";
import { apiKeyToken, invalidateToken } from "../helpers/jwt";
import { TOKEN_EXPIRY_API_KEY_MAX, JWT_ISSUER } from "../config";
import { InsertResult } from "../interfaces/mysql";

/*
 * Create a new organization for a user
 */
export const createOrganization = async (organization: Organization) => {
  if (!organization.name) throw new Error(ErrorCode.INVALID_INPUT);
  organization.name = capitalizeFirstAndLastLetter(organization.name);
  organization.createdAt = new Date();
  organization.updatedAt = organization.createdAt;
  organization.username = createSlug(organization.name);
  // Create organization
  return await query(
    `INSERT INTO ${tableName("organizations")} ${tableValues(organization)}`,
    Object.values(organization)
  );
};

/*
 * Get the details of a specific organization
 */
export const getOrganization = async (id: number) => {
  const org = (<Organization[]>(
    await cachedQuery(
      CacheCategories.ORGANIZATION,
      id,
      `SELECT * FROM ${tableName("organizations")} WHERE id = ? LIMIT 1`,
      [id]
    )
  ))[0];
  if (org) return org;
  throw new Error(ErrorCode.ORGANIZATION_NOT_FOUND);
};

/*
 * Get the details of a specific organization
 */
export const getOrganizationIdFromUsername = async (username: string) => {
  const org = (<Organization[]>(
    await cachedQuery(
      CacheCategories.ORGANIZATION_USERNAME,
      username,
      `SELECT id FROM ${tableName("organizations")} WHERE username = ? LIMIT 1`,
      [username]
    )
  ))[0];
  if (org && org.id) return org.id;
  throw new Error(ErrorCode.ORGANIZATION_NOT_FOUND);
};

/*
 * Update an organization
 */
export const updateOrganization = async (
  id: number,
  organization: KeyValue
) => {
  organization.updatedAt = new Date();
  organization = removeReadOnlyValues(organization);
  const originalOrganization = await getOrganization(id);
  if (
    organization.username &&
    originalOrganization.username &&
    organization.username !== originalOrganization.username
  ) {
    const currentOwner = await getOrganizationIdFromUsername(
      originalOrganization.username
    );
    if (currentOwner != id) throw new Error(ErrorCode.USERNAME_EXISTS);
    deleteItemFromCache(
      CacheCategories.ORGANIZATION_USERNAME,
      originalOrganization.username
    );
  }
  deleteItemFromCache(CacheCategories.ORGANIZATION, id);
  return await query(
    `UPDATE ${tableName("organizations")} SET ${setValues(
      organization
    )} WHERE id = ?`,
    [...Object.values(organization), id]
  );
};

/*
 * Delete an organization
 */
export const deleteOrganization = async (id: number) => {
  deleteItemFromCache(CacheCategories.ORGANIZATION, id);
  return await query(`DELETE FROM ${tableName("organizations")} WHERE id = ?`, [
    id
  ]);
};

/*
 * Get all ${tableName("organizations")}
 */
export const getAllOrganizations = async () => {
  return <Organization[]>(
    await query(`SELECT * FROM ${tableName("organizations")}`)
  );
};

/**
 * Get a list of all approved locations of a user
 */
export const getOrganizationApiKeys = async (
  organizationId: number,
  query: KeyValue
) => {
  return await getPaginatedData({
    table: "api-keys",
    conditions: {
      organizationId
    },
    ...query
  });
};

/**
 * Get an API key
 */
export const getApiKey = async (organizationId: number, apiKeyId: number) => {
  return (<ApiKey[]>(
    await query(
      `SELECT * FROM ${tableName(
        "api-keys"
      )} WHERE id = ? AND organizationId = ? LIMIT 1`,
      [apiKeyId, organizationId]
    )
  ))[0];
};

/**
 * Create an API key
 */
export const createApiKey = async (apiKey: ApiKey) => {
  apiKey.expiresAt = apiKey.expiresAt || new Date(TOKEN_EXPIRY_API_KEY_MAX);
  apiKey.createdAt = new Date();
  apiKey.updatedAt = apiKey.createdAt;
  apiKey.jwtApiKey = await apiKeyToken(apiKey);
  return await query(
    `INSERT INTO ${tableName("api-keys")} ${tableValues(apiKey)}`,
    Object.values(apiKey)
  );
};

/**
 * Update a user's details
 */
export const updateApiKey = async (
  organizationId: number,
  apiKeyId: number,
  data: KeyValue
) => {
  data.updatedAt = new Date();
  data = removeReadOnlyValues(data);
  const apiKey = await getApiKey(organizationId, apiKeyId);
  if (apiKey.jwtApiKey) await invalidateToken(apiKey.jwtApiKey);
  data.jwtApiKey = await apiKeyToken({ ...apiKey, ...data });
  return await query(
    `UPDATE ${tableName("api-keys")} SET ${setValues(
      data
    )} WHERE id = ? AND organizationId = ?`,
    [...Object.values(data), apiKeyId, organizationId]
  );
};

/**
 * Delete an API key
 */
export const deleteApiKey = async (
  organizationId: number,
  apiKeyId: number
) => {
  const currentApiKey = await getApiKey(organizationId, apiKeyId);
  if (currentApiKey.jwtApiKey) await invalidateToken(currentApiKey.jwtApiKey);
  return await query(
    `DELETE FROM ${tableName(
      "api-keys"
    )} WHERE id = ? AND organizationId = ? LIMIT 1`,
    [apiKeyId, organizationId]
  );
};

/**
 * Get a list of domains for an organization
 */
export const getOrganizationDomains = async (
  organizationId: number,
  query: KeyValue
) => {
  return await getPaginatedData({
    table: "domains",
    conditions: {
      organizationId
    },
    ...query
  });
};

/**
 * Get a domain
 */
export const getDomain = async (organizationId: number, domainId: number) => {
  return (<Domain[]>(
    await query(
      `SELECT * FROM ${tableName(
        "domains"
      )} WHERE id = ? AND organizationId = ? LIMIT 1`,
      [domainId, organizationId]
    )
  ))[0];
};

/**
 * Get a domain
 */
export const getDomainByDomainName = async (domain: string) => {
  return (<Domain[]>(
    await query(
      `SELECT * FROM ${tableName(
        "domains"
      )} WHERE domain = ? AND isVerified = ? LIMIT 1`,
      [domain, true]
    )
  ))[0];
};

/**
 * Create a domain
 */
export const createDomain = async (domain: Domain): Promise<InsertResult> => {
  domain.createdAt = new Date();
  domain.updatedAt = domain.createdAt;
  domain.verificationCode = `${JWT_ISSUER}=${cryptoRandomString({
    length: 32
  })}`;
  return await query(
    `INSERT INTO ${tableName("domains")} ${tableValues(domain)}`,
    Object.values(domain)
  );
};

/**
 * Update a domain
 */
export const updateDomain = async (
  organizationId: number,
  domainId: number,
  data: KeyValue
) => {
  data.updatedAt = new Date();
  data = removeReadOnlyValues(data);
  const domain = await getDomain(organizationId, domainId);
  return await query(
    `UPDATE ${tableName("domains")} SET ${setValues(
      data
    )} WHERE id = ? AND organizationId = ?`,
    [...Object.values(data), domainId, organizationId]
  );
};

/**
 * Delete a domain
 */
export const deleteDomain = async (
  organizationId: number,
  domainId: number
) => {
  const currentDomain = await getDomain(organizationId, domainId);
  return await query(
    `DELETE FROM ${tableName(
      "domains"
    )} WHERE id = ? AND organizationId = ? LIMIT 1`,
    [domainId, organizationId]
  );
};

/**
 * Get a user by their username
 */
export const checkDomainAvailability = async (username: string) => {
  try {
    const domain = await getDomainByDomainName(username);
    if (domain && domain.id) return false;
  } catch (error) {}
  return true;
};

/**
 * Get a list of webhooks for an organization
 */
export const getOrganizationWebhooks = async (
  organizationId: number,
  query: KeyValue
) => {
  return await getPaginatedData({
    table: "webhooks",
    conditions: {
      organizationId
    },
    ...query
  });
};

/**
 * Get a webhook
 */
export const getOrganizationEventWebhooks = async (
  organizationId: number,
  event: Webhooks
) => {
  return <Webhook[]>(
    await query(
      `SELECT * FROM ${tableName(
        "webhooks"
      )} WHERE organizationId = ? AND (event = ? OR event = "*")`,
      [organizationId, event]
    )
  );
};

/**
 * Get a webhook
 */
export const getWebhook = async (organizationId: number, webhookId: number) => {
  return (<Webhook[]>(
    await query(
      `SELECT * FROM ${tableName(
        "webhooks"
      )} WHERE id = ? AND organizationId = ? LIMIT 1`,
      [webhookId, organizationId]
    )
  ))[0];
};

/**
 * Create a webhook
 */
export const createWebhook = async (
  webhook: Webhook
): Promise<InsertResult> => {
  webhook.contentType = webhook.contentType || "application/json";
  webhook.isActive = webhook.isActive !== false;
  webhook.createdAt = new Date();
  webhook.updatedAt = webhook.createdAt;
  return await query(
    `INSERT INTO ${tableName("webhooks")} ${tableValues(webhook)}`,
    Object.values(webhook)
  );
};

/**
 * Update a webhook
 */
export const updateWebhook = async (
  organizationId: number,
  webhookId: number,
  data: KeyValue
) => {
  data.updatedAt = new Date();
  data = removeReadOnlyValues(data);
  const webhook = await getWebhook(organizationId, webhookId);
  return await query(
    `UPDATE ${tableName("webhooks")} SET ${setValues(
      data
    )} WHERE id = ? AND organizationId = ?`,
    [...Object.values(data), webhookId, organizationId]
  );
};

/**
 * Delete a webhook
 */
export const deleteWebhook = async (
  organizationId: number,
  webhookId: number
) => {
  const currentWebhook = await getWebhook(organizationId, webhookId);
  return await query(
    `DELETE FROM ${tableName(
      "webhooks"
    )} WHERE id = ? AND organizationId = ? LIMIT 1`,
    [webhookId, organizationId]
  );
};

/**
 * Get a list of all webpages of an organization
 */
export const getOrganizationAuditWebpages = async (
  organizationId: number,
  query: KeyValue
) => {
  return await getPaginatedData({
    table: "audit-webpages",
    primaryKey: "id",
    conditions: {
      organizationId
    },
    ...query
  });
};

/**
 * Get an audit webpage
 */
export const getAuditWebpage = async (organizationId: number, id: number) => {
  return (<AuditWebpage[]>(
    await query(
      "SELECT * FROM `audit-webpages` WHERE id = ? AND organizationId = ? LIMIT 1",
      [id, organizationId]
    )
  ))[0];
};

/**
 * Create an audit webpage
 */
export const createAuditWebpage = async (webpage: AuditWebpage) => {
  webpage.repeatEvery = webpage.repeatEvery || AuditRepeat.DAILY;
  webpage.createdAt = new Date();
  webpage.updatedAt = webpage.createdAt;
  const result = await query(
    `INSERT INTO \`audit-webpages\` ${tableValues(webpage)}`,
    Object.values(webpage)
  );
  const id = (result as any).insertId;
  try {
    scheduleAudit(webpage.organizationId, id);
  } catch (error) {}
  return result;
};

/**
 * Update a user's details
 */
export const updateAuditWebpage = async (
  organizationId: number,
  id: number,
  data: KeyValue
) => {
  data.updatedAt = dateToDateTime(new Date());
  data = removeReadOnlyValues(data);
  return await query(
    `UPDATE \`audit-webpages\` SET ${setValues(
      data
    )} WHERE id = ? AND organizationId = ?`,
    [...Object.values(data), id, organizationId]
  );
};

/**
 * Delete an audit webpage
 */
export const deleteAuditWebpage = async (
  organizationId: number,
  id: number
) => {
  return await query(
    "DELETE FROM `audit-webpages` WHERE id = ? AND organizationId = ? LIMIT 1",
    [id, organizationId]
  );
};

/**
 * Get a list of all audits of a URL
 */
export const getOrganizationAudits = async (
  organizationId: number,
  auditUrlId: number,
  query: KeyValue
) => {
  const webpageDetails = await getAuditWebpage(organizationId, auditUrlId);
  if (webpageDetails && webpageDetails.id)
    return await getPaginatedData({
      table: "audits",
      primaryKey: "id",
      conditions: {
        auditUrlId
      },
      ...query
    });
  throw new Error(ErrorCode.NOT_FOUND);
};

/**
 * Get an audit webpage
 */
export const getOrganizationAudit = async (
  organizationId: number,
  webpageId: number,
  id: number
) => {
  const audit = (<Audit[]>(
    await query(
      "SELECT * FROM `audits` WHERE id = ? AND auditUrlId = ? LIMIT 1",
      [id, webpageId]
    )
  ))[0];
  if (!audit || !audit.auditUrlId) throw new Error(ErrorCode.NOT_FOUND);
  const webpageDetails = await getAuditWebpage(
    organizationId,
    audit.auditUrlId
  );
  if (webpageDetails && webpageDetails.id) return audit;
  throw new Error(ErrorCode.NOT_FOUND);
};
/**
 * Get a list of Agastya API keys
 */
export const getAgastyaApiKeys = async (
  organizationId: number,
  query: KeyValue
) => {
  return await getPaginatedData({
    table: "agastya-api-keys",
    conditions: {
      organizationId
    },
    ...query
  });
};

/**
 * Get a single Agastya API key
 */
export const getAgastyaApiKey = async (
  organizationId: number,
  agastyaApiKeyId: number
) => {
  return (<AgastyaApiKey[]>(
    await query(
      `SELECT * FROM ${tableName(
        "agastya-api-keys"
      )} WHERE id = ? AND organizationId = ? LIMIT 1`,
      [agastyaApiKeyId, organizationId]
    )
  ))[0];
};

/**
 * Get a single Agastya API key
 */
export const getAgastyaApiKeyFromSlug = async (slug: string) => {
  return (<AgastyaApiKey[]>(
    await cachedQuery(
      CacheCategories.AGASTYA_API_KEY,
      slug,
      `SELECT * FROM ${tableName("agastya-api-keys")} WHERE slug = ?`,
      [slug]
    )
  ))[0];
};

/**
 * Create a new Agastya API key
 */
export const createAgastyaApiKey = async (
  agastya: AgastyaApiKey
): Promise<InsertResult> => {
  agastya.slug = agastya.slug || createSlug(agastya.name);
  agastya.backgroundColor = agastya.backgroundColor || "#3742fa";
  agastya.foregroundColor = agastya.foregroundColor || "#ffffff";
  agastya.customCss = "{}";
  agastya.variables = JSON.stringify({
    headingText: "Help & Accessibility",
    subheadingText: agastya.name
  });
  agastya.links = "{}";
  agastya.layout = `[{"type":"mode-card","slug":"dyslexia"},{"type":"mode-card","slug":"blue-light-filter"},{"type":"mode-card","slug":"large-font"},{"type":"mode-card","slug":"night"},{"type":"mode-card","slug":"read-aloud"},{"type":"mode-card","slug":"translate"},{"type":"link-card","title":"More accessibility features","url":"agastya-app:modes/all"}]`;
  agastya.integrations = "{}";
  agastya.createdAt = new Date();
  agastya.updatedAt = agastya.createdAt;
  return await query(
    `INSERT INTO ${tableName("agastya-api-keys")} ${tableValues(agastya)}`,
    Object.values(agastya)
  );
};

/**
 * Update an Agastya API key
 */
export const updateAgastyaApiKey = async (
  organizationId: number,
  agastyaApiKeyId: number,
  data: KeyValue
) => {
  data.updatedAt = new Date();
  data = removeReadOnlyValues(data);
  const originalAgastyaApiKey = await getAgastyaApiKey(
    organizationId,
    agastyaApiKeyId
  );
  if (
    data.slug &&
    originalAgastyaApiKey.slug &&
    originalAgastyaApiKey.slug !== data.slug
  ) {
    const currentOwner = await getAgastyaApiKeyFromSlug(
      originalAgastyaApiKey.slug
    );
    if (currentOwner && currentOwner.organizationId != organizationId)
      throw new Error(ErrorCode.USERNAME_EXISTS);
    deleteItemFromCache(
      CacheCategories.AGASTYA_API_KEY,
      originalAgastyaApiKey.slug
    );
  }
  if (data.customCss) data.customCss = JSON.stringify(data.customCss);
  if (data.variables) data.variables = JSON.stringify(data.variables);
  if (data.links) data.links = JSON.stringify(data.links);
  if (data.layout) data.layout = JSON.stringify(data.layout);
  if (data.integrations) data.integrations = JSON.stringify(data.integrations);
  const agastya = await getAgastyaApiKey(organizationId, agastyaApiKeyId);
  return await query(
    `UPDATE ${tableName("agastya-api-keys")} SET ${setValues(
      data
    )} WHERE id = ? AND organizationId = ?`,
    [...Object.values(data), agastyaApiKeyId, organizationId]
  );
};

/**
 * Delete an Agastya API ket
 */
export const deleteAgastyaApiKey = async (
  organizationId: number,
  agastyaApiKeyId: number
) => {
  const currentAgastyaApiKey = await getAgastyaApiKey(
    organizationId,
    agastyaApiKeyId
  );
  deleteItemFromCache(
    CacheCategories.AGASTYA_API_KEY,
    currentAgastyaApiKey.slug
  );
  return await query(
    `DELETE FROM ${tableName(
      "agastya-api-keys"
    )} WHERE id = ? AND organizationId = ? LIMIT 1`,
    [agastyaApiKeyId, organizationId]
  );
};
