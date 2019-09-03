import { Request, Response } from "express";
import {
  newOrganizationForUser,
  updateOrganizationForUser,
  deleteOrganizationForUser,
  getOrganizationForUser,
  getOrganizationBillingForUser,
  updateOrganizationBillingForUser,
  getOrganizationInvoicesForUser,
  getOrganizationSubscriptionsForUser,
  getOrganizationPricingPlansForUser,
  getOrganizationSourcesForUser,
  getOrganizationSourceForUser,
  createOrganizationSourceForUser,
  updateOrganizationSourceForUser,
  deleteOrganizationSourceForUser,
  getAllOrganizationDataForUser,
  getOrganizationMembershipsForUser,
  createOrganizationSubscriptionForUser,
  getOrganizationSubscriptionForUser,
  updateOrganizationSubscriptionForUser,
  getOrganizationInvoiceForUser,
  getOrganizationApiKeysForUser,
  createApiKeyForUser,
  getOrganizationApiKeyForUser,
  updateApiKeyForUser,
  deleteApiKeyForUser,
  getOrganizationAuditWebpagesForUser,
  createAuditWebpageForUser,
  getOrganizationAuditWebpageForUser,
  updateAuditWebpageForUser,
  deleteAuditWebpageForUser,
  getOrganizationAuditsForUser,
  getOrganizationAuditForUser,
  getOrganizationDomainsForUser,
  createDomainForUser,
  getOrganizationDomainForUser,
  updateDomainForUser,
  deleteDomainForUser,
  verifyDomainForUser,
  getOrganizationWebhooksForUser,
  createWebhookForUser,
  getOrganizationWebhookForUser,
  updateWebhookForUser,
  deleteWebhookForUser,
  getAgastyaApiKeysForUser,
  createAgastyaApiKeyForUser,
  getAgastyaApiKeyForUser,
  updateAgastyaApiKeyForUser,
  deleteAgastyaApiKeyForUser,
  inviteMemberToOrganization,
  getOrganizationMembershipForUser,
  deleteOrganizationMembershipForUser,
  updateOrganizationMembershipForUser,
  cancelAgastyaApiKeySubscriptionForUser,
  revertAgastyaApiKeySubscriptionForUser,
  getOrganizationApiKeyLogsForUser,
  getOrganizationAgastyaApiKeyLogsForUser,
  getOrganizationAgastyaApiKeyGraphsForUser
} from "../../rest/organization";
import {
  Get,
  Put,
  Patch,
  Delete,
  Controller,
  ClassMiddleware,
  ClassWrapper,
  Middleware,
  Post
} from "@overnightjs/core";
import { authHandler, validator } from "../../helpers/middleware";
import { MembershipRole } from "../../interfaces/enum";
import { CREATED } from "http-status-codes";
import asyncHandler from "express-async-handler";
import {
  joiValidate,
  organizationUsernameToId,
  localsToTokenOrKey,
  hashIdToId
} from "../../helpers/utils";
import Joi from "@hapi/joi";

@Controller("v1/organizations")
@ClassWrapper(asyncHandler)
@ClassMiddleware(authHandler)
export class OrganizationController {
  @Put()
  @Middleware(
    validator(
      {
        name: Joi.string().required()
      },
      "body"
    )
  )
  async put(req: Request, res: Response) {
    await newOrganizationForUser(res.locals.token.id, req.body, res.locals);
    res
      .status(CREATED)
      .json({ success: true, message: "organization-created" });
  }

  @Get(":id")
  async get(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate({ id: Joi.string().required() }, { id });
    const organization = await getOrganizationForUser(
      localsToTokenOrKey(res),
      id
    );
    res.json(organization);
  }

  @Patch(":id")
  @Middleware(
    validator(
      {
        name: Joi.string(),
        username: Joi.string().regex(/^[a-z0-9\-]+$/i),
        forceTwoFactor: Joi.boolean(),
        autoJoinDomain: Joi.boolean(),
        onlyAllowDomain: Joi.boolean(),
        ipRestrictions: Joi.string(),
        profilePicture: Joi.string()
      },
      "body"
    )
  )
  async patch(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate({ id: Joi.string().required() }, { id });
    await updateOrganizationForUser(
      localsToTokenOrKey(res),
      id,
      req.body,
      res.locals
    );
    res.json({ success: true, message: "organization-updated" });
  }

