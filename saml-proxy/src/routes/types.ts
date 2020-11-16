import { Request } from "express";
import { PassportStatic, Strategy } from "passport";
import NodeCache from "node-cache";

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
  set(Key: any, Value: any): boolean;
  get(Key: any): any;
  has(Key: any): boolean;
}

export class Cache implements ICache {
  theCache: NodeCache;

  set(Key: any, Value: any): boolean {
    return this.theCache.set(Key, Value);
  }
  get(Key: any) {
    return this.theCache.get(Key);
  }
  has(Key: any): boolean {
    return this.theCache.has(Key);
  }
  constructor() {
    this.theCache = new NodeCache();
  }
}
