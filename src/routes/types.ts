import { Request } from "express";
import { Strategy } from "passport";
import Redis, { RedisClient } from "redis";
import NodeCache = require("../../node_modules/node-cache");
import { promisify } from "util";

import { MpiUserClient } from "../MpiUserClient";
import { VsoClient } from "../VsoClient";
import { User } from "@sentry/types";

interface IExtendedStrategy extends Strategy {
  options: any;
}

export interface IConfiguredRequest extends Request {
  mpiUserClient: MpiUserClient;
  vsoClient: VsoClient;
  strategies: Map<String, IExtendedStrategy>;
  sps: any;
  idp: any;
  user: User;
  requestAcsUrl: string;
  authnRequest: any;
}

/**
 * The cache interface that our saml proxy will rely on in the handler code.
 */
export interface ICache {
  set(
    Key: string,
    Value: string,
    Option?: string,
    OptionValue?: number
  ): Promise<unknown>;
  get(Key: any): Promise<any>;
  has(Key: any): Promise<boolean>;
  delete(Key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

/**
 * Implementation of ICache via Redis caching library.
 */
export class RedisCache implements ICache {
  theCache: RedisClient;

  set(
    Key: string,
    Value: string,
    Option?: string,
    OptionValue?: number
  ): Promise<unknown> {
    if (Option && OptionValue) {
      const setAsync = <
        (key: string, Value: string, mode: string, duration: number) => any
      >promisify(this.theCache.set).bind(this.theCache);
      return setAsync(Key, Value, Option, OptionValue);
    }
    const setAsync = promisify(this.theCache.set).bind(this.theCache);
    return setAsync(Key, Value);
  }
  get(Key: any): Promise<any> {
    const getAsync = promisify(this.theCache.get).bind(this.theCache);
    return getAsync(Key);
  }
  async has(Key: any): Promise<any> {
    const getAsync = promisify(this.theCache.get).bind(this.theCache);
    const val = await getAsync(Key);
    return val != null;
  }
  async delete(Key: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.theCache.del(Key, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
  async keys(pattern: string): Promise<string[]> {
    const keysAsync = promisify(this.theCache.keys).bind(this.theCache);
    try {
      const keys = await keysAsync(pattern);
      return keys;
    } catch (error) {
      console.error("Error fetching keys from Redis:", error);
      return [];
    }
  }
  constructor(redisPort: number, redisHost: string) {
    this.theCache = Redis.createClient(redisPort, redisHost);
  }
}

/**
 * This cache is used for testing purposes so we dont have to run and
 * connect to redis when unit testing.
 */
export class TestCache implements ICache {
  theCache: NodeCache;

  set(Key: string, Value: string): Promise<unknown> {
    return new Promise((resolve) => {
      this.theCache.set(Key, Value);
      resolve(false);
    });
  }
  get(Key: any): Promise<any> {
    return new Promise((resolve) => {
      const val = this.theCache.get(Key);
      resolve(val);
    });
  }
  has(Key: any): Promise<any> {
    return new Promise((resolve) => {
      const val = this.theCache.has(Key);
      resolve(val);
    });
  }
  delete(Key: string): Promise<void> {
    return new Promise((resolve) => {
      this.theCache.del(Key);
      resolve();
    });
  }
  keys(pattern: string): Promise<string[]> {
    return new Promise<string[]>((resolve) => {
      const allKeys = this.theCache.keys();
      if (!pattern) {
        resolve(allKeys);
        return;
      }
      const filteredKeys = allKeys.filter((key) => key.startsWith(pattern));
      resolve(filteredKeys);
    });
  }
  constructor() {
    this.theCache = new NodeCache();
  }
}
