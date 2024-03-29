import { Request, Response } from "express";
import {
  getMembershipDetailsForUser,
  deleteMembershipForUser,
  updateMembershipForUser
} from "../../rest/membership";
import {
  Get,
  Patch,
  Put,
  Delete,
  Controller,
  ClassMiddleware,
  ClassWrapper,
  Middleware
} from "@overnightjs/core";
import { authHandler, validator } from "../../helpers/middleware";
import asyncHandler from "express-async-handler";
import Joi from "@hapi/joi";
import { hashIdToId } from "../../helpers/utils";
import { Locals } from "../../interfaces/general";

@Controller("v1/memberships")
@ClassWrapper(asyncHandler)
@ClassMiddleware(authHandler)
export class MembershipController {
  @Get(":id")
  @Middleware(validator({ id: Joi.string().required() }, "params"))
  async get(req: Request, res: Response) {
    const membershipId = hashIdToId(req.params.id);
    const userId = res.locals.token.id;
    res.json(await getMembershipDetailsForUser(userId, membershipId));
  }

  @Delete(":id")
  @Middleware(validator({ id: Joi.string().required() }, "params"))
  async delete(req: Request, res: Response) {
    const userId = res.locals.token.id;
    const membershipId = hashIdToId(req.params.id);
    await deleteMembershipForUser(userId, membershipId, res.locals as Locals);
    res.json({ deleted: true });
  }

  @Patch(":id")
  @Middleware(validator({ id: Joi.string().required() }, "params"))
  async patch(req: Request, res: Response) {
    const userId = res.locals.token.id;
    const membershipId = hashIdToId(req.params.id);
    const data = req.body;
    delete req.body.id;
    await updateMembershipForUser(
      userId,
      membershipId,
      data,
      res.locals as Locals
    );
    res.json({ success: true, message: "membership-updated" });
  }
}
