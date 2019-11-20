import client from 'prom-client';

const defaultLabels = { app: 'saml_proxy' };
client.register.setDefaultLabels(defaultLabels);
// Default buckets are [.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10]. There are too many buckets
// on the low end and the max bucket is too high as well. Anything above 5 is too high. To help focus
// the histogram on latencies we care about we only use a subset of the default
const latencyBucketsSecs = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
const bucketLabels = ['status_code'];

export const MVILookupBucket = new client.Histogram({
  name: 'mvi_lookup_requset_duration_seconds_bucket',
  help: 'durtation histogram of duration of MVI lookup requests labeled with: app, status_code',
  buckets: latencyBucketsSecs,
  labelNames: bucketLabels,
});

export const MVIAttempt = new client.Counter({
  name: 'mvi_lookup_attempt',
  help: 'counter of number of lookup requests sent to MVI',
});

export const MVIFailure = new client.Counter({
  name: 'mvi_lookup_failure',
  help: 'counter of number of lookup request failures from MVI',
});

export const VSOLookupBucket = new client.Histogram({
  name: 'vso_lookup_requset_duration_seconds_bucket',
  help: 'durtation histogram of duration of VSO lookup requests labeled with: app, status_code',
  buckets: latencyBucketsSecs,
  labelNames: bucketLabels,
});

export const VSOAttempt = new client.Counter({
  name: 'vso_lookup_attempt',
  help: 'counter of number of lookup requests sent to VSO',
});

export const VSOFailure = new client.Counter({
  name: 'vso_lookup_failure',
  help: 'counter of number of lookup request failures from VSO',
});

export async function requestWithMetrics(histogram: client.Histogram, attempt: client.Counter, failure: client.Counter, promiseFunc: () => Promise<any>) {
  const timer = histogram.startTimer();
  attempt.inc();
  try {
    var res = await promiseFunc();
    timer({status_code: '200'});
    return res;
  } catch(err) {
    failure.inc();
    timer({status_code: err.statusCode || 'unknown'});
    throw err;
  }
}
