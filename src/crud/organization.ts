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
  dateToDateTime,
  generateHashId
} from "../helpers/utils";
import ms from "ms";
import { KeyValue } from "../interfaces/general";
import { cachedQuery, deleteItemFromCache } from "../helpers/cache";
import { CacheCategories, AuditRepeat, Webhooks } from "../interfaces/enum";
import {
  INVALID_INPUT,
  ORGANIZATION_NOT_FOUND,
  USERNAME_EXISTS,
  MEMBERSHIP_NOT_FOUND,
  RESOURCE_NOT_FOUND
} from "@staart/errors";
import { getPaginatedData } from "./data";
import cryptoRandomString from "crypto-random-string";
import { scheduleAudit } from "./api";
import { ApiKey, AuditWebpage } from "../interfaces/tables/organization";
import { apiKeyToken, invalidateToken } from "../helpers/jwt";
import {
  TOKEN_EXPIRY_API_KEY_MAX,
  JWT_ISSUER,
  ELASTIC_LOGS_PREFIX
} from "../config";
import { InsertResult } from "../interfaces/mysql";
import { Membership } from "../interfaces/tables/memberships";
import { getUser } from "./user";
import { getStripeSubscription } from "./billing";
import {
  elasticSearch,
  cleanElasticSearchQueryResponse
} from "../helpers/elasticsearch";
import randomColor from "randomcolor";
import axios from "axios";

/*
 * Create a new organization for a user
 */
