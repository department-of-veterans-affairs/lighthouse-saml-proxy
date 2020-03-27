function statusCodeFromError(error) {
  if(error.response && error.response.statusCode) {
    return error.response.statusCode;
  }
  return 500;
}

const isRuntimeError = (err) => {
  return (
    (err instanceof EvalError)
    || (err instanceof ReferenceError)
    || (err instanceof RangeError)
    || (err instanceof SyntaxError)
    || (err instanceof TypeError)
  );
};

const rethrowIfRuntimeError = (err) => {
  if (isRuntimeError(err)) {
    throw err;
  }
};

function encodeBasicAuthHeader(username, password) {
  const encodedCredentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${encodedCredentials}`;
}

const BASIC_AUTH_REGEX = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/;
const USER_PASS_REGEX = /^([^:]*):(.*)$/;

function parseBasicAuth(req) {
  if (!req || typeof req !== 'object') {
    return undefined;
  }

  if (!req.headers || typeof req.headers !== 'object') {
    return undefined;
  }

  if (typeof req.headers.authorization !== 'string') {
    return undefined;
  }

  const match = BASIC_AUTH_REGEX.exec(req.headers.authorization);
  if (!match) {
    return undefined;
  }

  const userPass = USER_PASS_REGEX.exec(Buffer.from(match[1], 'base64').toString('utf-8'));
  if (!userPass) {
    return undefined;
  }

  return new Credentials(userPass[1], userPass[2]);
}

function Credentials(username, password) {
  this.username = username;
  this.password = password;
}

module.exports = {
  isRuntimeError,
  rethrowIfRuntimeError,
  statusCodeFromError,
  encodeBasicAuthHeader,
  parseBasicAuth
};
