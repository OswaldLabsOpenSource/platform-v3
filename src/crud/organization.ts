import {
  query,
  tableValues,
  setValues,
  removeReadOnlyValues
} from "../helpers/mysql";
import { Organization, AuditWebpage } from "../interfaces/tables/organization";
import {
  capitalizeFirstAndLastLetter,
  dateToDateTime,
  createSlug
} from "../helpers/utils";
import { KeyValue } from "../interfaces/general";
import { cachedQuery, deleteItemFromCache } from "../helpers/cache";
import { CacheCategories, ErrorCode, AuditRepeat } from "../interfaces/enum";
import { ApiKey } from "../interfaces/tables/user";
import cryptoRandomString from "crypto-random-string";
import { getPaginatedData } from "./data";
import { scheduleAudit } from "./api";

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
    `INSERT INTO organizations ${tableValues(organization)}`,
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
      `SELECT * FROM organizations WHERE id = ? LIMIT 1`,
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
      `SELECT id FROM organizations WHERE username = ? LIMIT 1`,
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
  organization.updatedAt = dateToDateTime(new Date());
  organization = removeReadOnlyValues(organization);
  const originalOrganization = await getOrganization(id);
  if (organization.username && originalOrganization.username) {
    const currentOwner = await getOrganizationIdFromUsername(
      originalOrganization.username
    );
    if (currentOwner != id) throw new Error(ErrorCode.USERNAME_EXISTS);
  }
  deleteItemFromCache(CacheCategories.ORGANIZATION, id);
  return await query(
    `UPDATE organizations SET ${setValues(organization)} WHERE id = ?`,
    [...Object.values(organization), id]
  );
};

/*
 * Delete an organization
 */
export const deleteOrganization = async (id: number) => {
  deleteItemFromCache(CacheCategories.ORGANIZATION, id);
  return await query("DELETE FROM organizations WHERE id = ?", [id]);
};

/*
 * Get all organizations
 */
export const getAllOrganizations = async () => {
  return <Organization[]>await query("SELECT * FROM organizations");
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
    primaryKey: "apiKey",
    conditions: {
      organizationId
    },
    ...query
  });
};

/**
 * Get an API key without organization ID
 */
export const getApiKeyWithoutOrg = async (apiKey: string) => {
  return (<ApiKey[]>(
    await cachedQuery(
      CacheCategories.API_KEY,
      apiKey,
      "SELECT * FROM `api-keys` WHERE apiKey = ? LIMIT 1",
      [apiKey]
    )
  ))[0];
};

/**
 * Get an API key
 */
export const getApiKey = async (organizationId: number, apiKey: string) => {
  return (<ApiKey[]>(
    await cachedQuery(
      CacheCategories.API_KEY_ORG,
      `${organizationId}_${apiKey}`,
      "SELECT * FROM `api-keys` WHERE apiKey = ? AND organizationId = ? LIMIT 1",
      [apiKey, organizationId]
    )
  ))[0];
};

/**
 * Create an API key
 */
export const createApiKey = async (apiKey: ApiKey) => {
  apiKey.apiKey = cryptoRandomString({ length: 20, type: "hex" });
  apiKey.secretKey = cryptoRandomString({ length: 20, type: "hex" });
  apiKey.apiRestrictions = apiKey.apiRestrictions || "orgRead";
  apiKey.createdAt = new Date();
  apiKey.updatedAt = apiKey.createdAt;
  return await query(
    `INSERT INTO \`api-keys\` ${tableValues(apiKey)}`,
    Object.values(apiKey)
  );
};

/**
 * Update a user's details
 */
export const updateApiKey = async (
  organizationId: number,
  apiKey: string,
  data: KeyValue
) => {
  data.updatedAt = dateToDateTime(new Date());
  data = removeReadOnlyValues(data);
  deleteItemFromCache(CacheCategories.API_KEY, apiKey);
  deleteItemFromCache(
    CacheCategories.API_KEY_ORG,
    `${organizationId}_${apiKey}`
  );
  return await query(
    `UPDATE \`api-keys\` SET ${setValues(
      data
    )} WHERE apiKey = ? AND organizationId = ?`,
    [...Object.values(data), apiKey, organizationId]
  );
};

/**
 * Delete an API key
 */
export const deleteApiKey = async (organizationId: number, apiKey: string) => {
  deleteItemFromCache(CacheCategories.API_KEY, apiKey);
  deleteItemFromCache(
    CacheCategories.API_KEY_ORG,
    `${organizationId}_${apiKey}`
  );
  return await query(
    "DELETE FROM `api-keys` WHERE apiKey = ? AND organizationId = ? LIMIT 1",
    [apiKey, organizationId]
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
  return await getPaginatedData({
    table: "audits",
    primaryKey: "id",
    conditions: {
      organizationId,
      auditUrlId
    },
    ...query
  });
};
