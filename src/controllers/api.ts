import { Request, Response } from "express";
import { Get, Controller, ClassWrapper } from "@overnightjs/core";
import asyncHandler from "express-async-handler";
import Joi from "@hapi/joi";
import {
  joiValidate,
  detectTextLanguage,
  organizationUsernameToId,
  safeRedirect
} from "../helpers/utils";
import {
  translateText,
  lighthouseAudit,
  lighthouseError,
  lighthouseStart,
  getLighthouseAudit,
  getLighthouseAuditHtml,
  auditBadgeInfo
} from "../crud/api";

@Controller("api")
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
}
