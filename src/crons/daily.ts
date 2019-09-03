import { CronJob } from "cron";
import { query, tableName } from "../helpers/mysql";
import { AuditWebpage } from "../interfaces/tables/organization";
import { lighthouseStart, lighthouseAudit, lighthouseError } from "../crud/api";
import { AuditRepeat } from "../interfaces/enum";
import { elasticSearch } from "../helpers/elasticsearch";
import { ELASTIC_LOGS_PREFIX } from "../config";
import ms from "ms";

export default () => {
  new CronJob(
    "0 0 * * *",
    async () => {
      const dailyAudits = (await query(
        `SELECT * FROM ${tableName("audit-webpages")} WHERE repeatEvery = ?`,
        [AuditRepeat.DAILY]
      )) as AuditWebpage[];
      for await (const auditWebpage of dailyAudits) {
        const id = await lighthouseStart(auditWebpage.id);
        try {
          await lighthouseAudit(id, auditWebpage.url);
        } catch (error) {
          await lighthouseError(id);
        }
      }
      await deleteOldLogs();
    },
    undefined,
    true
  );
};

const deleteOldLogs = async () => {
  return await elasticSearch.deleteByQuery({
    index: `${ELASTIC_LOGS_PREFIX}*`,
    body: {
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  lte: new Date(new Date().getTime() - ms("92 days"))
                }
              }
            }
          ]
        }
      }
    }
  });
};
