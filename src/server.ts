import "@babel/polyfill";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rfs from "rotating-file-stream";
import responseTime from "response-time";
import { json, urlencoded, text } from "body-parser";
import { Server } from "@overnightjs/core";
import {
  errorHandler,
  trackingHandler,
  rateLimitHandler,
  speedLimitHandler
} from "./helpers/middleware";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { Request, Response } from "express";
import { MOVED_PERMANENTLY } from "http-status-codes";
import { DISALLOW_OPEN_CORS } from "./config";

const logDirectory = join(__dirname, "..", "logs");
existsSync(logDirectory) || mkdirSync(logDirectory);
const accessLogStream = rfs("access.log", {
  interval: "1d",
  path: logDirectory
});
console.log(`✅  Prepared logging`);

export class Staart extends Server {
  constructor() {
    super();
    this.setupHandlers();
    this.setupControllers();
    if (!DISALLOW_OPEN_CORS) this.app.use(errorHandler);
  }

  private setupHandlers() {
    this.app.use(cors());
    this.app.use(helmet({ hsts: { maxAge: 31536000, preload: true } }));
    this.app.use(morgan("combined", { stream: accessLogStream }));
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
    this.app.get("/_/:apiKey", (req: Request, res: Response) =>
      res.redirect(
        MOVED_PERMANENTLY,
        `/v1/agastya/loader/${(req.params as any).apiKey}`
      )
    );

    // staart:setup/controllers
  }

  public start(port: number): void {
    this.app.listen(port, () => console.log(`✅  Listening on ${port}`));
  }
}
