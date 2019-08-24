import { Request, Response } from "express";
import { Get, Controller, ClassWrapper, Middleware } from "@overnightjs/core";
import asyncHandler from "express-async-handler";
import { getPublicData } from "../../rest/admin";
import { cachedResponse } from "../../helpers/middleware";
import { safeRedirect } from "../../helpers/utils";

@Controller("v1/public")
@ClassWrapper(asyncHandler)
export class AdminController {
  @Get("open-data")
  @Middleware(cachedResponse("10m"))
  async getOpenData(req: Request, res: Response) {
    res.json(await getPublicData());
  }

  @Get("open-data-badge")
  @Middleware(cachedResponse("10m"))
  async getOpenDataBadge(req: Request, res: Response) {
    const data = await getPublicData();
    safeRedirect(
      req,
      res,
      `https://img.shields.io/badge/this%20${new Date()
        .toLocaleString("default", { month: "long" })
        .toLowerCase()}-${parseInt(data.value).toLocaleString()}-brightgreen`
    );
  }
}
