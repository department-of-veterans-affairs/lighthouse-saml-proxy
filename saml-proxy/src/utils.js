export function getPath(path) {
  return path.startsWith("/") ? path : "/" + path;
}

export function getReqUrl(req, path) {
  if (req.get("host") === "localhost:7000") {
    return `http://${req.get("x-forwarded-host") || req.get("host")}${getPath(
      path || req.originalUrl
    )}`;
  } else {
    return `https://${req.get("x-forwarded-host") || req.get("host")}${getPath(
      path || req.originalUrl
    )}`;
  }
}

export function removeHeaders(cert) {
  const pem = /-----BEGIN (\w*)-----([^-]*)-----END (\w*)-----/g.exec(cert);
  if (pem && pem.length > 0) {
    return pem[2].replace(/[\n|\r\n]/g, "");
  }
  return cert;
}

export function logRelayState(req, logger, step) {
  const relayStateBody = req.body.RelayState;
  const relayStateQuery = req.query.RelayState;
  logger.info(
    `Relay state ${step} - body: ${relayStateBody} query: ${relayStateQuery}`,
    {
      time: new Date().toISOString(),
      relayStateBody,
      relayStateQuery,
      step: step,
      session: req.sessionID,
    }
  );
}
