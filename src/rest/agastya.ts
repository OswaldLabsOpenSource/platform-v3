import { KeyValue, Locals } from "../interfaces/general";
import { shortKeys } from "../helpers/data";
import pkg from "../../package.json";
import md5 from "md5";
import { Request } from "express";
import WhichBrowser from "which-browser";
import { isEuMember } from "is-eu-member";
import parseDomain from "parse-domain";
import cryptoRandomString from "crypto-random-string";
import { getGeolocationFromIp } from "../helpers/location";
import { IncomingHttpHeaders } from "http";
const INVALID_DOMAIN = "400/invalid-domain";
import { getAgastyaApiKeyFromSlug } from "../crud/organization";
import { includesDomainInCommaList } from "../helpers/utils";
import { elasticSearch } from "../helpers/elasticsearch";
import ms from "ms";

export const agastyaConfigResponse = async (
  apiKey: string,
  req: Request,
  domain?: string
) => {
  const apiKeyDetails = await getAgastyaApiKeyFromSlug(apiKey);
  const allowedDomains = apiKeyDetails.domains;
  let allowed = true;
  if (allowedDomains && domain) {
    if (!includesDomainInCommaList(allowedDomains, domain)) allowed = false;
  }
  if (!allowed) throw new Error(INVALID_DOMAIN);
  const ipCountry = (req.get("Cf-Ipcountry") || "").toLowerCase();
  // Delete EU cookie law integration if country is not an EU member
  if (
    typeof apiKeyDetails.integrations === "object" &&
    !isEuMember(ipCountry)
  ) {
    delete apiKeyDetails.integrations["eu-cookie-law"];
  }
  const result = {
    ...apiKeyDetails,
    requestUserInfo: {
      ipCountry,
      isEuCountry: !!isEuMember(ipCountry),
      sessionId: cryptoRandomString({ length: 20, type: "hex" })
    }
  };
  return result;
};

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
    data.event = data.event || "";
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

  // URL params
  if (data.url) data.cleanUrl = data.url.split("?")[0].split("#")[0];

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
    data.browser_name = data.browser_name || userAgent.browser.name;
    data.browser_subversion =
      data.browser_subversion || userAgent.browser.version.value;
    data.browser_stock = data.browser_stock || userAgent.browser.stock;
    data.os_name = data.os_name || userAgent.os.name;
    data.os_subversion = data.os_subversion || userAgent.os.version.value;
    data.browser_engine = data.browser_engine || userAgent.engine.name;
    data.device_manufacturer =
      data.device_manufacturer || userAgent.device.manufacturer;
    data.device_model = data.device_model || userAgent.device.model;
    data.device_type = data.device_type || userAgent.device.type;
    data.device_subtype = data.device_subtype || userAgent.device.subtype;
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
  data.user_fp = data.user_fp || md5(data.ua_fp + data.ip);
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

  // Clean responses
  if (data.city && data.country_code)
    data.city = `${data.country_code}_${data.city}`;
  if (data.zip_code && data.country_code)
    data.zip_code = `${data.country_code}_${data.zip_code}`;
  if (data.region_name && data.country_code)
    data.region_name = `${data.country_code}_${data.region_name}`;
  if (data.device_model && data.device_manufacturer)
    data.device_model = `${data.device_manufacturer}_${data.device_model}`;

  // Store in ElasticSearch
  await elasticSearch.index({
    index: `agastya-${apiKey}`,
    body: data,
    type: "collect"
  });

  return {
    status: "success",
    response: data,
    constants: {
      eu_laws: !!isEuMember(data.country_code || "")
    }
  };
};

export const getGdprData = async (locals: Locals): Promise<any> => {
  const ipAddress = locals.ipAddress;
  if (!ipAddress) return [];
  const userAgent = new WhichBrowser(locals.userAgent);
  const ua_fp = md5(userAgent.toString());
  const user_fp = md5(ua_fp + ipAddress);
  const range = "30d";
  const size = 1000;
  const result = await elasticSearch.search({
    index: "agastya-*",
    body: {
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: new Date(new Date().getTime() - ms(range))
                }
              }
            },
            {
              match: {
                user_fp
              }
            }
          ]
        }
      },
      sort: [
        {
          date: { order: "desc" }
        }
      ],
      size
    }
  });
  return result;
};

export const deleteGdprData = async (locals: Locals): Promise<any> => {
  const ipAddress = locals.ipAddress;
  if (!ipAddress) return [];
  const userAgent = new WhichBrowser(locals.userAgent);
  const ua_fp = md5(userAgent.toString());
  const user_fp = md5(ua_fp + ipAddress);
  const range = "30d";
  const result = await elasticSearch.updateByQuery({
    index: "agastya-*",
    type: "log",
    body: {
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: new Date(new Date().getTime() - ms(range))
                }
              }
            },
            {
              match: {
                user_fp
              }
            }
          ]
        }
      },
      script: { inline: "ctx._source.user_fp = 'redacted-as-per-gdpr-request'" }
    }
  });
  return result;
};
