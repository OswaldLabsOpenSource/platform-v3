import { Request, Response } from "express";
import {
  Get,
  Controller,
  ClassWrapper,
  Middleware,
  Post
} from "@overnightjs/core";
import asyncHandler from "express-async-handler";
import Joi from "@hapi/joi";
import {
  joiValidate,
  detectTextLanguage,
  organizationUsernameToId,
  safeRedirect,
  hashIdToId
} from "../../helpers/utils";
import {
  translateText,
  readAloudText,
  lighthouseAudit,
  lighthouseError,
  lighthouseStart,
  getLighthouseAudit,
  getLighthouseAuditHtml,
  auditBadgeInfo,
  getFaviconForSite,
  getReadingModeForUrl,
  getLabelsForImage,
  getOcrForImage,
  getWordDefinitions,
  getDialogflowResponse
} from "../../crud/api";
import multer from "multer";
import { cacheForever, validator } from "../../helpers/middleware";

@Controller("v1/api")
@ClassWrapper(asyncHandler)
export class ApiController {
  @Get("language-detect")
  async detectLanguage(req: Request, res: Response) {
    const text = req.query.q as string;
    joiValidate({ text: Joi.string().required() }, { text });
    res.json({ language: detectTextLanguage(text) });
  }

  @Get("translate")
  async translateText(req: Request, res: Response) {
    const text = req.query.q as string;
    const lang = req.query.lang as string;
    joiValidate(
      {
        text: Joi.string().required(),
        lang: Joi.string().required()
      },
      { text, lang }
    );
    res.json({ language: await translateText(text, lang) });
  }

  @Get("read-aloud")
  @Middleware(cacheForever)
  async readAloud(req: Request, res: Response) {
    const text = req.query.q as string;
    const lang = req.query.lang as string;
    const ssml = req.query.ssml as any;
    const playbackSpeed = req.query.playback as any;
    const voice = req.query.voice as string;
    joiValidate(
      {
        text: Joi.string().required(),
        lang: Joi.string().required()
      },
      { text, lang }
    );
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(await readAloudText(text, lang, ssml, playbackSpeed, voice));
  }

  @Get("reader")
  async readingMode(req: Request, res: Response) {
    const url = req.query.url as string;
    joiValidate({ url: Joi.string().required() }, { url });
    res.json(await getReadingModeForUrl(url));
  }

  @Post("describe")
  @Middleware(multer().single("image"))
  async describeImage(req: Request, res: Response) {
    res.json(await getLabelsForImage(req.file.buffer));
  }

  @Post("ocr")
  @Middleware(multer().single("image"))
  async ocrImage(req: Request, res: Response) {
    res.json(await getOcrForImage(req.file.buffer));
  }

  @Get("audit")
  async createAudit(req: Request, res: Response) {
    const url = req.query.url as string;
    const id = await lighthouseStart();
    res.json({ queued: true, id });
    try {
      await lighthouseAudit(id, url);
    } catch (error) {
      console.log("Error", error);
      await lighthouseError(id);
    }
  }

  @Get("audit/:id")
  async getAudit(req: Request, res: Response) {
    res.json(await getLighthouseAudit(hashIdToId(req.params.id)));
  }

  @Get("audit/:id/html")
  async getAuditHtml(req: Request, res: Response) {
    res
      .header({
        "Content-Type": "text/html"
      })
      .send(await getLighthouseAuditHtml(hashIdToId(req.params.id)));
  }

  @Get("audit-badge/:type/:organizationId/:id")
  async getAuditBadge(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(
      req.params.organizationId
    );
    const { color, score } = await auditBadgeInfo(
      req.params.type,
      organizationId,
      hashIdToId(req.params.id)
    );
    safeRedirect(
      req,
      res,
      `https://img.shields.io/badge/${req.query.label ||
        req.params.type}-${score}%2F100-${color}.svg`
    );
  }

  @Get("favicon")
  @Middleware(cacheForever)
  async getFavicon(req: Request, res: Response) {
    res
      .set("Content-Type", "image/png")
      .end(
        await getFaviconForSite(
          (req.query.url as string) || "https://oswaldlabs.com"
        ),
        "binary"
      );
  }

  @Get("dictionary")
  @Middleware(cacheForever)
  async getDictionaryDefinition(req: Request, res: Response) {
    const word = req.query.q as string;
    joiValidate({ word: Joi.string().required() }, { word });
    res.json(await getWordDefinitions(word));
  }

  @Get("dialogflow/:agastyaApiKey")
  @Middleware(
    validator(
      {
        q: Joi.string().required(),
        lang: Joi.string().required(),
        sessionId: Joi.string().required()
      },
      "query"
    )
  )
  async getDialogflowChatbot(req: Request, res: Response) {
    const agastyaApiKey = req.params.agastyaApiKey;
    const sessionId = req.query.sessionId as string;
    const text = req.query.q as string;
    const lang = req.query.lang as string;
    joiValidate({ agastyaApiKey: Joi.string().required() }, { agastyaApiKey });
    res.json(await getDialogflowResponse(agastyaApiKey, sessionId, lang, text));
  }
}
