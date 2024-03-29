import { Request, Response } from "express";
import {
  getUserFromId,
  updateUserForUser,
  getAllDataForUser,
  getRecentEventsForUser,
  deleteUserForUser,
  getMembershipsForUser,
  enable2FAForUser,
  disable2FAForUser,
  verify2FAForUser,
  getBackupCodesForUser,
  regenerateBackupCodesForUser,
  updatePasswordForUser,
  deleteAccessTokenForUser,
  updateAccessTokenForUser,
  getUserAccessTokenForUser,
  createAccessTokenForUser,
  getUserAccessTokensForUser,
  deleteSessionForUser,
  getUserSessionForUser,
  getUserSessionsForUser,
  getUserIdentitiesForUser,
  deleteIdentityForUser,
  getUserIdentityForUser,
  createUserIdentityForUser,
  connectUserIdentityForUser
} from "../../rest/user";
import {
  Get,
  Patch,
  Post,
  Put,
  Delete,
  Controller,
  ClassMiddleware,
  ClassWrapper,
  Middleware
} from "@overnightjs/core";
import { authHandler, validator } from "../../helpers/middleware";
import { RESOURCE_CREATED, respond } from "@staart/messages";
import {
  getAllEmailsForUser,
  addEmailToUserForUser,
  deleteEmailFromUserForUser,
  getEmailForUser,
  resendEmailVerificationForUser
} from "../../rest/email";
import asyncHandler from "express-async-handler";
import { joiValidate, userUsernameToId, hashIdToId } from "../../helpers/utils";
import Joi from "@hapi/joi";
import {
  deleteMembershipForUser,
  getMembershipDetailsForUser,
  updateMembershipForUser
} from "../../rest/membership";
import { Locals } from "../../interfaces/general";

@Controller("v1/users")
@ClassMiddleware(authHandler)
@ClassWrapper(asyncHandler)
export class UserController {
  @Get(":id")
  async get(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res.json(await getUserFromId(id, res.locals.token.id));
  }

  @Patch(":id")
  @Middleware(
    validator(
      {
        name: Joi.string()
          .min(3)
          .regex(/^[a-zA-Z ]*$/),
        username: Joi.string().regex(/^[a-z0-9\-]+$/i),
        nickname: Joi.string(),
        primaryEmail: Joi.string(),
        countryCode: Joi.string().length(2),
        password: Joi.string().min(6),
        gender: Joi.string().length(1),
        preferredLanguage: Joi.string()
          .min(2)
          .max(5),
        timezone: Joi.string(),
        notificationEmails: Joi.number(),
        prefersReducedMotion: Joi.boolean(),
        prefersColorSchemeDark: Joi.boolean(),
        profilePicture: Joi.string(),
        checkLocationOnLogin: Joi.boolean()
      },
      "body"
    )
  )
  async patch(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    await updateUserForUser(
      res.locals.token.id,
      id,
      req.body,
      (res.locals as Locals) as Locals
    );
    res.json({ success: true, message: "user-updated" });
  }

  @Delete(":id")
  async delete(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res.json(
      await deleteUserForUser(res.locals.token.id, id, res.locals as Locals)
    );
  }

