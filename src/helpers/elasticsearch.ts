import { Client } from "@elastic/elasticsearch";
import { ELASTIC_INSTANCES_INDEX, ELASTIC_HOST } from "../config";
import { RESOURCE_NOT_FOUND } from "@staart/errors";
import { success } from "signale";
import { logError } from "./errors";
import systemInfo from "systeminformation";
import pkg from "../../package.json";
import { AmazonConnection } from "aws-elasticsearch-connector";

import AWS from "aws-sdk";
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

/**
 * Client doesn't support the "awsConfig" property,
 * which is part of "aws-elasticsearch-connector"
 */
export const elasticSearch = new (Client as any)({
  node: ELASTIC_HOST,
  Connection: AmazonConnection,
  awsConfig: {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
    }
  }
}) as Client;
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
      body
    })
  )
  .then(() => success("System record added to ElasticSearch"))
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
  console.log("Response", response);
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
