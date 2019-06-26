import { CronJob } from "cron";
import { query } from "../helpers/mysql";
import { AuditWebpage } from "../interfaces/tables/organization";
import { lighthouseStart, lighthouseAudit, lighthouseError } from "../crud/api";
import { AuditRepeat } from "../interfaces/enum";

export default () => {
  new CronJob(
    "0 0 * * 0",
    async () => {
      const weeklyAudits = (await query(
        "SELECT * FROM `audit-webpages` WHERE repeatEvery = ?",
        [AuditRepeat.WEEKLY]
      )) as AuditWebpage[];
      for await (const auditWebpage of weeklyAudits) {
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
