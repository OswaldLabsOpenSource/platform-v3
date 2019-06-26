// @ts-ignore
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { Translate } from "@google-cloud/translate";
import { GOOGLE_PROJECT_ID, GOOGLE_TRANSLATE_KEY } from "../config";
import { getItemFromCache, storeItemInCache } from "../helpers/cache";
import { CacheCategories, AuditStatuses } from "../interfaces/enum";
import { tableValues, query, setValues } from "../helpers/mysql";
import { Audit } from "../interfaces/tables/organization";

const translate = new Translate({
  projectId: GOOGLE_PROJECT_ID,
  key: GOOGLE_TRANSLATE_KEY
});

export const translateText = (
  text: string,
  language: string
): Promise<string> =>
  new Promise((resolve, reject) => {
    const cached = getItemFromCache(CacheCategories.TRANSLATION, text);
    if (cached) return resolve(cached);
    translate
      .translate(text, language)
      .then(data => {
        if (data.length) {
          try {
            storeItemInCache(CacheCategories.TRANSLATION, text, data[0]);
            return resolve(data[0]);
          } catch (error) {}
        }
        reject();
      })
      .catch(error => {
        reject(error);
      });
  });

export const lighthouseStart = async () => {
  const currentDate = new Date();
  const audit: Audit = {
    status: AuditStatuses.PENDING,
    timing: 0,
    scorePerformance: 0,
    scoreAccessibility: 0,
    scoreBestPractices: 0,
    scoreSeo: 0,
    scorePwa: 0,
    createdAt: currentDate,
    updatedAt: currentDate
  };
  const result = await query(
    `INSERT INTO audits ${tableValues(audit)}`,
    Object.values(audit)
  );
  return (result as any).insertId as number;
};

export const lighthouseAudit = async (id: number, url: string) => {
  const chrome = await launch({
    chromeFlags: [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--show-paint-rects"
    ]
  });
  const opts = {
    port: chrome.port,
    output: "html"
  };
  const { lhr, report } = await lighthouse(url, opts);
  await chrome.kill();
  const audit: Audit = {
    status: AuditStatuses.COMPLETED,
    finalUrl: lhr.finalUrl,
    timing: lhr.timing.total,
    scorePerformance: lhr.categories.performance.score * 100,
    scoreAccessibility: lhr.categories.accessibility.score * 100,
    scoreBestPractices: lhr.categories["best-practices"].score * 100,
    scoreSeo: lhr.categories.seo.score * 100,
    scorePwa: lhr.categories.pwa.score * 100,
    updatedAt: new Date()
  };
  await query(`UPDATE audits SET ${setValues(audit)} WHERE id = ?`, [
    ...Object.values(audit),
    id
  ]);
  return audit;
};

export const lighthouseError = async (id: number) => {
  const audit = {
    status: AuditStatuses.ERROR
  };
  return await query(`UPDATE audits SET ${setValues(audit)} WHERE id = ?`, [
    ...Object.values(audit),
    id
  ]);
};
