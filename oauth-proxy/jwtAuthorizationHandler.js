const jwtDecode = require("jwt-decode");
const { parseBearerAuthorization } = require("./utils");

/*
 * Request handler for JWT authorization.
 */
const jwtAuthorizationHandler = (req, res, next) => {
  const jwt = parseBearerAuthorization(req.headers.authorization);

  if (!jwt) {
    return res.sendStatus(401);
  }

  try {
    jwtDecode(jwt);
  } catch (err) {
    return res.sendStatus(401);
  }

  res.locals.jwt = jwt;

  return next();
};

module.exports = { jwtAuthorizationHandler: jwtAuthorizationHandler };
