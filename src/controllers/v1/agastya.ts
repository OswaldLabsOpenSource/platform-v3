import { Request, Response } from "express";
import {
  Get,
  Controller,
  ClassWrapper,
  Middleware,
  Post,
  Delete
} from "@overnightjs/core";
import asyncHandler from "express-async-handler";
import Joi from "@hapi/joi";
import { joiValidate } from "../../helpers/utils";
import {
  collect,
  agastyaConfigResponse,
  getGdprData,
  deleteGdprData
} from "../../rest/agastya";
import {
  cachedResponse,
  neverCache,
  noCloudflareCache,
  bruteForceHandler
} from "../../helpers/middleware";
import { Locals } from "../../interfaces/general";

@Controller("v1/agastya")
@ClassWrapper(asyncHandler)
export class AgastyaController {
  @Post("collect/:apiKey")
  postCollect(req: Request, res: Response) {
    const apiKey = req.params.apiKey;
    joiValidate({ apiKey: Joi.string().required() }, { apiKey });
    res.send();
    if (typeof req.body === "string") {
      try {
        req.body = JSON.parse(req.body);
      } catch (error) {}
    }
    collect(apiKey, req.body, res.locals as Locals, req.headers)
      .then(() => {})
      .catch(error => console.log("Wasn't able to track event", error));
  }

  @Get("collect/:apiKey")
  getCollect(req: Request, res: Response) {
    const apiKey = req.params.apiKey;
    joiValidate({ apiKey: Joi.string().required() }, { apiKey });
    res.send();
    collect(apiKey, req.query, res.locals as Locals, req.headers)
      .then(() => {})
      .catch(error => console.log("Wasn't able to track event", error));
  }

  @Get("collect.gif")
  @Middleware(neverCache)
  getCollectGif(req: Request, res: Response) {
    const img =
      "47494638396101000100800000dbdfef00000021f90401000000002c00000000010001000002024401003b";
    res.setHeader("Content-Type", "image/gif");
    const query = { ...req.query };
    delete query.apiKey;
    if (req.query.apiKey) {
      collect(
        req.query.apiKey as string,
        query,
        res.locals as Locals,
        req.headers
      )
        .then(() => {})
        .catch(error => console.log("Wasn't able to track event", error));
    }
    res.end(Buffer.from(img, "hex"), "binary");
  }

  @Get("config/:apiKey")
  @Middleware(cachedResponse("10m"))
  @Middleware(noCloudflareCache)
  async getConfig(req: Request, res: Response) {
    const apiKey = req.params.apiKey;
    const domain = req.query.domain as string;
    joiValidate(
      { apiKey: Joi.string().required(), domain: Joi.string() },
      { apiKey, domain }
    );
    res.json(await agastyaConfigResponse(apiKey, req, domain));
  }

  @Get("load/:apiKey")
  @Middleware(cachedResponse("1d"))
  getLoader(req: Request, res: Response) {
    const environment = req.query.env || "production";
    const apiKey = (req.params.apiKey || "").replace(".js", "");
    joiValidate(
      {
        apiKey: Joi.string().required(),
        environment: Joi.string().allow(
          "production",
          "acceptance",
          "development"
        )
      },
      { apiKey, environment }
    );
    const script = `!function(){"use strict";var s=new XMLHttpRequest;s.onreadystatechange=function(){if(4===s.readyState){var e=JSON.parse(s.responseText),t=e["plugin-url"]+"/agastya."+e["cache-key"]+".js",a=document.createElement("script");a.id="agastya4script",a.setAttribute("data-cache-key",e["cache-key"]),a.setAttribute("data-app-url",e["app-url"]),a.setAttribute("data-api-key","${apiKey}"),a.setAttribute("data-plugin-url",e["plugin-url"]),a.setAttribute("src",t),(document.getElementsByTagName("head")[0]||document.head||document.body||document.documentElement).appendChild(a)}},s.open("GET","https://agastya-version.oswaldlabs.com/meta.${environment}.json",!0),s.setRequestHeader("cache-control","no-cache,must-revalidate,post-check=0,pre-check=0,max-age=0"),s.send()}();`;
    res.type("js").send(script);
  }

  @Get("gdpr")
  @Middleware(bruteForceHandler)
  async getGdprExport(req: Request, res: Response) {
    const result = await getGdprData(res.locals as Locals);
    res.json(result);
  }

  @Delete("gdpr")
  @Middleware(bruteForceHandler)
  async deleteGdprData(req: Request, res: Response) {
    await deleteGdprData(res.locals as Locals);
    res.json({ deleted: true });
  }
}
