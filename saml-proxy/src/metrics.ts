import client from "prom-client";

const defaultLabels = { app: "saml_proxy" };
client.register.setDefaultLabels(defaultLabels);
// Default buckets are [.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10]. There are too many buckets
// on the low end and the max bucket is too high as well. Anything above 5 is too high. To help focus
// the histogram on latencies we care about we only use a subset of the default
const latencyBucketsSecs = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
const bucketLabels = ["status_code"];

const MVILookupBucket = new client.Histogram({
  name: "mvi_lookup_request_duration_seconds",
  help:
    "histogram of duration of MVI lookup requests labeled with: app, status_code",
  buckets: latencyBucketsSecs,
  labelNames: bucketLabels,
});

const MVIAttempt = new client.Counter({
  name: "mvi_lookup_attempt",
  help: "counter of number of lookup requests sent to MVI",
});

const MVIFailure = new client.Counter({
  name: "mvi_lookup_failure",
  help: "counter of number of lookup request failures from MVI",
});

const VSOLookupBucket = new client.Histogram({
  name: "vso_lookup_request_duration_seconds",
  help:
    "histogram of duration of VSO lookup requests labeled with: app, status_code",
  buckets: latencyBucketsSecs,
  labelNames: bucketLabels,
});

const VSOAttempt = new client.Counter({
  name: "vso_lookup_attempt",
  help: "counter of number of lookup requests sent to VSO",
});

const VSOFailure = new client.Counter({
  name: "vso_lookup_failure",
  help: "counter of number of lookup request failures from VSO",
});

export const MVIRequestMetrics = {
  histogram: MVILookupBucket,
  attempt: MVIAttempt,
  failure: MVIFailure,
};

export const VSORequestMetrics = {
  histogram: VSOLookupBucket,
  attempt: VSOAttempt,
  failure: MVIFailure,
};

export interface IRequestMetrics {
  histogram: client.Histogram;
  attempt: client.Counter;
  failure: client.Counter;
}
