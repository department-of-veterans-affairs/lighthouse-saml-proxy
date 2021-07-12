require("jest");

import { getReqUrl, removeHeaders, sassMiddleware } from "../src/utils";
import { idpCert } from "./testCerts";
import path from "path";
import util from "util";

describe("Tests for utils.js", () => {
  test("Test for removeHeaders", () => {
    let cert = removeHeaders(idpCert);
    const expectedCert =
      "MIIDuzCCAqOgAwIBAgIUHOMabPdUAltQPOSGkmXa7wVGEZQwDQYJKoZIhvcNAQELBQAwbTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xEDAOBgNVBAoMB0phbmt5Q28xHzAdBgNVBAMMFlRlc3QgSWRlbnRpdHkgUHJvdmlkZXIwHhcNMjAwMTA3MTY0ODEyWhcNNDAwMTAyMTY0ODEyWjBtMQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzEQMA4GA1UECgwHSmFua3lDbzEfMB0GA1UEAwwWVGVzdCBJZGVudGl0eSBQcm92aWRlcjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMrac33GLykOs6ThReh3op/LwrNx+8CsUJXFfn4t0NYAcq2ZgR5qFz00Sn5IO/OO2qteITyFkBFICX8PVyJxlXrf8eQ4qJ6OKaN4g2sWqs2wU9W/Y5DE4yuU22Uuw6NRVM0cs7D8+/qAz3dC7SOi7wlEojHm0na/LSypYi0WQH2Phb1Eh73j4Tdi60wURgnMF4RbUynUxJCuG4MBmOGCy0kW2n/ZEixGiHMYO6qfcR5XtXSuSejHvSPLS39N40Fl0Z88rIfe664ycd2Ih8SB3qP74d1gCADknUCyydhZuggr5DJG0/3N4jaGgYBsLmUq1T7yZDqY9F/mq22jn7TQWUUCAwEAAaNTMFEwHQYDVR0OBBYEFE8LUpzxF/SDx7w6V62o/HPaNnvMMB8GA1UdIwQYMBaAFE8LUpzxF/SDx7w6V62o/HPaNnvMMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAEUMISb1wLsowsrAsSWbQvUEn4sAGWF4QJl8SSzLudW57P868/NgHXZ10H2Hcc1nCFSZx7Oq620T8yi9QEEn0c4CoAIiituokpWSsAL2/WwD2MTX8SoUvYo2JJFGWvGAbI4o3APnJ0X+r6g6Vsm2i5L0PVNJ1aUid/hLoat1ITLpGqQCbhdan3B6D+6PE4IbNBHCimcTREuBYtk2NOcUC0ftBFrv8pOf1WEI+GoPuS1peIM0oQmduoqTM0o3H/OgzesQNDmLrHdY2+1AxhBhySUWi9c0Wt+LjX0t3Rh67byTEd83OSJB+qXGcR4W96+psF+UlJRViui5vY1Y+JPCRDM=";
    expect(cert).toBe(expectedCert);
    cert = removeHeaders(cert);
    expect(cert).toBe(expectedCert);
  });

  test("Test for sassMiddleware", () => {
    const mockLog = jest.fn();
    const result = { css: "{}", stats: { includedFiles: "includedFiles" } };
    const mockSass = {
      renderSync: function () {
        return result;
      },
    };
    const importer = function () {};

    const src = "placeholder.scss";
    const dest = path.join(process.cwd(), "test", "test.css");

    const sMiddleware = sassMiddleware({
      src: src,
      dest: dest,
      log: mockLog,
      sass: mockSass,
      importer: importer,
    });

    const middleware = util.promisify(sMiddleware);

    // test - skip rendering
    middleware({ path: "/file.png" }, undefined)
      .then(() => {
        expect(mockLog).toHaveBeenCalledWith("skipping non-css path");
      })
      .catch((error) => {
        fail(error);
      });

    // test - render
    middleware({ path: "/file.css" }, undefined)
      .then(() => {
        expect(mockLog).toHaveBeenCalledWith("rendering css");
        expect(mockLog).toHaveBeenCalledWith("writing to file");
        expect(mockLog).toHaveBeenCalledWith("caching src");
      })
      .catch((error) => {
        fail(error);
      });

    // test - cached
    middleware({ path: "/file.css" }, undefined)
      .then(() => {
        expect(mockLog).toHaveBeenCalledWith("css already rendered");
      })
      .catch((error) => {
        fail(error);
      });
  });

  test("Test for getReqUrl", () => {
    let req = {
      get: function (prop) {
        switch (prop) {
          case "host":
            return this.host;
          case "x-forwarded-host":
            return this.x_fowarded_host;
          default:
            return "unexpected";
        }
      },
      host: "example.com",
      originalUrl: "http://original.example.com",
      x_fowarded_host: "fowarded.example.com",
    };
    let result = getReqUrl(req, "test/path/1");
    expect(result).toBe("https://fowarded.example.com/test/path/1");
    req.host = "localhost:7000";
    req.x_fowarded_host = undefined;
    result = getReqUrl(req, "test/path/1");
    expect(result).toBe("http://localhost:7000/test/path/1");
  });
});
