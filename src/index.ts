import express from "express";
import { json } from "body-parser";
import { PORT } from "./config";
import { errorHandler, trackingHandler } from "./helpers/middleware";
import { router } from "./routes";

const app = express();

app.use(json({ limit: "50mb" }));
app.use(trackingHandler);
router(app);

app.use(errorHandler);

app.listen(PORT, () => console.log("App running"));