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
  safeRedirect
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
  getOcrForImage
} from "../../crud/api";
import multer from "multer";
import { cacheForever } from "../../helpers/middleware";

@Controller("v1/api")
@ClassWrapper(asyncHandler)
export class ApiController {
  @Get("language-detect")
  async detectLanguage(req: Request, res: Response) {
    const text = req.query.q;
    joiValidate({ text: Joi.string().required() }, { text });
    res.json({ language: detectTextLanguage(text) });
  }

  @Get("translate")
  async translateText(req: Request, res: Response) {
    const text = req.query.q;
    const lang = req.query.lang;
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
    const text = req.query.q;
    const lang = req.query.lang;
    joiValidate(
      {
        text: Joi.string().required(),
        lang: Joi.string().required()
      },
      { text, lang }
    );
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(await readAloudText(text, lang));
  }

  @Get("reader")
  async readingMode(req: Request, res: Response) {
    const url = req.query.url;
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
    const url = req.query.url;
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
    res.json(await getLighthouseAudit(req.params.id));
  }

  @Get("audit/:id/html")
  async getAuditHtml(req: Request, res: Response) {
    res
      .header({
        "Content-Type": "text/html"
      })
      .send(await getLighthouseAuditHtml(req.params.id));
  }

  @Get("audit-badge/:type/:organizationId/:id")
  async getAuditBadge(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(
      req.params.organizationId
    );
    const { color, score } = await auditBadgeInfo(
      req.params.type,
      organizationId,
      req.params.id
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
        await getFaviconForSite(req.query.url || "https://oswaldlabs.com"),
        "binary"
      );
  }
}
