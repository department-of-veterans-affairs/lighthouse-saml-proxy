import { Request } from "express";
import { Strategy } from "passport";

import { MpiUserClient } from "../MpiUserClient";
import { VsoClient } from "../VsoClient";
import { User } from "@sentry/types";

interface IExtendedStrategy extends Strategy {
  options: any;
}

export interface IConfiguredRequest extends Request {
  session: any;
  mpiUserClient: MpiUserClient;
  vsoClient: VsoClient;
  strategies: Map<String, IExtendedStrategy>;
  sps: any;
  idp: any;
  user: User;
  requestAcsUrl: string;
  options: any;
}
