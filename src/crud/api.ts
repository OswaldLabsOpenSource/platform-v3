// @ts-ignore
import lighthouse from "lighthouse";
import axios from "axios";
import { launch } from "chrome-launcher";
import { Translate } from "@google-cloud/translate";
import {
  GOOGLE_PROJECT_ID,
  GOOGLE_TRANSLATE_KEY,
  AWS_POLLY_ACCESS_KEY,
  AWS_POLLY_SECRET_KEY,
  AWS_REKOGNITION_ACCESS_KEY,
  AWS_REKOGNITION_SECRET_KEY,
  RAPID_API_KEY
} from "../config";
import { getItemFromCache, storeItemInCache } from "../helpers/cache";
import { CacheCategories, AuditStatuses } from "../interfaces/enum";
import { tableValues, query, setValues, tableName } from "../helpers/mysql";
import { Audit } from "../interfaces/tables/organization";
import { uploadToS3, getFromS3, temporaryStorage } from "../helpers/s3";
import {
  getAuditWebpage,
  getAgastyaApiKey,
  getAgastyaApiKeyFromSlug
} from "./organization";
import { getPaginatedData } from "./data";
import { SessionsClient, Credentials } from "dialogflow";
import {
  average,
  getVoiceFromLanguage,
  detectTextLanguage,
  generateHashId
} from "../helpers/utils";
import Polly from "aws-sdk/clients/polly";
import md5 from "md5";
import { parse } from "@postlight/mercury-parser";
import Rekognition from "aws-sdk/clients/rekognition";
import { RESOURCE_NOT_FOUND } from "@staart/errors";

const rekognition = new Rekognition({
  accessKeyId: AWS_REKOGNITION_ACCESS_KEY,
  secretAccessKey: AWS_REKOGNITION_SECRET_KEY,
  region: "eu-central-1"
});

const polly = new Polly({
  accessKeyId: AWS_POLLY_ACCESS_KEY,
  secretAccessKey: AWS_POLLY_SECRET_KEY,
  region: "eu-central-1"
});

const translate = new Translate({
  projectId: GOOGLE_PROJECT_ID,
  key: GOOGLE_TRANSLATE_KEY
});

export const readAloudText = (text: string, language: string) =>
  new Promise((resolve, reject) => {
    let voice = getVoiceFromLanguage(language);
    if (detectTextLanguage(text) === "hi") {
      voice = "Aditi";
      language = "hi-IN";
    }
    const key = `read-aloud/${md5(`${text}${voice}${language}`)}.mp3`;
    getFromS3("oswald-labs-platform-cache", key)
      .then(result => resolve(result))
      .catch(() => {
        polly.synthesizeSpeech(
          {
            OutputFormat: "mp3",
            Text: text,
            VoiceId: voice,
            LanguageCode:
              language === "en-IN" || language === "hi-IN" || language === "hi"
                ? language
                : undefined
          },
          (error, data) => {
            if (error) return reject(error);
            resolve(data.AudioStream);
            uploadToS3(
              "oswald-labs-platform-cache",
              key,
              data.AudioStream as Buffer
            )
              .then(() => {})
              .catch(() => {});
          }
        );
      });
  });

export const translateText = (
  text: string,
  language: string
): Promise<string> =>
  new Promise((resolve, reject) => {
    const cached = getItemFromCache(
      CacheCategories.TRANSLATION,
      `${text}${language}`
    );
    if (cached) return resolve(cached);
    translate
      .translate(text, language)
      .then(data => {
        if (data.length) {
          try {
            storeItemInCache(
              CacheCategories.TRANSLATION,
              `${text}${language}`,
              data[0]
            );
            return resolve(data[0]);
          } catch (error) {}
        }
        reject();
      })
      .catch(error => {
        reject(error);
      });
  });

export const lighthouseStart = async (auditUrlId?: string) => {
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
    updatedAt: currentDate,
    auditUrlId
  };
  const result = await query(
    `INSERT INTO ${tableName("audits")} ${tableValues(audit)}`,
    Object.values(audit)
  );
  return generateHashId((result as any).insertId);
};

export const lighthouseAudit = async (id: string, url: string) => {
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
  const currentTime = new Date();
  const audit: Audit = {
    status: AuditStatuses.COMPLETED,
    finalUrl: lhr.finalUrl,
    timing: lhr.timing.total,
    scorePerformance: lhr.categories.performance.score * 100,
    scoreAccessibility: lhr.categories.accessibility.score * 100,
    scoreBestPractices: lhr.categories["best-practices"].score * 100,
    scoreSeo: lhr.categories.seo.score * 100,
    scorePwa: lhr.categories.pwa.score * 100,
    updatedAt: currentTime
  };
  await query(
    `UPDATE ${tableName("audits")} SET ${setValues(audit)} WHERE id = ?`,
    [...Object.values(audit), id]
  );
  await uploadToS3("dai11y", `reports/${id}.html`, report);
  const currentAudit = await getLighthouseAudit(id);
  if (currentAudit.auditUrlId) {
    const updateObject = {
      lastAuditAt: currentTime
    };
    await query(
      `UPDATE \`audit-webpages\` SET ${setValues(updateObject)} WHERE id = ?`,
      [...Object.values(updateObject), currentAudit.auditUrlId]
    );
  }
  return audit;
};

