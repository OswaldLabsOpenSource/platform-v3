import { Request, Response } from "express";
import { UserRole } from "../../interfaces/enum";
import { INVALID_TOKEN } from "@staart/errors";
import {
  sendPasswordReset,
  login,
  updatePassword,
  validateRefreshToken,
  impersonate,
  approveLocation,
  verifyEmail,
  register,
  login2FA,
  invalidateRefreshToken
} from "../../rest/auth";
import { verifyToken, LoginResponse } from "../../helpers/jwt";
import { RESOURCE_CREATED, respond } from "@staart/messages";
import { Post, Controller, Middleware, ClassWrapper } from "@overnightjs/core";
import {
  authHandler,
  bruteForceHandler,
  validator
} from "../../helpers/middleware";
import asyncHandler from "express-async-handler";
import { joiValidate, hashIdToId } from "../../helpers/utils";
import Joi from "@hapi/joi";

@Controller("v1/auth")
@ClassWrapper(asyncHandler)
export class AuthController {
  @Post("register")
  @Middleware(bruteForceHandler)
  @Middleware(
    validator(
      {
        email: Joi.string()
          .email()
          .required(),
        name: Joi.string()
          .min(3)
          .regex(/^[a-zA-Z ]*$/)
          .required(),
        countryCode: Joi.string().length(2),
        password: Joi.string().min(6),
        gender: Joi.string().length(1),
        preferredLanguage: Joi.string()
          .min(2)
          .max(5),
        timezone: Joi.string()
      },
      "body"
    )
  )
  async register(req: Request, res: Response) {
    const email = req.body.email;
    const user = req.body;
    delete user.organizationId;
    delete user.email;
    if (user.role == UserRole.ADMIN) delete user.role;
    delete user.membershipRole;
    await register(
      user,
      res.locals,
      email,
      req.body.organizationId,
      req.body.membershipRole
    );
    return respond(req, res, RESOURCE_CREATED);
  }

  @Post("login")
  @Middleware(bruteForceHandler)
  @Middleware(
    validator(
      {
        email: Joi.string()
          .email()
          .required(),
        password: Joi.string()
          .min(6)
          .required()
      },
      "body"
    )
  )
  async login(req: Request, res: Response) {
    res.json(await login(req.body.email, req.body.password, res.locals));
  }

  @Post("2fa")
  @Middleware(
    validator(
      {
        token: Joi.string().required(),
        code: Joi.number()
          .min(5)
          .required()
      },
      "body"
    )
  )
  async twoFactor(req: Request, res: Response) {
    const code = req.body.code;
    const token = req.body.token;
    res.json(await login2FA(code, token, res.locals));
  }

  @Post("verify-token")
  @Middleware(
    validator(
      {
        token: Joi.string().required(),
        subject: Joi.string().required()
      },
      "body"
    )
  )
  async postVerifyToken(req: Request, res: Response) {
    const token =
      req.body.token || (req.get("Authorization") || "").replace("Bearer ", "");
    const subject = req.body.subject;
    try {
      const data = await verifyToken(token, subject);
      res.json({ verified: true, data });
    } catch (error) {
      throw new Error(INVALID_TOKEN);
    }
  }

  @Post("refresh")
  async postRefreshToken(req: Request, res: Response) {
    const token =
      req.body.token || (req.get("Authorization") || "").replace("Bearer ", "");
    joiValidate({ token: Joi.string().required() }, { token });
    res.json(await validateRefreshToken(token, res.locals));
  }

  @Post("logout")
  async postLogout(req: Request, res: Response) {
    const token =
      req.body.token || (req.get("Authorization") || "").replace("Bearer ", "");
    joiValidate({ token: Joi.string().required() }, { token });
    res.json(await invalidateRefreshToken(token, res.locals));
  }

  @Post("reset-password/request")
  @Middleware(
    validator(
      {
        email: Joi.string()
          .email()
          .required()
      },
      "body"
    )
  )
  async postResetPasswordRequest(req: Request, res: Response) {
    const email = req.body.email;
    await sendPasswordReset(email, res.locals);
    res.json({ queued: true });
  }

  @Post("reset-password/recover")
  async postResetPasswordRecover(req: Request, res: Response) {
    const token =
      req.body.token || (req.get("Authorization") || "").replace("Bearer ", "");
    const password = req.body.password;
    joiValidate(
      {
        token: Joi.string().required(),
        password: Joi.string()
          .min(6)
          .required()
      },
      { token, password }
    );
    await updatePassword(token, password, res.locals);
    res.json({ success: true, message: "auth-recover-success" });
  }

  @Post("impersonate/:id")
  @Middleware(authHandler)
  @Middleware(
    validator({ impersonateUserId: Joi.string().required() }, "params")
  )
  async getImpersonate(req: Request, res: Response) {
    const tokenUserId = res.locals.token.id;
    const impersonateUserId = hashIdToId(req.params.id);
    res.json(await impersonate(tokenUserId, impersonateUserId, res.locals));
  }

  @Post("approve-location")
  async getApproveLocation(req: Request, res: Response) {
    const token = req.body.token || req.params.token;
    joiValidate({ token: Joi.string().required() }, { token });
    res.json(await approveLocation(token, res.locals));
  }

  @Post("verify-email")
  async postVerifyEmail(req: Request, res: Response) {
    const token = req.body.token || req.params.token;
    joiValidate({ token: Joi.string().required() }, { token });
    await verifyEmail(token, res.locals);
    res.json({ success: true, message: "auth-verify-email-success" });
  }
}
