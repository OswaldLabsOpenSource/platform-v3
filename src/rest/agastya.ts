import { KeyValue, Locals } from "../interfaces/general";
import { shortKeys } from "../helpers/data";
import pkg from "../../package.json";
import md5 from "md5";
import WhichBrowser from "which-browser";
import { isEuMember } from "is-eu-member";
import parseDomain from "parse-domain";
import cryptoRandomString from "crypto-random-string";
import { getGeolocationFromIp } from "../helpers/location";
import { IncomingHttpHeaders } from "http";
import AWS from "aws-sdk";
import { Client } from "elasticsearch";
import {
  AWS_ELASTIC_ACCESS_KEY,
  AWS_ELASTIC_SECRET_KEY,
  AWS_ELASTIC_HOST,
  SENTRY_DSN
} from "../config";
import connectionClass from "http-aws-es";
import { init, captureException } from "@sentry/node";
init({ dsn: SENTRY_DSN });

AWS.config.update({
  credentials: new AWS.Credentials(
    AWS_ELASTIC_ACCESS_KEY,
    AWS_ELASTIC_SECRET_KEY
  ),
  region: "eu-west-3"
});
const client = new Client({
  host: AWS_ELASTIC_HOST,
  connectionClass
});

export const collect = async (
  apiKey: string,
  data: KeyValue,
  locals: Locals,
  headers?: IncomingHttpHeaders
) => {
  // Support for short keys
  for (let shortKey in shortKeys) {
    if (typeof data[shortKey] !== "undefined") {
      data[shortKeys[shortKey]] = data[shortKey];
      delete data[shortKey];
    }
  }

  // Support for encoded values
  if (data.isEncoded)
    for (let key in data) if (key !== "isEncoded") data[key] = atob(data[key]);

  // Set globals
  const currentDate = new Date();
  data.date = currentDate.toISOString();
  data.client = `${pkg.name}-${pkg.version}`;
  data.ip = md5(locals.ipAddress);
  data.session_id =
    data.session_id || cryptoRandomString({ length: 20, type: "hex" });
  if (typeof data.event === "object") {
    data.event = data.event || {};
  } else {
    data.event = data.event || "pageview";
  }

  // Set referer
  if (typeof data.referrer === "string") {
    const refDetails = parseDomain(data.referrer);
    if (refDetails && typeof refDetails === "object") {
      if (refDetails.domain) data.referrer_name = refDetails.domain;
      if (refDetails.tld && refDetails.domain)
        data.referrer_domain = `${refDetails.domain}.${refDetails.tld}`;
    } else {
      data.referrer_name = "unknown";
      data.referrer_domain = "unknown";
    }
  }

  // Set domain
  if (typeof data.url === "string") {
    const urlDetails = parseDomain(data.url);
    if (urlDetails && typeof urlDetails === "object") {
      if (urlDetails.domain) data.url_name = urlDetails.domain;
      if (urlDetails.tld && urlDetails.domain)
        data.url_domain = `${urlDetails.domain}.${urlDetails.tld}`;
    } else {
      data.url_name = "unknown";
      data.url_domain = "unknown";
    }
  }

  // Custom event support
  if (data.event && typeof data.event === "object") {
    Object.keys(data.event).forEach(key => {
      data[`custom_${key}`] = data.event[key];
    });
    delete data.event;
  }

  // Set user agent
  const userAgent = new WhichBrowser(headers || locals.userAgent);
  try {
    data.browser_name = userAgent.browser.name;
    data.browser_subversion = userAgent.browser.version.value;
    data.browser_stock = userAgent.browser.stock;
    data.os_name = userAgent.os.name;
    data.os_subversion = userAgent.os.version.value;
    data.browser_engine = userAgent.engine.name;
    data.device_manufacturer = userAgent.device.manufacturer;
    data.device_model = userAgent.device.model;
    data.device_type = userAgent.device.type;
    data.device_subtype = userAgent.device.subtype;
  } catch (error) {}
  // Keeping error-prone values in a separate try/catch
  try {
    data.browser_version = parseInt(
      userAgent.browser && typeof userAgent.browser.toString === "function"
        ? userAgent.browser
            .toString()
            .replace(data.browser_name, "")
            .replace(/ /g, "")
        : "0"
    );
    data.os_version = parseInt(
      userAgent.os.version.value.toString().split(".")[0]
    );
    if (!data.browser_version && data.browser_subversion)
      data.browser_version = parseInt(data.browser_subversion);
    if (!data.os_version && data.os_subversion)
      data.os_version = parseInt(data.os_subversion);
  } catch (e) {}

  // Add fingerprints
  data.ua_fp = md5(userAgent.toString());
  data.combined_fp = md5(
    data.session_id +
      data.ua_fp +
      new Date().getUTCFullYear() +
      new Date().getUTCMonth()
  );

  // Check domain
  const domain =
    data.url_domain && data.url_domain.startsWith("www.")
      ? data.url_domain.replace("www.", "")
      : null;

  // Geolocation from IP
  const geoLocation = await getGeolocationFromIp(locals.ipAddress);
  if (geoLocation) {
    if (geoLocation.city) data.city = geoLocation.city;
    if (geoLocation.continent) data.continent = geoLocation.continent;
    if (geoLocation.country_code) data.country_code = geoLocation.country_code;
    if (geoLocation.latitude) data.latitude = geoLocation.latitude;
    if (geoLocation.longitude) data.longitude = geoLocation.longitude;
    if (geoLocation.time_zone) data.time_zone = geoLocation.time_zone;
    if (geoLocation.accuracy_radius)
      data.accuracy_radius = geoLocation.accuracy_radius;
    if (geoLocation.zip_code) data.zip_code = geoLocation.zip_code;
    if (geoLocation.region_name) data.region_name = geoLocation.region_name;
  }

  // Store in ElasticSearch
  client
    .index({
      index: `agastya-${apiKey}`,
      body: data,
      type: "collect"
    })
    .then(() => {})
    .catch((error: any) => captureException(error));

  return {
    status: "success",
    response: data,
    constants: {
      eu_laws: !!isEuMember(data.country_code || "")
    }
  };
};
