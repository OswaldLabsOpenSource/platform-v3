import { Request, Response } from "express";
import { Get, Controller, ClassWrapper, Middleware } from "@overnightjs/core";
import asyncHandler from "express-async-handler";
import { getPublicData } from "../../rest/admin";
import { cachedResponse } from "../../helpers/middleware";

@Controller("v1/public")
@ClassWrapper(asyncHandler)
export class AdminController {
  @Get("open-data")
  @Middleware(cachedResponse("10m"))
  async getOpenData(req: Request, res: Response) {
    res.json(await getPublicData());
  }
}
