import "@babel/polyfill";
import helmet from "helmet";
import cors from "cors";
import responseTime from "response-time";
import { json, urlencoded, text } from "body-parser";
import { Server } from "@overnightjs/core";
import { success } from "signale";

// This `join` is required for static files in app.ts
import { join } from "path";

import {
  errorHandler,
  trackingHandler,
  rateLimitHandler,
  speedLimitHandler
} from "./helpers/middleware";
import { Request, Response } from "express";
import { MOVED_PERMANENTLY, MOVED_TEMPORARILY } from "http-status-codes";
import { DISALLOW_OPEN_CORS } from "./config";

export class Staart extends Server {
  constructor() {
    super();
    this.setupHandlers();
    this.setupControllers();
    if (!DISALLOW_OPEN_CORS) this.app.use(errorHandler);
  }

  private setupHandlers() {
    this.app.use(cors({ maxAge: 600 }));
    this.app.use(helmet({ hsts: { maxAge: 31536000, preload: true } }));
    this.app.use(json({ limit: "50mb" }));
    this.app.use(text());
    this.app.use(urlencoded({ extended: true }));
    this.app.use(responseTime());
    this.app.use(trackingHandler);
    this.app.use(rateLimitHandler);
    this.app.use(speedLimitHandler);
  }

  private setupControllers() {
    this.app.get("/", (req: Request, res: Response) =>
      res.redirect("https://oswaldlabs.com/platform/")
    );
    this.app.get("/_/:envState/:apiKey", (req: Request, res: Response) =>
      res.redirect(MOVED_PERMANENTLY, `/v1/agastya/loader/${req.params.apiKey}`)
    );
    this.app.get("/_/:apiKey", (req: Request, res: Response) =>
      res.redirect(MOVED_PERMANENTLY, `/v1/agastya/loader/${req.params.apiKey}`)
    );
    this.app.get("/screenshot", (req: Request, res: Response) =>
      res.redirect(
        MOVED_TEMPORARILY,
        `https://api.microlink.io?url=${encodeURIComponent(
          req.query.url
        )}&screenshot=true&meta=false&embed=screenshot.url`
      )
    );

    // staart:setup/controllers
  }

  public start(port: number): void {
    this.app.listen(port, () => success(`Listening on ${port}`));
  }
}