export const createOrganization = async (organization: Organization) => {
  if (!organization.name) throw new Error(INVALID_INPUT);
  organization.name = capitalizeFirstAndLastLetter(organization.name);
  organization.createdAt = new Date();
  organization.updatedAt = organization.createdAt;
  organization.profilePicture = "demo";
  organization.username = createSlug(organization.name);
  const backgroundColor = randomColor({
    luminosity: "dark",
    format: "hex"
  }).replace("#", "");
  organization.profilePicture = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    (organization.name || "XX").substring(0, 2).toUpperCase()
  )}&background=${backgroundColor}&color=fff`;
  return await query(
    `INSERT INTO ${tableName("organizations")} ${tableValues(organization)}`,
    Object.values(organization)
  );
};

/*
 * Get the details of a specific organization
 */
export const getOrganization = async (id: string) => {
  const org = (<Organization[]>(
    await cachedQuery(
      CacheCategories.ORGANIZATION,
      id,
      `SELECT * FROM ${tableName("organizations")} WHERE id = ? LIMIT 1`,
      [id]
    )
  ))[0];
  if (org) return org;
  throw new Error(ORGANIZATION_NOT_FOUND);
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
  throw new Error(ORGANIZATION_NOT_FOUND);
};

/*
 * Update an organization
 */
export const updateOrganization = async (
  id: string,
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
    if (currentOwner != id) throw new Error(USERNAME_EXISTS);
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
export const deleteOrganization = async (id: string) => {
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
  organizationId: string,
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
export const getApiKey = async (organizationId: string, apiKeyId: string) => {
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
 * Get an API key
 */
export const getApiKeyLogs = async (
  organizationId: string,
  apiKeyId: string,
  query: KeyValue
) => {
  await getApiKey(organizationId, apiKeyId);
  const range: string = query.range || "7d";
  const size = parseInt(query.size) || 10;
  const from = query.from ? parseInt(query.from) : 0;
  const filter = ((query.filter as string) || "")
    .split(",")
    .map(i => i.trim())
    .filter(i => !!i)
    .map(i => {
      let key = i;
      let value = i;
      if (i.includes(":")) {
        key = i.split(":")[0].trim();
        value = i.split(":")[1].trim();
      }
      const match: {
        [index: string]: string;
      } = {};
      match[key] = value;
      return { match };
    });
  const result = (
    await elasticSearch.search({
      index: `${ELASTIC_LOGS_PREFIX}*`,
      from,
      body: {
        query: {
          bool: {
            must: [
              {
                match: {
                  apiKeyId
                }
              },
              {
                range: {
                  date: {
                    gte: new Date(new Date().getTime() - ms(range))
                  }
                }
              },
              ...filter
            ]
          }
        },
        sort: [
          {
            date: { order: "desc" }
          }
        ],
        size
      }
    })
  ).body;
  return cleanElasticSearchQueryResponse(result, size);
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
  organizationId: string,
  apiKeyId: string,
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
  organizationId: string,
  apiKeyId: string
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
  organizationId: string,
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
export const getDomain = async (organizationId: string, domainId: string) => {
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

export const updateOrganizationProfilePicture = async (
  organizationId: string
) => {
  const domains = await getOrganizationDomains(organizationId, {});
  if (domains && domains.data && domains.data.length) {
    const primaryDomain = domains.data[0] as Domain;
    const domainIcons = await axios.get(
      `https://unavatar.now.sh/${primaryDomain}?json`
    );
    if (
      domainIcons.data &&
      domainIcons.data.url &&
      domainIcons.data.url !== "http://unavatar.now.sh/fallback.png"
    )
      return await updateOrganization(organizationId, {
        profilePicture: domainIcons.data.url
      });
  }
  const organization = await getOrganization(organizationId);
  const backgroundColor = randomColor({
    luminosity: "dark",
    format: "hex"
  }).replace("#", "");
  const profilePicture = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    organization.name || organization.username || "XX"
  ).replace(
    /^([a-zA-Z0-9 _-]+)$/gi,
    ""
  )}&background=${backgroundColor}&color=fff`;
  await updateOrganization(organizationId, { profilePicture });
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
  const response = await query(
    `INSERT INTO ${tableName("domains")} ${tableValues(domain)}`,
    Object.values(domain)
  );
  await updateOrganizationProfilePicture(domain.organizationId);
  return response;
};

/**
 * Update a domain
 */
export const updateDomain = async (
  organizationId: string,
  domainId: string,
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
  organizationId: string,
  domainId: string
) => {
  const currentDomain = await getDomain(organizationId, domainId);
  const response = await query(
    `DELETE FROM ${tableName(
      "domains"
    )} WHERE id = ? AND organizationId = ? LIMIT 1`,
    [domainId, organizationId]
  );
  await updateOrganizationProfilePicture(organizationId);
  return response;
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
  organizationId: string,
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
  organizationId: string,
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
export const getWebhook = async (organizationId: string, webhookId: string) => {
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
  organizationId: string,
  webhookId: string,
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
  organizationId: string,
  webhookId: string
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
  organizationId: string,
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
export const getAuditWebpage = async (organizationId: string, id: string) => {
  return (<AuditWebpage[]>(
    await query(
      `SELECT * FROM ${tableName(
        "audit-webpages"
      )} WHERE id = ? AND organizationId = ? LIMIT 1`,
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
    `INSERT INTO ${tableName("audit-webpages")} ${tableValues(webpage)}`,
    Object.values(webpage)
  );
  const id = generateHashId((result as any).insertId);
  try {
    scheduleAudit(webpage.organizationId, id);
  } catch (error) {}
  return result;
};

/**
 * Update a user's details
 */
export const updateAuditWebpage = async (
  organizationId: string,
  id: string,
  data: KeyValue
) => {
  data.updatedAt = dateToDateTime(new Date());
  data = removeReadOnlyValues(data);
  return await query(
    `UPDATE ${tableName("audit-webpages")} SET ${setValues(
      data
    )} WHERE id = ? AND organizationId = ?`,
    [...Object.values(data), id, organizationId]
  );
};

/**
 * Delete an audit webpage
 */
export const deleteAuditWebpage = async (
  organizationId: string,
  id: string
) => {
  return await query(
    `DELETE FROM ${tableName(
      "audit-webpages"
    )} WHERE id = ? AND organizationId = ? LIMIT 1`,
    [id, organizationId]
  );
};

/**
 * Get a list of all audits of a URL
 */
export const getOrganizationAudits = async (
  organizationId: string,
  auditUrlId: string,
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
  throw new Error(RESOURCE_NOT_FOUND);
};

/**
 * Get an audit webpage
 */
export const getOrganizationAudit = async (
  organizationId: string,
  webpageId: string,
  id: string
) => {
  const audit = (<Audit[]>(
    await query(
      `SELECT * FROM ${tableName(
        "audits"
      )} WHERE id = ? AND auditUrlId = ? LIMIT 1`,
      [id, webpageId]
    )
  ))[0];
  if (!audit || !audit.auditUrlId) throw new Error(RESOURCE_NOT_FOUND);
  const webpageDetails = await getAuditWebpage(
    organizationId,
    audit.auditUrlId
  );
  if (webpageDetails && webpageDetails.id) return audit;
  throw new Error(RESOURCE_NOT_FOUND);
};
/**
 * Get a list of Agastya API keys
 */
export const getAgastyaApiKeys = async (
  organizationId: string,
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
  organizationId: string,
  agastyaApiKeyId: string
) => {
  const apiKey = (<AgastyaApiKey[]>(
    await query(
      `SELECT * FROM ${tableName(
        "agastya-api-keys"
      )} WHERE id = ? AND organizationId = ? LIMIT 1`,
      [agastyaApiKeyId, organizationId]
    )
  ))[0];
  if (
    apiKey &&
    apiKey.subscriptionId &&
    !apiKey.subscriptionId.includes("custom")
  ) {
    const organizationDetails = await getOrganization(organizationId);
    if (organizationDetails.stripeCustomerId)
      apiKey.subscription = await getStripeSubscription(
        organizationDetails.stripeCustomerId,
        apiKey.subscriptionId
      );
  }
  return apiKey;
};

/**
 * Get a single Agastya API key
 */
export const getAgastyaApiKeyFromSlug = async (slug: string) => {
  const result = (<AgastyaApiKey[]>(
    await cachedQuery(
      CacheCategories.AGASTYA_API_KEY,
      slug,
      `SELECT * FROM ${tableName("agastya-api-keys")} WHERE slug = ?`,
      [slug]
    )
  ))[0];
  if (result) {
    delete result.protectedInfo;
    return result;
  }
  throw new Error(RESOURCE_NOT_FOUND);
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
  agastya.protectedInfo = "{}";
  agastya.variables = JSON.stringify({
    headingText: "Help & Accessibility",
    subheadingText: agastya.name,
    translateLanguages: "nl,de,en,es,fr,it,pt,zh-CN",
    readAloudAccent: "xx"
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
  organizationId: string,
  agastyaApiKeyId: string,
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
      throw new Error(USERNAME_EXISTS);
  }
  if (data.customCss) data.customCss = JSON.stringify(data.customCss);
  if (data.protectedInfo)
    data.protectedInfo = JSON.stringify(data.protectedInfo);
  if (data.variables) data.variables = JSON.stringify(data.variables);
  if (data.links) data.links = JSON.stringify(data.links);
  if (data.layout) data.layout = JSON.stringify(data.layout);
  if (data.integrations) data.integrations = JSON.stringify(data.integrations);
  const agastya = await getAgastyaApiKey(organizationId, agastyaApiKeyId);
  deleteItemFromCache(
    CacheCategories.AGASTYA_API_KEY,
    originalAgastyaApiKey.slug
  );
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
  organizationId: string,
  agastyaApiKeyId: string
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

/**
 * Get an API key
 */
export const getAgastyaApiKeyLogs = async (
  organizationId: string,
  apiKeyId: string,
  query: KeyValue
) => {
  const agastyaApiKey = await getAgastyaApiKey(organizationId, apiKeyId);
  const range: string = query.range || "7d";
  const size = parseInt(query.size) || 10;
  const from = query.from ? parseInt(query.from) : 0;
  const filter = ((query.filter as string) || "")
    .split(",")
    .map(i => i.trim())
    .filter(i => !!i)
    .map(i => {
      let key = i;
      let value = i;
      if (i.includes(":")) {
        key = i.split(":")[0].trim();
        value = i.split(":")[1].trim();
      }
      const match: {
        [index: string]: string;
      } = {};
      match[key] = value;
      return { match };
    });
  try {
    const result = (
      await elasticSearch.search({
        index: `agastya-${agastyaApiKey.slug}`,
        from,
        body: {
          query: {
            bool: {
              must: [
                {
                  range: {
                    date: {
                      gte: new Date(new Date().getTime() - ms(range))
                    }
                  }
                },
                ...filter
              ]
            }
          },
          sort: [
            {
              date: { order: "desc" }
            }
          ],
          size
        }
      })
    ).body;
    return cleanElasticSearchQueryResponse(result, size);
  } catch (error) {
    return {
      data: [],
      hasMore: false,
      count: 0,
      backup: true
    };
  }
};

/**
 * Get an API key
 */
export const getAgastyaApiKeyGraphs = async (
  organizationId: string,
  apiKeyId: string,
  field: string,
  query: KeyValue
) => {
  const agastyaApiKey = await getAgastyaApiKey(organizationId, apiKeyId);
  const range: string = query.range || "7d";
  const size = parseInt(query.size) || 10;
  const from = query.from ? parseInt(query.from) : 0;
  try {
    const result = (
      await elasticSearch.search({
        index: `agastya-${agastyaApiKey.slug}`,
        from,
        body: {
          size: 0,
          aggs: {
            result: {
              terms: {
                field: `${field}.keyword`,
                size,
                order: {
                  _count: "desc"
                }
              }
            }
          },
          query: {
            bool: {
              must: [
                {
                  range: {
                    date: {
                      gte: new Date(new Date().getTime() - ms(range))
                    }
                  }
                }
              ]
            }
          }
        }
      })
    ).body;
    if (
      result &&
      result.aggregations &&
      result.aggregations.result &&
      result.aggregations.result.buckets
    ) {
      return result.aggregations.result.buckets;
    } else {
      throw new Error();
    }
  } catch (error) {
    return {
      data: [],
      hasMore: false,
      count: 0
    };
  }
};

/**
 * Get an API key
 */
export const getAgastyaApiKeyLogMonthCount = async (slug: String) => {
  try {
    const result = (
      await elasticSearch.search({
        index: `agastya-${slug}`,
        body: {
          query: {
            bool: {
              must: [
                {
                  range: {
                    date: {
                      gte: new Date(
                        new Date().getFullYear(),
                        new Date().getMonth(),
                        1
                      )
                    }
                  }
                }
              ]
            }
          },
          size: 0
        }
      })
    ).body;
    return cleanElasticSearchQueryResponse(result, 0);
  } catch (error) {
    return {
      data: [],
      hasMore: false,
      count: 0
    };
  }
};

/*
 * Get a detailed list of all members in an organization
 */
export const getOrganizationMemberships = async (
  organizationId: string,
  query?: KeyValue
) => {
  const members: any = await getPaginatedData({
    table: "memberships",
    conditions: { organizationId },
    ...query
  });
  for await (const member of members.data) {
    member.user = await getUser(member.userId);
  }
  return members;
};

/*
 * Get details about a specific organization membership
 */
export const getOrganizationMembership = async (
  organizationId: string,
  id: string
) => {
  return (<Membership[]>(
    await cachedQuery(
      CacheCategories.MEMBERSHIP,
      id,
      `SELECT * FROM ${tableName(
        "memberships"
      )} WHERE id = ? AND organizationId = ? LIMIT 1`,
      [id, organizationId]
    )
  ))[0];
};

/*
 * Get a detailed version of a membership
 */
export const getOrganizationMembershipDetailed = async (
  organizationId: string,
  id: string
) => {
  const membership = (await getOrganizationMembership(
    organizationId,
    id
  )) as any;
  if (!membership || !membership.id) throw new Error(MEMBERSHIP_NOT_FOUND);
  membership.organization = await getOrganization(membership.organizationId);
  membership.user = await getUser(membership.userId);
  return membership;
};

/*
 * Update an organization membership for a user
 */
export const updateOrganizationMembership = async (
  organizationId: string,
  id: string,
  membership: KeyValue
) => {
  membership.updatedAt = new Date();
  membership = removeReadOnlyValues(membership);
  const membershipDetails = await getOrganizationMembership(organizationId, id);
  if (membershipDetails.id)
    deleteItemFromCache(
      CacheCategories.USER_MEMBERSHIPS,
      membershipDetails.userId
    );
  deleteItemFromCache(CacheCategories.MEMBERSHIP, id);
  return await query(
    `UPDATE ${tableName("memberships")} SET ${setValues(
      membership
    )} WHERE id = ? AND organizationId = ?`,
    [...Object.values(membership), id, organizationId]
  );
};

/*
 * Delete an organization membership
 */
export const deleteOrganizationMembership = async (
  organizationId: string,
  id: string
) => {
  const membershipDetails = await getOrganizationMembership(organizationId, id);
  if (membershipDetails.id)
    deleteItemFromCache(
      CacheCategories.USER_MEMBERSHIPS,
      membershipDetails.userId
    );
  deleteItemFromCache(CacheCategories.MEMBERSHIP, id);
  return await query(
    `DELETE FROM ${tableName(
      "memberships"
    )} WHERE id = ? AND organizationId = ?`,
    [id, organizationId]
  );
};

/*
 * Delete all memberships in an organization
 */
export const deleteAllOrganizationMemberships = async (
  organizationId: string
) => {
  const allMemberships = await getOrganizationMemberships(organizationId);
  for await (const membership of allMemberships.data) {
    if (membership.id) {
      deleteItemFromCache(CacheCategories.USER_MEMBERSHIPS, membership.userId);
    }
  }
  return await query(
    `DELETE FROM ${tableName("memberships")} WHERE organizationId = ?`,
    [organizationId]
  );
};
