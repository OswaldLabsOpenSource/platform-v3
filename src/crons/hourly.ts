import { CronJob } from "cron";
import { AuditWebpage, AgastyaApiKey } from "../interfaces/tables/organization";
import { lighthouseStart, lighthouseAudit, lighthouseError } from "../crud/api";
import { AuditRepeat, AuditStatuses } from "../interfaces/enum";
import { query, tableName, setValues } from "../helpers/mysql";
import ms from "ms";
import { TOKEN_EXPIRY_REFRESH } from "../config";
import { getAgastyaApiKeyLogMonthCount } from "../crud/organization";
import { getLogMonthCount } from "../helpers/elasticsearch";

export default () => {
  new CronJob(
    "0 * * * *",
    async () => {
      const incompleteAudits = (await query(
        `SELECT * FROM ${tableName(
          "audits"
        )} WHERE status = ? AND DATE_SUB(NOW(), INTERVAL 1 HOUR) < createdAt`,
        [AuditStatuses.PENDING]
      )) as AuditWebpage[];
      for await (const incompleteAudit of incompleteAudits) {
        if (incompleteAudit.id) lighthouseError(incompleteAudit.id);
      }
      const hourlyAudits = (await query(
        `SELECT * FROM ${tableName("audit-webpages")} WHERE repeatEvery = ?`,
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
  const updateMetaEventsValues = {
    value: totalAgastyaEvents.toString(),
    updatedAt: new Date()
  };
  await query(
    `UPDATE ${tableName("metadata")} SET ${setValues(
      updateMetaEventsValues
    )} WHERE name = ?`,
    [...Object.values(updateMetaEventsValues), "agastya-events-month"]
  );
  const totalCount = (await getLogMonthCount("staart-*")).count;
  const updateMetaCountValues = {
    /**
     * This 200,000 number is temporarily here because of all the events
     * we missed out on in the first week of August which are in the other
     * ElasticSearch index. There are ~265,000 events from Aug 1-6.
     */
    value: (200000 + totalCount + totalAgastyaEvents).toString(),
    updatedAt: new Date()
  };
  await query(
    `UPDATE ${tableName("metadata")} SET ${setValues(
      updateMetaCountValues
    )} WHERE name = ?`,
    [...Object.values(updateMetaCountValues), "eventsThisMonth"]
  );
};
