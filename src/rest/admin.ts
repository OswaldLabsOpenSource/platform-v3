import { can } from "../helpers/authorization";
import { Authorizations, ErrorCode } from "../interfaces/enum";
import { getAllOrganizations } from "../crud/organization";
import { getAllUsers } from "../crud/user";
import { query, tableName } from "../helpers/mysql";
import { temporaryStorage } from "../helpers/s3";

export const getAllOrganizationForUser = async (tokenUserId: number) => {
  if (await can(tokenUserId, Authorizations.READ, "general"))
    return await getAllOrganizations();
  throw new Error(ErrorCode.INSUFFICIENT_PERMISSION);
};

export const getAllUsersForUser = async (tokenUserId: number) => {
  if (await can(tokenUserId, Authorizations.READ, "general"))
    return await getAllUsers();
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
