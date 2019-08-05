import { CronJob } from "cron";
import { AuditWebpage } from "../interfaces/tables/organization";
import { lighthouseStart, lighthouseAudit, lighthouseError } from "../crud/api";
import { AuditRepeat, AuditStatuses } from "../interfaces/enum";
import { query, tableName } from "../helpers/mysql";
import ms from "ms";
import { TOKEN_EXPIRY_REFRESH } from "../config";
import { Session } from "../interfaces/tables/user";

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