export const lighthouseError = async (id: string) => {
  const audit = {
    status: AuditStatuses.ERROR
  };
  return await query(
    `UPDATE ${tableName("audits")} SET ${setValues(audit)} WHERE id = ?`,
    [...Object.values(audit), id]
  );
};

export const getLighthouseAudit = async (id: string) => {
  return ((await query(
    `SELECT * FROM ${tableName("audits")} WHERE id = ? LIMIT 1`,
    [id]
  )) as Audit[])[0];
};

export const getLighthouseAuditHtml = async (id: string) => {
  return (await getFromS3("dai11y", `reports/${id}.html`)) as string;
};

export const scheduleAudit = async (
  organizationId: string,
  auditUrlId: string
) => {
  const newId = await lighthouseStart(auditUrlId);
  const webpageDetails = await getAuditWebpage(organizationId, auditUrlId);
  try {
    return await lighthouseAudit(newId, webpageDetails.url);
  } catch (error) {
    await lighthouseError(newId);
  }
};

export const auditBadgeInfo = async (
  badgeType: string,
  organizationId: string,
  id: string
) => {
  const site = await getAuditWebpage(organizationId, id);
  if (site.id) {
    const mostRecentAudit = await getPaginatedData({
      table: "audits",
      primaryKey: "id",
      conditions: {
        auditUrlId: id,
        status: AuditStatuses.COMPLETED
      },
      sort: "desc",
      itemsPerPage: 1
    });
    if (mostRecentAudit.data.length) {
      const mostRecentAuditDetails = mostRecentAudit.data[0] as Audit;

      let score = average([
        mostRecentAuditDetails.scoreAccessibility,
        mostRecentAuditDetails.scorePerformance,
        mostRecentAuditDetails.scoreBestPractices,
        mostRecentAuditDetails.scoreSeo,
        mostRecentAuditDetails.scorePwa
      ]);
      if (badgeType === "accessibility")
        score = mostRecentAuditDetails.scoreAccessibility;
      if (badgeType === "performance")
        score = mostRecentAuditDetails.scorePerformance;
      if (badgeType === "best-practices")
        score = mostRecentAuditDetails.scoreBestPractices;
      if (badgeType === "seo") score = mostRecentAuditDetails.scoreSeo;
      if (badgeType === "pwa") score = mostRecentAuditDetails.scorePwa;

      let color = "success";
      if (score < 75) color = "yellow";
      if (score < 50) color = "critical";

      return { color, score };
    }
  }
  throw new Error(RESOURCE_NOT_FOUND);
};

export const getFaviconForSite = async (site: string, fallback?: string) => {
  const googleUrl = `https://www.google.com/s2/favicons?domain=${
    site.split("//")[1]
  }`;
  const image = await axios.get(googleUrl, { responseType: "blob" });
  return image.data;
};

export const getReadingModeForUrl = async (url: string) => {
  const slug = md5(url);
  let file: any;
  try {
    file = await temporaryStorage.read(slug);
  } catch (error) {
    file = await parse(url);
    await temporaryStorage.create(slug, file);
  }
  if (!file || !file.word_count || file.word_count < 20 || file.error)
    throw new Error(RESOURCE_NOT_FOUND);
  return file;
};

export const getLabelsForImage = (image: Buffer) =>
  new Promise((resolve, reject) => {
    const labels = rekognition.detectLabels({
      Image: {
        Bytes: image
      }
    });
    labels.send((error, data) => {
      if (error) return reject(error);
      resolve(data);
    });
  });

export const getOcrForImage = (image: Buffer) =>
  new Promise((resolve, reject) => {
    const labels = rekognition.detectText({
      Image: {
        Bytes: image
      }
    });
    labels.send((error, data) => {
      if (error) return reject(error);
      resolve(data);
    });
  });

export const getWordDefinitions = async (word: string) => {
  const slug = `dictionary-${word}`;
  try {
    return await temporaryStorage.read(slug);
  } catch (error) {
    try {
      const result = (await axios.get(
        `https://wordsapiv1.p.rapidapi.com/words/${word}`,
        {
          headers: {
            "X-RapidAPI-Host": "wordsapiv1.p.rapidapi.com",
            "X-RapidAPI-Key": RAPID_API_KEY
          }
        }
      )).data;
      temporaryStorage.create(slug, result);
      return result;
    } catch (error) {
      throw new Error(RESOURCE_NOT_FOUND);
    }
  }
};

export const getDialogflowResponse = async (
  agastyaApiKey: string,
  sessionId: string,
  lang: string,
  text: string
) => {
  let credentials = "";
  const agastya = await getAgastyaApiKeyFromSlug(agastyaApiKey);
  if (agastya.id && agastya.organizationId) {
    const agastyaDetails = await getAgastyaApiKey(
      agastya.organizationId,
      agastya.id
    );
    if (typeof agastyaDetails.protectedInfo === "object") {
      credentials = agastyaDetails.protectedInfo
        .dialogflowServiceAccount as string;
    }
  }
  if (!credentials) throw new Error(RESOURCE_NOT_FOUND);
  const sessionClient = new SessionsClient({
    credentials: JSON.parse(credentials) as Credentials
  });
  const sessionPath = sessionClient.sessionPath("oefenenonboarding", sessionId);
  return await sessionClient.detectIntent({
    session: sessionPath,
    queryInput: {
      text: {
        text,
        languageCode: lang
      }
    }
  });
};
