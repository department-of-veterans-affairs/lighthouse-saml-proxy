'use strict';

// Generates objects that can be used to start and stop a server hosting an
// express app. Returns an object with two fields:
//   startServerInBackground: (app) => void
//   stopBackgroundServer: () => void
function buildBackgroundServerModule(name) {
  let serverRef;
  return {
    startServerInBackground: (app, port) => {
      (async () => {
        if (!!serverRef) {
          throw new Error(`The ${name} server is already running.`);
        }
        serverRef = app.listen(port);
      })();
    },
    stopBackgroundServer: () => {
      if (!serverRef) {
        throw new Error(`The ${name} server is not running.`);
      }
      serverRef.close();
    }
  };
};

module.exports = {
  buildBackgroundServerModule
};
