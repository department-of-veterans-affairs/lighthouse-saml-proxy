import { Request } from "express";
import { PassportStatic, Strategy } from "passport";
import Redis, { RedisClient } from "redis";
import NodeCache = require("../../node_modules/node-cache");
import { promisify } from "util";

import { VetsAPIClient } from "../VetsAPIClient";

interface IExtendedStrategy extends Strategy {
  options: any;
}

export interface IConfiguredRequest extends Request {
  session: any;
  vetsAPIClient: VetsAPIClient;
  passport: PassportStatic;
  strategy: IExtendedStrategy;
  sp: any;
  idp: any;
}

/**
 * The cache interface that our saml proxy will rely on in the handler code.
 */
export interface ICache {
  set(Key: string, Value: string): Promise<unknown>;
  get(Key: any): Promise<any>;
  has(Key: any): Promise<boolean>;
}

export class RedisCache implements ICache {
  theCache: RedisClient;

  set(Key: string, Value: string): Promise<unknown> {
    const setAsync = promisify(this.theCache.set).bind(this.theCache);
    return setAsync(Key, Value);
  }
  get(Key: any): Promise<any> {
    const getAsync = promisify(this.theCache.get).bind(this.theCache);
    return getAsync(Key);
  }
  has(Key: any): Promise<any> {
    const getAsync = promisify(this.theCache.get).bind(this.theCache);
    return getAsync(Key);
  }
  constructor() {
    this.theCache = Redis.createClient();
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
    })
  }
  get(Key: any): Promise<any> {
    return new Promise((resolve) => {
      let val = this.theCache.get(Key);
      resolve(val);
    })
  }
  has(Key: any): Promise<any> {
    return new Promise((resolve) => {
      let val = this.theCache.has(Key);
      resolve(val);
    })
  }
  constructor() {
    this.theCache = new NodeCache();
  }
}
