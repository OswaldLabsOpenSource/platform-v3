import { Response } from "request";
import { Mail } from "../interfaces/mail";
import { FRONTEND_URL, TEST_EMAIL } from "../config";
import { readFile } from "fs-extra";
import { join } from "path";
import { render } from "mustache";
import marked from "marked";
import { isMatch } from "matcher";
import disposableDomains from "disposable-email-domains/index.json";
import wildcardDomains from "disposable-email-domains/wildcard.json";
import i18n from "../i18n";
import Joi from "@hapi/joi";
import { joiValidate } from "./utils";
import { DISPOSABLE_EMAIL } from "@staart/errors";
import { logError } from "./errors";
import systemInfo from "systeminformation";
import pkg from "../../package.json";

const EMAIL_FROM = process.env.EMAIL_FROM || "";

/**
 * Send a new email
 */
const sendMail = async (mail: Mail) => {
  // Send this email;
};

/**
 * Send a new email
 */
export const mail = async (
  to: number | string,
  template: string,
  data: any = {}
) => {
  const altText = render(
    (await readFile(
      join(__dirname, "..", "..", "..", "src", "templates", `${template}.md`)
    )).toString(),
    { ...data, frontendUrl: FRONTEND_URL }
  );
  const message = marked(altText);
  return await sendMail({
    from: EMAIL_FROM,
    to: to.toString(),
    subject: i18n.en.emails[template] || "",
    message,
    altText
  });
};

export const checkIfDisposableEmail = (email: string) => {
  let isDisposable = false;
  joiValidate(
    {
      email: Joi.string()
        .email()
        .required()
    },
    { email }
  );
  const domain = email.split("@")[1];
  if (disposableDomains.includes(domain)) throw new Error(DISPOSABLE_EMAIL);
  const potentialMatches = wildcardDomains.filter(w => domain.includes(w));
  potentialMatches.forEach(
    d => (isDisposable = isDisposable || isMatch(email, `*.${d}`))
  );
  if (isDisposable) throw new Error(DISPOSABLE_EMAIL);
  return;
};

sendMail({
  from: EMAIL_FROM,
  to: TEST_EMAIL,
  subject: "Test from Staart",
  message: `This is an example email to test your Staart email configuration.\n\n${JSON.stringify(
    {
      time: systemInfo.time(),
      package: {
        name: pkg.name,
        version: pkg.version,
        repository: pkg.repository,
        author: pkg.author,
        "staart-version": pkg["staart-version"]
      }
    }
  )}`
})
  .then(() => {})
  .catch(() =>
    logError("Invalid email config", "Could not send a test email", 1)
  );