  @Put(":id/password")
  @Middleware(
    validator(
      {
        oldPassword: Joi.string()
          .min(6)
          .required(),
        newPassword: Joi.string()
          .min(6)
          .required()
      },
      "body"
    )
  )
  async updatePassword(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()]
      },
      { id }
    );
    await updatePasswordForUser(
      res.locals.token.id,
      id,
      oldPassword,
      newPassword,
      res.locals as Locals
    );
    res.json({ success: true, message: "user-password-updated" });
  }

  @Get(":id/events")
  async getRecentEvents(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res.json(await getRecentEventsForUser(res.locals.token.id, id, req.query));
  }

  @Get(":id/memberships")
  async getMemberships(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res.json(await getMembershipsForUser(res.locals.token.id, id, req.query));
  }

  @Get(":id/memberships/:membershipId")
  async getMembership(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const membershipId = hashIdToId(req.params.membershipId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        membershipId: Joi.string().required()
      },
      { id, membershipId }
    );
    res.json(await getMembershipDetailsForUser(id, membershipId));
  }

  @Delete(":id/memberships/:membershipId")
  async deleteMembership(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const membershipId = hashIdToId(req.params.membershipId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        membershipId: Joi.string().required()
      },
      { id, membershipId }
    );
    await deleteMembershipForUser(id, membershipId, res.locals as Locals);
    res.json({ deleted: true });
  }

  @Patch(":id/memberships/:membershipId")
  async updateMembership(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const membershipId = hashIdToId(req.params.membershipId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        membershipId: Joi.string().required()
      },
      { id, membershipId }
    );
    const data = req.body;
    delete req.body.id;
    await updateMembershipForUser(id, membershipId, data, res.locals as Locals);
    res.json({ success: true, message: "membership-updated" });
  }

  @Get(":id/data")
  async getUserData(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res.json(await getAllDataForUser(res.locals.token.id, id));
  }

  @Get(":id/emails")
  async getEmails(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res.json(await getAllEmailsForUser(res.locals.token.id, id, req.query));
  }

  @Put(":id/emails")
  async putEmails(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const email = req.body.email;
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        email: Joi.string()
          .email()
          .required()
      },
      { id, email }
    );
    await addEmailToUserForUser(
      res.locals.token.id,
      id,
      email,
      (res.locals as Locals) as Locals
    );
    return respond(req, res, RESOURCE_CREATED);
  }

  @Get(":id/emails/:emailId")
  async getEmail(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const emailId = hashIdToId(req.params.emailId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        emailId: Joi.string().required()
      },
      { id, emailId }
    );
    res.json(await getEmailForUser(res.locals.token.id, id, emailId));
  }

  @Post(":id/emails/:emailId/resend")
  async postResend(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const emailId = hashIdToId(req.params.emailId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        emailId: Joi.string().required()
      },
      { id, emailId }
    );
    await resendEmailVerificationForUser(res.locals.token.id, id, emailId);
    res.json({ success: true, message: "user-email-verify-resent" });
  }

  @Delete(":id/emails/:emailId")
  async deleteEmail(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const emailId = hashIdToId(req.params.emailId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        emailId: Joi.string().required()
      },
      { id, emailId }
    );
    await deleteEmailFromUserForUser(
      res.locals.token.id,
      id,
      emailId,
      res.locals as Locals
    );
    res.json({ success: true, message: "user-email-deleted" });
  }

  @Get(":id/2fa/enable")
  async getEnable2FA(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res.json(await enable2FAForUser(res.locals.token.id, id));
  }

  @Post(":id/2fa/verify")
  async postVerify2FA(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const code = req.body.code;
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        code: Joi.number()
          .min(5)
          .required()
      },
      { id, code }
    );
    res.json(await verify2FAForUser(res.locals.token.id, id, code));
  }

  @Delete(":id/2fa")
  async delete2FA(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res.json(await disable2FAForUser(res.locals.token.id, id));
  }

  @Get(":id/backup-codes")
  async getBackupCodes(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res.json(await getBackupCodesForUser(res.locals.token.id, id));
  }

  @Get(":id/backup-codes/regenerate")
  async getRegenerateBackupCodes(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res.json(await regenerateBackupCodesForUser(res.locals.token.id, id));
  }

  @Get(":id/access-tokens")
  async getUserAccessTokens(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    const accessTokenParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        itemsPerPage: Joi.number()
      },
      accessTokenParams
    );
    res.json(
      await getUserAccessTokensForUser(
        res.locals.token.id,
        id,
        accessTokenParams
      )
    );
  }

  @Put(":id/access-tokens")
  @Middleware(
    validator(
      {
        scopes: Joi.string(),
        name: Joi.string(),
        description: Joi.string()
      },
      "body"
    )
  )
  async putUserAccessTokens(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    await createAccessTokenForUser(
      res.locals.token.id,
      id,
      req.body,
      res.locals as Locals
    );
    return respond(req, res, RESOURCE_CREATED);
  }

  @Get(":id/access-tokens/:accessTokenId")
  async getUserAccessToken(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const accessTokenId = hashIdToId(req.params.accessTokenId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        accessTokenId: Joi.string().required()
      },
      { id, accessTokenId }
    );
    res.json(
      await getUserAccessTokenForUser(res.locals.token.id, id, accessTokenId)
    );
  }

  @Patch(":id/access-tokens/:accessTokenId")
  @Middleware(
    validator(
      {
        scopes: Joi.string().allow(""),
        name: Joi.string().allow(""),
        description: Joi.string().allow("")
      },
      "body"
    )
  )
  async patchUserAccessToken(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const accessTokenId = hashIdToId(req.params.accessTokenId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        accessTokenId: Joi.string().required()
      },
      { id, accessTokenId }
    );
    res.json(
      await updateAccessTokenForUser(
        res.locals.token.id,
        id,
        accessTokenId,
        req.body,
        res.locals as Locals
      )
    );
  }

  @Delete(":id/access-tokens/:accessTokenId")
  async deleteUserAccessToken(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const accessTokenId = hashIdToId(req.params.accessTokenId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        accessTokenId: Joi.string().required()
      },
      { id, accessTokenId }
    );
    res.json(
      await deleteAccessTokenForUser(
        res.locals.token.id,
        id,
        accessTokenId,
        res.locals as Locals
      )
    );
  }

  @Get(":id/sessions")
  async getUserSessions(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    const sessionParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        itemsPerPage: Joi.number()
      },
      sessionParams
    );
    res.json(
      await getUserSessionsForUser(res.locals.token.id, id, sessionParams)
    );
  }

  @Get(":id/sessions/:sessionId")
  async getUserSession(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const sessionId = hashIdToId(req.params.sessionId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        sessionId: Joi.string().required()
      },
      { id, sessionId }
    );
    res.json(await getUserSessionForUser(res.locals.token.id, id, sessionId));
  }

  @Delete(":id/sessions/:sessionId")
  async deleteUserSession(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const sessionId = hashIdToId(req.params.sessionId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        sessionId: Joi.string().required()
      },
      { id, sessionId }
    );
    res.json(
      await deleteSessionForUser(
        res.locals.token.id,
        id,
        sessionId,
        (res.locals as Locals) as Locals
      )
    );
  }

  @Get(":id/identities")
  async getUserIdentities(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    const identityParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        itemsPerPage: Joi.number()
      },
      identityParams
    );
    res.json(
      await getUserIdentitiesForUser(res.locals.token.id, id, identityParams)
    );
  }

  @Put(":id/identities")
  async createUserIdentity(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res.json(
      await createUserIdentityForUser(res.locals.token.id, id, req.body)
    );
  }

  @Post(":id/identities/:service")
  async connectUserIdentity(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    const service = req.params.service;
    const url = req.body.url;
    joiValidate(
      { service: Joi.string().required(), url: Joi.string().required() },
      { service, url }
    );
    res.json(
      await connectUserIdentityForUser(res.locals.token.id, id, service, url)
    );
  }

  @Get(":id/identities/:identityId")
  async getUserIdentity(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const identityId = hashIdToId(req.params.identityId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        identityId: Joi.string().required()
      },
      { id, identityId }
    );
    res.json(await getUserIdentityForUser(res.locals.token.id, id, identityId));
  }

  @Delete(":id/identities/:identityId")
  async deleteUserIdentity(req: Request, res: Response) {
    const id = await userUsernameToId(req.params.id, res.locals.token.id);
    const identityId = hashIdToId(req.params.identityId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        identityId: Joi.string().required()
      },
      { id, identityId }
    );
    res.json(
      await deleteIdentityForUser(
        res.locals.token.id,
        id,
        identityId,
        res.locals as Locals
      )
    );
  }
}