  @Delete(":id")
  async delete(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.string().required() },
      { organizationId }
    );
    await deleteOrganizationForUser(
      res.locals.token.id,
      organizationId,
      res.locals
    );
    res.json({ success: true, message: "organization-deleted" });
  }

  @Get(":id/billing")
  async getBilling(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.string().required() },
      { organizationId }
    );
    res.json(
      await getOrganizationBillingForUser(
        localsToTokenOrKey(res),
        organizationId
      )
    );
  }

  @Patch(":id/billing")
  async patchBilling(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.string().required() },
      { organizationId }
    );
    await updateOrganizationBillingForUser(
      localsToTokenOrKey(res),
      organizationId,
      req.body,
      res.locals
    );
    res.json({ success: true, message: "organization-billing-updated" });
  }

  @Get(":id/invoices")
  async getInvoices(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.string().required() },
      { organizationId }
    );
    const subscriptionParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        billing: Joi.string().valid("charge_automatically", "send_invoice"),
        itemsPerPage: Joi.number(),
        plan: Joi.string(),
        status: Joi.string()
      },
      subscriptionParams
    );
    res.json(
      await getOrganizationInvoicesForUser(
        localsToTokenOrKey(res),
        organizationId,
        subscriptionParams
      )
    );
  }

  @Get(":id/invoices/:invoiceId")
  async getInvoice(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    const invoiceId = req.params.invoiceId;
    joiValidate(
      {
        organizationId: Joi.string().required(),
        invoiceId: Joi.string().required()
      },
      { organizationId, invoiceId }
    );
    res.json(
      await getOrganizationInvoiceForUser(
        localsToTokenOrKey(res),
        organizationId,
        invoiceId
      )
    );
  }

  @Get(":id/sources")
  async getSources(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.string().required() },
      { organizationId }
    );
    const subscriptionParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        itemsPerPage: Joi.number()
      },
      subscriptionParams
    );
    res.json(
      await getOrganizationSourcesForUser(
        localsToTokenOrKey(res),
        organizationId,
        subscriptionParams
      )
    );
  }

  @Get(":id/sources/:sourceId")
  async getSource(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    const sourceId = req.params.sourceId;
    joiValidate(
      {
        organizationId: Joi.string().required(),
        sourceId: Joi.string().required()
      },
      { organizationId, sourceId }
    );
    res.json(
      await getOrganizationSourceForUser(
        localsToTokenOrKey(res),
        organizationId,
        sourceId
      )
    );
  }

  @Get(":id/subscriptions")
  async getSubscriptions(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.string().required() },
      { organizationId }
    );
    const subscriptionParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        billing: Joi.string().valid("charge_automatically", "send_invoice"),
        itemsPerPage: Joi.number(),
        plan: Joi.string(),
        status: Joi.string()
      },
      subscriptionParams
    );
    res.json(
      await getOrganizationSubscriptionsForUser(
        localsToTokenOrKey(res),
        organizationId,
        subscriptionParams
      )
    );
  }

  @Get(":id/subscriptions/:subscriptionId")
  async getSubscription(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    const subscriptionId = req.params.subscriptionId;
    joiValidate(
      {
        organizationId: Joi.string().required(),
        subscriptionId: Joi.string().required()
      },
      { organizationId, subscriptionId }
    );
    res.json(
      await getOrganizationSubscriptionForUser(
        localsToTokenOrKey(res),
        organizationId,
        subscriptionId
      )
    );
  }

  @Patch(":id/subscriptions/:subscriptionId")
  async patchSubscription(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    const subscriptionId = req.params.subscriptionId;
    const data = req.body;
    joiValidate(
      {
        organizationId: Joi.string().required(),
        subscriptionId: Joi.string().required()
      },
      { organizationId, subscriptionId }
    );
    joiValidate(
      {
        billing: Joi.string().valid("charge_automatically", "send_invoice"),
        cancel_at_period_end: Joi.boolean(),
        coupon: Joi.string(),
        default_source: Joi.string()
      },
      data
    );
    res.json(
      await updateOrganizationSubscriptionForUser(
        localsToTokenOrKey(res),
        organizationId,
        subscriptionId,
        data,
        res.locals
      )
    );
  }

  @Put(":id/subscriptions")
  async putSubscriptions(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.string().required() },
      { organizationId }
    );
    const subscriptionParams = { ...req.body };
    joiValidate(
      {
        plan: Joi.string().required(),
        billing: Joi.string().valid("charge_automatically", "send_invoice"),
        tax_percent: Joi.number(),
        number_of_seats: Joi.number()
      },
      subscriptionParams
    );
    res.json(
      await createOrganizationSubscriptionForUser(
        localsToTokenOrKey(res),
        organizationId,
        subscriptionParams,
        undefined,
        res.locals
      )
    );
  }

  @Get(":id/pricing")
  async getPlans(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      {
        organizationId: Joi.string().required()
      },
      { organizationId }
    );
    res.json(
      await getOrganizationPricingPlansForUser(
        localsToTokenOrKey(res),
        organizationId
      )
    );
  }

  @Put(":id/sources")
  async putSources(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.string().required() },
      { organizationId }
    );
    res
      .status(CREATED)
      .json(
        await createOrganizationSourceForUser(
          localsToTokenOrKey(res),
          organizationId,
          req.body,
          res.locals
        )
      );
  }

  @Delete(":id/sources/:sourceId")
  async deleteSource(req: Request, res: Response) {
    const sourceId = req.params.sourceId;
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      {
        organizationId: Joi.string().required(),
        sourceId: Joi.string().required()
      },
      { organizationId, sourceId }
    );
    res.json(
      await deleteOrganizationSourceForUser(
        localsToTokenOrKey(res),
        organizationId,
        sourceId,
        res.locals
      )
    );
  }

  @Patch(":id/sources/:sourceId")
  async patchSource(req: Request, res: Response) {
    const sourceId = req.params.sourceId;
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      {
        organizationId: Joi.string().required(),
        sourceId: Joi.string().required()
      },
      { organizationId, sourceId }
    );
    res.json(
      await updateOrganizationSourceForUser(
        localsToTokenOrKey(res),
        organizationId,
        sourceId,
        req.body,
        res.locals
      )
    );
  }

  @Get(":id/data")
  async getData(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.string().required() },
      { organizationId }
    );
    res.json(
      await getAllOrganizationDataForUser(
        localsToTokenOrKey(res),
        organizationId
      )
    );
  }

  @Get(":id/memberships")
  async getMemberships(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.string().required() },
      { organizationId }
    );
    res.json(
      await getOrganizationMembershipsForUser(
        localsToTokenOrKey(res),
        organizationId,
        req.query
      )
    );
  }

  @Put(":id/memberships")
  async putMemberships(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    const newMemberName = req.body.name;
    const newMemberEmail = req.body.email;
    const role = req.body.role;
    joiValidate(
      {
        organizationId: Joi.string().required(),
        newMemberName: Joi.string()
          .min(6)
          .required(),
        newMemberEmail: Joi.string()
          .email()
          .required(),
        role: Joi.number()
      },
      {
        organizationId,
        newMemberName,
        newMemberEmail,
        role
      }
    );
    await inviteMemberToOrganization(
      localsToTokenOrKey(res),
      organizationId,
      newMemberName,
      newMemberEmail,
      role || MembershipRole.MEMBER,
      res.locals
    );
    res.status(CREATED).json({ invited: true });
  }

  @Get(":id/memberships/:membershipId")
  async getMembership(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    const membershipId = hashIdToId(req.params.membershipId);
    joiValidate(
      {
        organizationId: Joi.string().required(),
        membershipId: Joi.string().required()
      },
      { organizationId, membershipId }
    );
    res.json(
      await getOrganizationMembershipForUser(
        localsToTokenOrKey(res),
        organizationId,
        membershipId
      )
    );
  }

  @Patch(":id/memberships/:membershipId")
  @Middleware(
    validator(
      {
        role: Joi.number()
          .min(1)
          .max(5)
      },
      "body"
    )
  )
  async updateMembership(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    const membershipId = hashIdToId(req.params.membershipId);
    joiValidate(
      {
        organizationId: Joi.string().required(),
        membershipId: Joi.string().required()
      },
      { organizationId, membershipId }
    );
    res.json(
      await updateOrganizationMembershipForUser(
        localsToTokenOrKey(res),
        organizationId,
        membershipId,
        req.body
      )
    );
  }

  @Delete(":id/memberships/:membershipId")
  async deleteMembership(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    const membershipId = hashIdToId(req.params.membershipId);
    joiValidate(
      {
        organizationId: Joi.string().required(),
        membershipId: Joi.string().required()
      },
      { organizationId, membershipId }
    );
    res.json(
      await deleteOrganizationMembershipForUser(
        localsToTokenOrKey(res),
        organizationId,
        membershipId
      )
    );
  }

  @Get(":id/api-keys")
  async getUserApiKeys(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    const apiKeyParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        itemsPerPage: Joi.number()
      },
      apiKeyParams
    );
    res.json(
      await getOrganizationApiKeysForUser(
        localsToTokenOrKey(res),
        id,
        apiKeyParams
      )
    );
  }

  @Put(":id/api-keys")
  @Middleware(
    validator(
      {
        scopes: Joi.string(),
        ipRestrictions: Joi.string(),
        referrerRestrictions: Joi.string(),
        name: Joi.string(),
        description: Joi.string()
      },
      "body"
    )
  )
  async putUserApiKeys(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res
      .status(CREATED)
      .json(
        await createApiKeyForUser(
          localsToTokenOrKey(res),
          id,
          req.body,
          res.locals
        )
      );
  }

  @Get(":id/api-keys/:apiKeyId")
  async getUserApiKey(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const apiKeyId = hashIdToId(req.params.apiKeyId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        apiKeyId: Joi.string().required()
      },
      { id, apiKeyId }
    );
    res.json(
      await getOrganizationApiKeyForUser(localsToTokenOrKey(res), id, apiKeyId)
    );
  }

  @Patch(":id/api-keys/:apiKeyId")
  @Middleware(
    validator(
      {
        scopes: Joi.string().allow(""),
        ipRestrictions: Joi.string().allow(""),
        referrerRestrictions: Joi.string().allow(""),
        name: Joi.string().allow(""),
        description: Joi.string().allow("")
      },
      "body"
    )
  )
  async patchUserApiKey(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const apiKeyId = hashIdToId(req.params.apiKeyId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        apiKeyId: Joi.string().required()
      },
      { id, apiKeyId }
    );
    res.json(
      await updateApiKeyForUser(
        localsToTokenOrKey(res),
        id,
        apiKeyId,
        req.body,
        res.locals
      )
    );
  }

  @Delete(":id/api-keys/:apiKeyId")
  async deleteUserApiKey(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const apiKeyId = hashIdToId(req.params.apiKeyId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        apiKeyId: Joi.string().required()
      },
      { id, apiKeyId }
    );
    res.json(
      await deleteApiKeyForUser(
        localsToTokenOrKey(res),
        id,
        apiKeyId,
        res.locals
      )
    );
  }

  @Get(":id/api-keys/:apiKeyId/logs")
  async getUserApiKeyLogs(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const apiKeyId = hashIdToId(req.params.apiKeyId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        apiKeyId: Joi.string().required()
      },
      { id, apiKeyId }
    );
    res.json(
      await getOrganizationApiKeyLogsForUser(
        localsToTokenOrKey(res),
        id,
        apiKeyId,
        req.query
      )
    );
  }

  @Get(":id/domains")
  async getUserDomains(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    const domainParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        itemsPerPage: Joi.number()
      },
      domainParams
    );
    res.json(
      await getOrganizationDomainsForUser(
        localsToTokenOrKey(res),
        id,
        domainParams
      )
    );
  }

  @Put(":id/domains")
  @Middleware(
    validator(
      {
        domain: Joi.string()
      },
      "body"
    )
  )
  async putUserDomains(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res
      .status(CREATED)
      .json(
        await createDomainForUser(
          localsToTokenOrKey(res),
          id,
          req.body,
          res.locals
        )
      );
  }

  @Get(":id/domains/:domainId")
  async getUserDomain(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const domainId = hashIdToId(req.params.domainId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        domainId: Joi.string().required()
      },
      { id, domainId }
    );
    res.json(
      await getOrganizationDomainForUser(localsToTokenOrKey(res), id, domainId)
    );
  }

  @Patch(":id/domains/:domainId")
  @Middleware(
    validator(
      {
        domain: Joi.string()
      },
      "body"
    )
  )
  async patchUserDomain(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const domainId = hashIdToId(req.params.domainId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        domainId: Joi.string().required()
      },
      { id, domainId }
    );
    res.json(
      await updateDomainForUser(
        localsToTokenOrKey(res),
        id,
        domainId,
        req.body,
        res.locals
      )
    );
  }

  @Delete(":id/domains/:domainId")
  async deleteUserDomain(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const domainId = hashIdToId(req.params.domainId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        domainId: Joi.string().required()
      },
      { id, domainId }
    );
    res.json(
      await deleteDomainForUser(
        localsToTokenOrKey(res),
        id,
        domainId,
        res.locals
      )
    );
  }

  @Post(":id/domains/:domainId/verify")
  async verifyOrganizationDomain(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const domainId = hashIdToId(req.params.domainId);
    const method = req.body.method || req.query.method;
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        domainId: Joi.string().required(),
        method: Joi.string().only(["file", "dns"])
      },
      { id, domainId, method }
    );
    res.json(
      await verifyDomainForUser(
        localsToTokenOrKey(res),
        id,
        domainId,
        method,
        res.locals
      )
    );
  }

  @Get(":id/webhooks")
  async getUserWebhooks(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    const webhookParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        itemsPerPage: Joi.number()
      },
      webhookParams
    );
    res.json(
      await getOrganizationWebhooksForUser(
        localsToTokenOrKey(res),
        id,
        webhookParams
      )
    );
  }

  @Put(":id/webhooks")
  @Middleware(
    validator(
      {
        event: Joi.string().required(),
        url: Joi.string().required(),
        contentType: Joi.string(),
        secret: Joi.string().allow(""),
        isActive: Joi.boolean()
      },
      "body"
    )
  )
  async putUserWebhooks(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.string().required()] },
      { id }
    );
    res
      .status(CREATED)
      .json(
        await createWebhookForUser(
          localsToTokenOrKey(res),
          id,
          req.body,
          res.locals
        )
      );
  }

  @Get(":id/webhooks/:webhookId")
  async getUserWebhook(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const webhookId = hashIdToId(req.params.webhookId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        webhookId: Joi.string().required()
      },
      { id, webhookId }
    );
    res.json(
      await getOrganizationWebhookForUser(
        localsToTokenOrKey(res),
        id,
        webhookId
      )
    );
  }

  @Patch(":id/webhooks/:webhookId")
  @Middleware(
    validator(
      {
        event: Joi.string(),
        url: Joi.string(),
        contentType: Joi.string(),
        secret: Joi.string(),
        isActive: Joi.boolean()
      },
      "body"
    )
  )
  async patchUserWebhook(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const webhookId = hashIdToId(req.params.webhookId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        webhookId: Joi.string().required()
      },
      { id, webhookId }
    );
    res.json(
      await updateWebhookForUser(
        localsToTokenOrKey(res),
        id,
        webhookId,
        req.body,
        res.locals
      )
    );
  }

  @Delete(":id/webhooks/:webhookId")
  async deleteUserWebhook(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const webhookId = hashIdToId(req.params.webhookId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.string().required()],
        webhookId: Joi.string().required()
      },
      { id, webhookId }
    );
    res.json(
      await deleteWebhookForUser(
        localsToTokenOrKey(res),
        id,
        webhookId,
        res.locals
      )
    );
  }

  @Get(":id/audit-webpages")
  async getAuditWebpages(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.number().required()] },
      { id }
    );
    const auditWebpageParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        itemsPerPage: Joi.number()
      },
      auditWebpageParams
    );
    res.json(
      await getOrganizationAuditWebpagesForUser(
        localsToTokenOrKey(res),
        id,
        auditWebpageParams
      )
    );
  }

  @Put(":id/audit-webpages")
  async putAuditWebpages(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.number().required()] },
      { id }
    );
    joiValidate(
      {
        url: Joi.string().required(),
        repeatEvery: Joi.number()
      },
      req.body
    );
    res
      .status(CREATED)
      .json(
        await createAuditWebpageForUser(
          localsToTokenOrKey(res),
          id,
          req.body,
          res.locals
        )
      );
  }

  @Get(":id/audit-webpages/:auditWebpage")
  async getOrgAuditWebpage(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const auditWebpage = hashIdToId(req.params.auditWebpage);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.number().required()],
        auditWebpage: Joi.string().required()
      },
      { id, auditWebpage }
    );
    res.json(
      await getOrganizationAuditWebpageForUser(
        localsToTokenOrKey(res),
        id,
        auditWebpage
      )
    );
  }

  @Patch(":id/audit-webpages/:auditWebpage")
  async patchOrgAuditWebpage(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const auditWebpage = hashIdToId(req.params.auditWebpage);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.number().required()],
        auditWebpage: Joi.string().required()
      },
      { id, auditWebpage }
    );
    joiValidate(
      {
        url: Joi.string().required(),
        repeatEvery: Joi.number()
      },
      req.body
    );
    res.json(
      await updateAuditWebpageForUser(
        localsToTokenOrKey(res),
        id,
        auditWebpage,
        req.body,
        res.locals
      )
    );
  }

  @Delete(":id/audit-webpages/:auditWebpage")
  async deleteOrgAuditWebpage(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const auditWebpage = hashIdToId(req.params.auditWebpage);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.number().required()],
        auditWebpage: Joi.string().required()
      },
      { id, auditWebpage }
    );
    res.json(
      await deleteAuditWebpageForUser(
        localsToTokenOrKey(res),
        id,
        auditWebpage,
        res.locals
      )
    );
  }

  @Get(":id/audit-webpages/:auditWebpage/audits")
  async getOrgAudits(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const auditWebpage = hashIdToId(req.params.auditWebpage);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.number().required()],
        auditWebpage: Joi.string().required()
      },
      { id, auditWebpage }
    );
    const auditParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        itemsPerPage: Joi.number(),
        q: Joi.string(),
        search: Joi.string(),
        sort: Joi.string()
      },
      auditParams
    );
    res.json(
      await getOrganizationAuditsForUser(
        localsToTokenOrKey(res),
        id,
        auditWebpage,
        auditParams
      )
    );
  }

  @Get(":id/audit-webpages/:auditWebpage/audits/:auditId")
  async getOrgAudit(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const auditId = hashIdToId(req.params.auditId);
    const auditWebpage = hashIdToId(req.params.auditWebpage);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.number().required()],
        auditWebpage: Joi.string().required(),
        auditId: Joi.number().required()
      },
      { id, auditWebpage, auditId }
    );
    res.json(
      await getOrganizationAuditForUser(
        localsToTokenOrKey(res),
        id,
        auditWebpage,
        auditId
      )
    );
  }

  @Get(":id/agastya-api-keys")
  async getUserAgastyaApiKeys(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.number().required()] },
      { id }
    );
    const agastyaApiKeyParams = { ...req.query };
    joiValidate(
      {
        start: Joi.string(),
        itemsPerPage: Joi.number()
      },
      agastyaApiKeyParams
    );
    res.json(
      await getAgastyaApiKeysForUser(
        localsToTokenOrKey(res),
        id,
        agastyaApiKeyParams
      )
    );
  }

  @Put(":id/agastya-api-keys")
  @Middleware(
    validator(
      {
        name: Joi.string(),
        domains: Joi.string()
      },
      "body"
    )
  )
  async putUserAgastyaApiKeys(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    joiValidate(
      { id: [Joi.string().required(), Joi.number().required()] },
      { id }
    );
    res
      .status(CREATED)
      .json(
        await createAgastyaApiKeyForUser(
          localsToTokenOrKey(res),
          id,
          req.body,
          res.locals
        )
      );
  }

  @Get(":id/agastya-api-keys/:agastyaApiKeyId")
  async getUserAgastyaApiKey(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const agastyaApiKeyId = hashIdToId(req.params.agastyaApiKeyId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.number().required()],
        agastyaApiKeyId: Joi.number().required()
      },
      { id, agastyaApiKeyId }
    );
    res.json(
      await getAgastyaApiKeyForUser(
        localsToTokenOrKey(res),
        id,
        agastyaApiKeyId
      )
    );
  }

  @Patch(":id/agastya-api-keys/:agastyaApiKeyId")
  @Middleware(
    validator(
      {
        name: Joi.string(),
        slug: Joi.string(),
        backgroundColor: Joi.string()
          .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
          .allow(""),
        foregroundColor: Joi.string()
          .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
          .allow(""),
        domains: Joi.string().allow(""),
        customCss: Joi.any(),
        variables: Joi.any(),
        protectedInfo: Joi.any(),
        links: Joi.any(),
        layout: Joi.any(),
        integrations: Joi.any()
      },
      "body"
    )
  )
  async patchUserAgastyaApiKey(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const agastyaApiKeyId = hashIdToId(req.params.agastyaApiKeyId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.number().required()],
        agastyaApiKeyId: Joi.number().required()
      },
      { id, agastyaApiKeyId }
    );
    res.json(
      await updateAgastyaApiKeyForUser(
        localsToTokenOrKey(res),
        id,
        agastyaApiKeyId,
        req.body,
        res.locals
      )
    );
  }

  @Delete(":id/agastya-api-keys/:agastyaApiKeyId")
  async deleteUserAgastyaApiKey(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const agastyaApiKeyId = hashIdToId(req.params.agastyaApiKeyId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.number().required()],
        agastyaApiKeyId: Joi.number().required()
      },
      { id, agastyaApiKeyId }
    );
    res.json(
      await deleteAgastyaApiKeyForUser(
        localsToTokenOrKey(res),
        id,
        agastyaApiKeyId,
        res.locals
      )
    );
  }

  @Put(":id/agastya-api-keys/:agastyaApiKeyId/subscription")
  async addSubscriptionsToAgastya(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.number().required() },
      { organizationId }
    );
    const subscriptionParams = { ...req.body };
    joiValidate(
      {
        plan: Joi.string().required(),
        billing: Joi.string().valid("charge_automatically", "send_invoice"),
        tax_percent: Joi.number(),
        number_of_seats: Joi.number()
      },
      subscriptionParams
    );
    res.json(
      await createOrganizationSubscriptionForUser(
        localsToTokenOrKey(res),
        organizationId,
        subscriptionParams,
        hashIdToId(req.params.agastyaApiKeyId),
        res.locals
      )
    );
  }

  @Delete(":id/agastya-api-keys/:agastyaApiKeyId/subscription")
  async deleteSubscriptionsFromAgastya(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.number().required() },
      { organizationId }
    );
    res.json(
      await cancelAgastyaApiKeySubscriptionForUser(
        localsToTokenOrKey(res),
        organizationId,
        hashIdToId(req.params.agastyaApiKeyId)
      )
    );
  }

  @Post(":id/agastya-api-keys/:agastyaApiKeyId/subscription/revert")
  async revertSubscriptionsFromAgastya(req: Request, res: Response) {
    const organizationId = await organizationUsernameToId(req.params.id);
    joiValidate(
      { organizationId: Joi.number().required() },
      { organizationId }
    );
    res.json(
      await revertAgastyaApiKeySubscriptionForUser(
        localsToTokenOrKey(res),
        organizationId,
        hashIdToId(req.params.agastyaApiKeyId)
      )
    );
  }

  @Get(":id/agastya-api-keys/:agastyaApiKeyId/logs")
  async getAgastyaApiKeyLogs(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const agastyaApiKeyId = hashIdToId(req.params.agastyaApiKeyId);
    joiValidate(
      {
        id: [Joi.string().required(), Joi.number().required()],
        agastyaApiKeyId: Joi.number().required()
      },
      { id, agastyaApiKeyId }
    );
    res.json(
      await getOrganizationAgastyaApiKeyLogsForUser(
        localsToTokenOrKey(res),
        id,
        agastyaApiKeyId,
        req.query
      )
    );
  }

  @Get(":id/agastya-api-keys/:agastyaApiKeyId/graphs/:field")
  async getAgastyaApiKeyGraphs(req: Request, res: Response) {
    const id = await organizationUsernameToId(req.params.id);
    const agastyaApiKeyId = hashIdToId(req.params.agastyaApiKeyId);
    const field = req.params.field;
    joiValidate(
      {
        id: [Joi.string().required(), Joi.number().required()],
        agastyaApiKeyId: Joi.number().required(),
        field: Joi.string().required()
      },
      { id, agastyaApiKeyId, field }
    );
    res.json(
      await getOrganizationAgastyaApiKeyGraphsForUser(
        localsToTokenOrKey(res),
        id,
        agastyaApiKeyId,
        field,
        req.query
      )
    );
  }
}
