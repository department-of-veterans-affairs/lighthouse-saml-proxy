import { Request } from "express";
import { PassportStatic, Strategy } from "passport";

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
