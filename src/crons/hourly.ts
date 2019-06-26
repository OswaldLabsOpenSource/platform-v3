import { CronJob } from "cron";
import { query } from "../helpers/mysql";
import { AuditWebpage } from "../interfaces/tables/organization";
import { lighthouseStart, lighthouseAudit, lighthouseError } from "../crud/api";
import { AuditRepeat, AuditStatuses } from "../interfaces/enum";

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
    },
    undefined,
    true
  );
};
