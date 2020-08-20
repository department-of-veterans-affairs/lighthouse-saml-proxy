const httpAdapter = require("axios/lib/adapters/http");
const NodeCache = require("node-cache");
const myCache = new NodeCache({ useClones: false, stdTTL: 3600 });

const axiosCachingAdapter = (config) => {
  let response = myCache.get(config.url);
  if (response == undefined) {
    return httpRequestAdapter(config);
  }

  return new Promise((resolve) => resolve(response));
};

const httpRequestAdapter = (config) => {
  return new Promise((resolve, reject) => {
    httpAdapter(config)
      .then((res) => {
        myCache.set(config.url, res);
        resolve(res);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

module.exports = { axiosCachingAdapter };
