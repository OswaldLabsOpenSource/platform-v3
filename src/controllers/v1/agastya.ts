import { Request, Response } from "express";
import { Get, Controller, ClassWrapper } from "@overnightjs/core";
import asyncHandler from "express-async-handler";
import Joi from "@hapi/joi";
import { joiValidate } from "../../helpers/utils";
import { collect } from "../../rest/agastya";

@Controller("v1/agastya")
@ClassWrapper(asyncHandler)
export class AgastyaController {
  @Get("collect/:apiKey")
  async getCollect(req: Request, res: Response) {
    const apiKey = req.params.apiKey;
    joiValidate({ apiKey: Joi.string().required() }, { apiKey });
    let data = req.body;
    if (!data || (typeof data === "object" && !Object.keys(data).length)) {
      if (typeof req.query === "object" && Object.keys(req.query).length) {
        data = req.query;
      }
    }
    res.json(await collect(apiKey, data, res.locals, req.headers));
  }
}
