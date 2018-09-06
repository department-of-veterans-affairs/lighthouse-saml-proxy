export function getPath(path) {
  return path.startsWith('/') ? path : '/' + path;
}

export function getReqUrl(req, path) {
  return `${(req.get('x-forwarded-proto') || req.protocol)}://${(req.get('x-forwarded-host') || req.get('host'))}${getPath(path || req.originalUrl)}`;
};

export function removeHeaders(cert) {
  const pem = /-----BEGIN (\w*)-----([^-]*)-----END (\w*)-----/g.exec(cert);
  if (pem && pem.length > 0) {
    return pem[2].replace(/[\n|\r\n]/g, '');
  }
  return cert;
};
