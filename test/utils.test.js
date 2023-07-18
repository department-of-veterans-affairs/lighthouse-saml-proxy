require("jest");

import {
  getReqUrl,
  removeHeaders,
  sassMiddleware,
  accessiblePhoneNumber,
  sanitize
} from "../src/utils";
import { defaultMockRequest } from "./testUtils";
import { idpCert } from "./testCerts";
import path from "path";
import util from "util";

let sMiddlewareMockLog;
let sMiddleware;

function setupSassMiddleware() {
  sMiddlewareMockLog = jest.fn();
  const result = { css: "{}", stats: { includedFiles: "placeholder" } };
  const mockSass = {
    renderSync: function () {
      return result;
    },
  };
  const importer = function () {};

  const src = "placeholder.scss";
  const dest = path.join(process.cwd(), "test", "test.css");

  sMiddleware = sassMiddleware({
    src: src,
    dest: dest,
    log: sMiddlewareMockLog,
    sass: mockSass,
    importer: importer,
  });
}

describe("tests for utils.js", () => {
  test("tests for removeHeaders", () => {
    let cert = removeHeaders(idpCert);
    const expectedCert =
      "MIIDuzCCAqOgAwIBAgIUHOMabPdUAltQPOSGkmXa7wVGEZQwDQYJKoZIhvcNAQELBQAwbTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xEDAOBgNVBAoMB0phbmt5Q28xHzAdBgNVBAMMFlRlc3QgSWRlbnRpdHkgUHJvdmlkZXIwHhcNMjAwMTA3MTY0ODEyWhcNNDAwMTAyMTY0ODEyWjBtMQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzEQMA4GA1UECgwHSmFua3lDbzEfMB0GA1UEAwwWVGVzdCBJZGVudGl0eSBQcm92aWRlcjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMrac33GLykOs6ThReh3op/LwrNx+8CsUJXFfn4t0NYAcq2ZgR5qFz00Sn5IO/OO2qteITyFkBFICX8PVyJxlXrf8eQ4qJ6OKaN4g2sWqs2wU9W/Y5DE4yuU22Uuw6NRVM0cs7D8+/qAz3dC7SOi7wlEojHm0na/LSypYi0WQH2Phb1Eh73j4Tdi60wURgnMF4RbUynUxJCuG4MBmOGCy0kW2n/ZEixGiHMYO6qfcR5XtXSuSejHvSPLS39N40Fl0Z88rIfe664ycd2Ih8SB3qP74d1gCADknUCyydhZuggr5DJG0/3N4jaGgYBsLmUq1T7yZDqY9F/mq22jn7TQWUUCAwEAAaNTMFEwHQYDVR0OBBYEFE8LUpzxF/SDx7w6V62o/HPaNnvMMB8GA1UdIwQYMBaAFE8LUpzxF/SDx7w6V62o/HPaNnvMMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAEUMISb1wLsowsrAsSWbQvUEn4sAGWF4QJl8SSzLudW57P868/NgHXZ10H2Hcc1nCFSZx7Oq620T8yi9QEEn0c4CoAIiituokpWSsAL2/WwD2MTX8SoUvYo2JJFGWvGAbI4o3APnJ0X+r6g6Vsm2i5L0PVNJ1aUid/hLoat1ITLpGqQCbhdan3B6D+6PE4IbNBHCimcTREuBYtk2NOcUC0ftBFrv8pOf1WEI+GoPuS1peIM0oQmduoqTM0o3H/OgzesQNDmLrHdY2+1AxhBhySUWi9c0Wt+LjX0t3Rh67byTEd83OSJB+qXGcR4W96+psF+UlJRViui5vY1Y+JPCRDM=";
    expect(cert).toBe(expectedCert);
    cert = removeHeaders(cert);
    expect(cert).toBe(expectedCert);
  });

  test("tests sassMiddleware skipping", () => {
    setupSassMiddleware();
    const middleware = util.promisify(sMiddleware);

    return middleware({ path: "/file.png" }, undefined).then(() => {
      expect(sMiddlewareMockLog).toHaveBeenCalledWith("skipping non-css path");
    });
  });

  test("tests sassMiddleware rendering", () => {
    setupSassMiddleware();
    const middleware = util.promisify(sMiddleware);

    return middleware({ path: "/file.css" }, undefined).then(() => {
      expect(sMiddlewareMockLog).toHaveBeenCalledWith("rendering css");
      expect(sMiddlewareMockLog).toHaveBeenCalledWith("writing to file");
      expect(sMiddlewareMockLog).toHaveBeenCalledWith("caching src");
    });
  });

  test("tests sassMiddleware caching", () => {
    setupSassMiddleware();
    const middleware = util.promisify(sMiddleware);

    return middleware({ path: "/file.css" }, undefined).then(() => {
      expect(sMiddlewareMockLog).toHaveBeenCalledWith("css already rendered");
    });
  });

  test("tests accessiblePhoneNumber", () => {
    const numberString = "1-844-698-2311";
    const result = accessiblePhoneNumber(numberString);
    expect(result).toBe(
      '<a href="tel:18446982311" aria-label=" 1. 8 4 4. 6 9 8. 2 3 1 1.">1-844-698-2311</a>'
    );
  });

  test("tests for getReqUrl", () => {
    let req = defaultMockRequest;
    let result = getReqUrl(req, "test/path/1");
    expect(result).toBe("https://fowarded.example.com/test/path/1");
    req.host = "localhost:7000";
    req.x_fowarded_host = undefined;
    result = getReqUrl(req, "test/path/1");
    expect(result).toBe("http://localhost:7000/test/path/1");
  });

  test('tests removing newlines and carriage returns from the message', () => {
    const message = 'Hello,\nWorld!\r';
    const sanitizedMessage = sanitize(message);
    expect(sanitizedMessage).toBe('Hello,World!');
  });

  test('tests should return an empty string when message is null', () => {
    const message = null;
    const sanitizedMessage = sanitize(message);
    expect(sanitizedMessage).toBe('');
  });

  test('tests should return an empty string when message is undefined', () => {
    const message = undefined;
    const sanitizedMessage = sanitize(message);
    expect(sanitizedMessage).toBe('');
  });
});
