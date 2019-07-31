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
import { joiValidate } from "../../helpers/utils";
import { collect } from "../../rest/agastya";
import { getAgastyaApiKeyFromSlug } from "../../crud/organization";
import { cachedResponse } from "../../helpers/middleware";
import { NO_CONTENT } from "http-status-codes";

@Controller("v1/agastya")
@ClassWrapper(asyncHandler)
export class AgastyaController {
  @Post("collect/:apiKey")
  postCollect(req: Request, res: Response) {
    const apiKey = req.params.apiKey;
    joiValidate({ apiKey: Joi.string().required() }, { apiKey });
    res.status(NO_CONTENT).send();
    collect(apiKey, req.body, res.locals, req.headers)
      .then(() => {})
      .catch(error => console.log("Wasn't able to track event", error));
  }

  @Get("collect/:apiKey")
  getCollect(req: Request, res: Response) {
    const apiKey = req.params.apiKey;
    joiValidate({ apiKey: Joi.string().required() }, { apiKey });
    res.status(NO_CONTENT).send();
    collect(apiKey, req.query, res.locals, req.headers)
      .then(() => {})
      .catch(error => console.log("Wasn't able to track event", error));
  }

  @Get("config/:apiKey")
  @Middleware(cachedResponse("10m"))
  async getConfig(req: Request, res: Response) {
    const apiKey = req.params.apiKey;
    joiValidate({ apiKey: Joi.string().required() }, { apiKey });
    res.json({
      ...(await getAgastyaApiKeyFromSlug(apiKey)),
      requestUserInfo: {
        ipCountry: (req.get("Cf-Ipcountry") || "").toLowerCase()
      }
    });
  }
}
