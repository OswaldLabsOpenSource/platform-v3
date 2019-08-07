import { CronJob } from "cron";
import { AuditWebpage, AgastyaApiKey } from "../interfaces/tables/organization";
import { lighthouseStart, lighthouseAudit, lighthouseError } from "../crud/api";
import { AuditRepeat, AuditStatuses } from "../interfaces/enum";
import { query, tableName, setValues } from "../helpers/mysql";
import ms from "ms";
import { TOKEN_EXPIRY_REFRESH } from "../config";
import { getAgastyaApiKeyLogMonthCount } from "../crud/organization";

export default () => {
  new CronJob(
    "0 * * * *",
    async () => {
      const incompleteAudits = (await query(
        "SELECT * FROM audits WHERE status = ? AND DATE_SUB(NOW(), INTERVAL 1 HOUR) < createdAt",
        [AuditStatuses.PENDING]
      )) as AuditWebpage[];
      for await (const incompleteAudit of incompleteAudits) {
        if (incompleteAudit.id) lighthouseError(incompleteAudit.id);
      }
      const hourlyAudits = (await query(
        "SELECT * FROM `audit-webpages` WHERE repeatEvery = ?",
        [AuditRepeat.HOURLY]
      )) as AuditWebpage[];
      for await (const auditWebpage of hourlyAudits) {
        const id = await lighthouseStart(auditWebpage.id);
        try {
          await lighthouseAudit(id, auditWebpage.url);
        } catch (error) {
          await lighthouseError(id);
        }
      }
      await deleteExpiredSessions();
      await updateQuotas();
    },
    undefined,
    true
  );
};

const deleteExpiredSessions = async () => {
  await query(`DELETE FROM ${tableName("sessions")} WHERE createdAt < ?`, [
    new Date(new Date().getTime() - ms(TOKEN_EXPIRY_REFRESH))
  ]);
};

const updateQuotas = async () => {
  const agastyaApiKeys: AgastyaApiKey[] = await query(
    `SELECT id, slug FROM ${tableName("agastya-api-keys")}`
  );
  let totalAgastyaEvents = 0;
  for await (const agastyaApiKey of agastyaApiKeys) {
    const result = await getAgastyaApiKeyLogMonthCount(agastyaApiKey.slug);
    const count = parseInt(result.count);
    totalAgastyaEvents += count;
    const updateValues = {
      eventsConsumed: count,
      eventsUpdatedAt: new Date()
    };
    await query(
      `UPDATE ${tableName("agastya-api-keys")} SET ${setValues(
        updateValues
      )} WHERE id = ?`,
      [...Object.values(updateValues), agastyaApiKey.id]
    );
  }
  const updateMetaValues = {
    value: totalAgastyaEvents.toString(),
    updatedAt: new Date()
  };
  const q = await query(
    `UPDATE ${tableName("metadata")} SET ${setValues(
      updateMetaValues
    )} WHERE name = ?`,
    [...Object.values(updateMetaValues), "agastya-events-month"]
  );
};

updateQuotas();
