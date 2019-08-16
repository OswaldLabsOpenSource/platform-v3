import { can } from "../helpers/authorization";
import { Authorizations, ErrorCode } from "../interfaces/enum";
import { getAllOrganizations } from "../crud/organization";
import { getAllUsers } from "../crud/user";
import { query, tableName } from "../helpers/mysql";
import { temporaryStorage } from "../helpers/s3";
import { getPaginatedData } from "../crud/data";
import { KeyValue } from "../interfaces/general";
import {
  cleanElasticSearchQueryResponse,
  elasticSearch
} from "../helpers/elasticsearch";
import ms from "ms";

export const getAllOrganizationForUser = async (
  tokenUserId: number,
  query: KeyValue
) => {
  if (await can(tokenUserId, Authorizations.READ, "general"))
    return await getPaginatedData({
      table: "organizations",
      ...query
    });
  throw new Error(ErrorCode.INSUFFICIENT_PERMISSION);
};

export const getAllUsersForUser = async (
  tokenUserId: number,
  query: KeyValue
) => {
  if (await can(tokenUserId, Authorizations.READ, "general"))
    return await getPaginatedData({
      table: "users",
      ...query
    });
  throw new Error(ErrorCode.INSUFFICIENT_PERMISSION);
};

export const getPublicData = async () => {
  const fileName = "public-data";
  let data: any;
  try {
    data = await temporaryStorage.read(fileName);
  } catch (error) {}
  if (
    !data ||
    new Date().getTime() - new Date(data.storedAt).getTime() > 3600000
  ) {
    data = (await query(
      `SELECT * FROM ${tableName("metadata")} WHERE name = ?`,
      ["eventsThisMonth"]
    ))[0];
    data.storedAt = new Date();
    await temporaryStorage.create(fileName, data);
  }
  return data;
};

/**
 * Get an API key
 */
export const getServerLogsForUser = async (
  tokenUserId: number,
  query: KeyValue
) => {
  if (!(await can(tokenUserId, Authorizations.READ, "general")))
    throw new Error(ErrorCode.INSUFFICIENT_PERMISSION);
  const range: string = query.range || "7d";
  const size = query.size || 10;
  const from = query.from ? parseInt(query.from) : 0;
  const result = await elasticSearch.search({
    index: `staart-logs-*`,
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
            }
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
  });
  return cleanElasticSearchQueryResponse(result, size);
};
