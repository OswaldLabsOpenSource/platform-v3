import connectionClass from "http-aws-es";
import AWS from "aws-sdk";
import { Client } from "elasticsearch";
import {
  AWS_ELASTIC_ACCESS_KEY,
  AWS_ELASTIC_SECRET_KEY,
  AWS_ELASTIC_REGION,
  AWS_ELASTIC_HOST,
  ELASTIC_INSTANCES_INDEX,
  ELASTIC_HOST,
  ELASTIC_LOG,
  ELASTIC_API_VERSION
} from "../config";
import { RESOURCE_NOT_FOUND } from "@staart/errors";
import { logError } from "./errors";
import systemInfo from "systeminformation";
import pkg from "../../package.json";

if (AWS_ELASTIC_ACCESS_KEY && AWS_ELASTIC_SECRET_KEY)
  AWS.config.update({
    credentials: new AWS.Credentials(
      AWS_ELASTIC_ACCESS_KEY,
      AWS_ELASTIC_SECRET_KEY
    ),
    region: AWS_ELASTIC_REGION
  });

export const elasticSearch =
  AWS_ELASTIC_ACCESS_KEY && AWS_ELASTIC_SECRET_KEY && AWS_ELASTIC_HOST
    ? new Client({
        host: AWS_ELASTIC_HOST,
        connectionClass
      })
    : new Client({
        host: ELASTIC_HOST,
        log: ELASTIC_LOG,
        apiVersion: ELASTIC_API_VERSION
      });

const getSystemInformation = async () => {
  return {
    system: await systemInfo.system(),
    time: systemInfo.time(),
    cpu: await systemInfo.cpu(),
    osInfo: await systemInfo.osInfo(),
    package: {
      name: pkg.name,
      version: pkg.version,
      repository: pkg.repository,
      author: pkg.author,
      "staart-version": pkg["staart-version"]
    }
  };
};

getSystemInformation()
  .then(body =>
    elasticSearch.index({
      index: ELASTIC_INSTANCES_INDEX,
      body,
      type: "log"
    })
  )
  .then(() => console.log("System record added to ElasticSearch"))
  .catch(error => {
    logError(
      "ElasticSearch configuration error",
      "Unable to log system event",
      1
    );
    console.log(error);
  });

export const cleanElasticSearchQueryResponse = (
  response: any,
  size: number
) => {
  if (response.hits && response.hits.hits) {
    const count = response.hits.total;
    const data = response.hits.hits;
    const newResponse: any = {
      data,
      count
    };
    if (count > data.length && data.length === size) {
      newResponse.hasMore = true;
    } else {
      newResponse.hasMore = false;
    }
    return newResponse;
  }
  throw new Error(RESOURCE_NOT_FOUND);
};

/**
 * Get an API key
 */
export const getLogMonthCount = async (index: string) => {
  try {
    const result = await elasticSearch.search({
      index,
      body: {
        query: {
          bool: {
            must: [
              {
                range: {
                  date: {
                    gte: new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1
                    )
                  }
                }
              }
            ]
          }
        },
        size: 0
      }
    });
    return cleanElasticSearchQueryResponse(result, 0);
  } catch (error) {
    return {
      data: [],
      hasMore: false,
      count: 0
    };
  }
};
