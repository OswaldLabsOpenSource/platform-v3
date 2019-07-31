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
    if (typeof req.body === "string") {
      try {
        req.body = JSON.parse(req.body);
      } catch (error) {}
    }
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

  @Get("loader/.:apiKey")
  getLoader(req: Request, res: Response) {
    const environment = req.query.env || "production";
    const apiKey = (req.params.apiKey || "").replace(".js", "");
    joiValidate(
      {
        apiKey: Joi.string().required(),
        environment: Joi.string().allow([
          "production",
          "acceptance",
          "development"
        ])
      },
      { apiKey, environment }
    );
    const script = `!function(){"use strict";var s=new XMLHttpRequest;s.onreadystatechange=function(){if(4===s.readyState){var e=JSON.parse(s.responseText),t=e["plugin-url"]+"/agastya."+e["cache-key"]+".js",a=document.createElement("script");a.id="agastyascript",a.setAttribute("data-cache-key",e["cache-key"]),a.setAttribute("data-app-url",e["app-url"]),a.setAttribute("data-api-key","${apiKey}"),a.setAttribute("data-plugin-url",e["plugin-url"]),a.setAttribute("src",t),(document.getElementsByTagName("head")[0]||document.head||document.body||document.documentElement).appendChild(a)}},s.open("GET","https://agastya-version.oswaldlabs.com/meta.${environment}.json",!0),s.setRequestHeader("cache-control","no-cache,must-revalidate,post-check=0,pre-check=0,max-age=0"),s.send()}();`;
    res
      .header(
        "Cache-Control",
        "no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0"
      )
      .type("js")
      .send(script);
  }
}
