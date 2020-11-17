import { Request } from "express";
import { PassportStatic, Strategy } from "passport";
import Redis, { RedisClient } from "redis";
import NodeCache = require("../../node_modules/node-cache");

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
  set(Key: any, Value: any): Promise<boolean>;
  get(Key: any): Promise<any>;
  has(Key: any): Promise<boolean>;
}

export class RedisCache implements ICache {
  theCache: RedisClient;

  set(Key: any, Value: any): Promise<boolean> {
    return new Promise((resolve, reject)=>{this.theCache.set(Key, Value)});
  }
  get(Key: any): Promise<any> {
    return new Promise((resolve, reject)=>{this.theCache.get(Key)});
  }
  has(Key: any): Promise<boolean> {
    return new Promise((resolve, reject)=>{resolve(this.theCache.get(Key))}).
    then((value)=>{return value === undefined;});
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

  set(Key: any, Value: any): Promise<boolean> {
    return new Promise((resolve, reject)=>{return this.theCache.set(Key, Value)});
  }
  get(Key: any):Promise<any> {
    return new Promise((resolve, reject)=>{return this.theCache.get(Key)});
  }
  has(Key: any): Promise<boolean> {
    return new Promise((resolve, reject)=>{return resolve(this.theCache.has(Key))});
  }
  constructor() {
    this.theCache = new NodeCache();
  }
}
