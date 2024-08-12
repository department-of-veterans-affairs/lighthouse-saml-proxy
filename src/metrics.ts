const COUNT_MVI_LOOKUP_ATTEMPT = "mvi_lookup_attempt";
const COUNT_MVI_LOOKUP_FAILURE = "mvi_lookup_failure";
const COUNT_VSO_LOOKUP_ATTEMPT = "vso_lookup_attempt";
const COUNT_VSO_LOOKUP_FAILURE = "vso_lookup_failure";
const COUNT_LOGIN_IDME = "id_me_login";
const COUNT_LOGIN_LOGINGOV = "login_gov_login";
const COUNT_LOGIN_DSLOGON = "ds_logon_login";
const COUNT_LOGIN_MHV = "my_healthe_vet_login";

/**
 *
 * @param {*} msg a message to log
 */
function logger(msg: string): void {
  console.info(msg);
}

class Timer {
  start_int: bigint | undefined;
  label: string;
  constructor(label: string) {
    this.label = label;
  }
  start(): void {
    this.start_int = process.hrtime.bigint();
  }
  stop(): void {
    if (!this.start_int) return;
    const end = process.hrtime.bigint();
    logger(this.label + ": " + Number(end - this.start_int) / 1000000000);
  }
}

const MVITimer = new Timer("mvi_lookup_gauge");

const VSOTimer = new Timer("vso_lookup_gauge");

const MVIAttempt = function () {
  logger(COUNT_MVI_LOOKUP_ATTEMPT);
};

const MVIFailure = function () {
  logger(COUNT_MVI_LOOKUP_FAILURE);
};

const VSOAttempt = function () {
  logger(COUNT_VSO_LOOKUP_ATTEMPT);
};

const VSOFailure = function () {
  logger(COUNT_VSO_LOOKUP_FAILURE);
};

class IdpCounter {
  idme(): void {
    logger(COUNT_LOGIN_IDME);
  }
  logingov(): void {
    logger(COUNT_LOGIN_LOGINGOV);
  }
  dslogon(): void {
    logger(COUNT_LOGIN_DSLOGON);
  }
  mhv(): void {
    logger(COUNT_LOGIN_MHV);
  }
}

export const IdpLoginCounter = new IdpCounter();

export const MVIRequestMetrics = {
  timer: MVITimer,
  attempt: MVIAttempt,
  failure: MVIFailure,
};

export const VSORequestMetrics = {
  timer: VSOTimer,
  attempt: VSOAttempt,
  failure: VSOFailure,
};

export interface IRequestMetrics {
  timer: Timer;
  attempt: () => void;
  failure: () => void;
}
