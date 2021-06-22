require("jest");
const { v4: uuidv4 } = require("uuid");
const puppeteer = require("puppeteer");
const qs = require("querystring");
const { ModifyAttack } = require("saml-attacks");
const SAML = require("saml-encoder-decoder-js");
const launchArgs = {
  headless: process.env.HEADLESS > 0,
  args: ["--no-sandbox", "--enable-features=NetworkService"],
};

const defaultScope = [
  "openid",
  "profile",
  "offline_access",
  "email",
  "address phone",
];

const authorization_url = "https://sandbox-api.va.gov/oauth2";
const saml_proxy_url = process.env.SAML_PROXY_URL;
const redirect_uri = "https://app/after-auth";
const user_password = process.env.USER_PASSWORD;
const valid_user = process.env.USER_EMAIL;
const icn_error_user = process.env.ICN_ERROR_USER_EMAIL;

describe("Regression tests", () => {
  jest.setTimeout(30000);
  let browser;
  beforeEach(async () => {
    browser = await puppeteer.launch(launchArgs);
  });

  afterEach(async () => {
    await browser.close();
  });

  test("Happy Path", async () => {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(30000);
    await requestToken(page);

    let code = await login(page, valid_user, user_password, true);
    expect(code).not.toBeNull();
  });

  test("ICN Error", async () => {
    const page = await browser.newPage();
    await requestToken(page);

    await login(page, icn_error_user, user_password);

    await page.waitForRequest((request) => {
      return request.url().includes("/samlproxy/sp/saml/sso");
    });

    await page.waitForNavigation({
      waitUntil: "networkidle0",
    });

    await isError(
      page,
      "Some VA.gov tools aren't working right now",
      "We're sorry. Something went wrong on our end while looking up your account. You may not be able to connect to your VA records until we can figure out what's wrong."
    );
  });

  test("Replay", async () => {
    const page = await browser.newPage();

    await requestToken(page);
    await authentication(page);

    let post_data;
    await page.waitForRequest((request) => {
      if (request.url().includes("/samlproxy/sp/saml/sso")) {
        post_data = request.postData();
        return true;
      }
      return false;
    });

    await page.waitForRequest((request) =>
      request.url().includes("https://app/after-auth")
    );
    let anotherPage = await browser.newPage();
    await anotherPage.setRequestInterception(true);
    anotherPage.on("request", async (request) => {
      if (
        request.url().includes(`${saml_proxy_url}/samlproxy/sp/saml/sso`) &&
        request.method() == "GET"
      ) {
        await request.continue({
          method: "POST",
          postData: post_data,
          headers: {
            ...request.headers(),
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
      } else {
        await request.continue();
      }
    });
    await anotherPage.goto(`${saml_proxy_url}/samlproxy/sp/saml/sso`);

    // assertion
    await isSensitiveError(anotherPage);
  });

  test("Empty SSO", async () => {
    const page = await browser.newPage();
    await page.goto(`${saml_proxy_url}/samlproxy/idp/saml/sso`);
    await page.waitForSelector(".usa-alert-error");
    await isSensitiveError(page);
  });

  test("404", async () => {
    const page = await browser.newPage();
    await page.goto(`${saml_proxy_url}/samlproxy/bad`);
    await page.waitForSelector(".usa-alert-error");
    await isError(page, "Error", "Route Not Found");
  });

  test("modify", async () => {
    const page = await browser.newPage();
    await requestToken(page);
    await authentication(page, valid_user, true);

    page.on("request", async (request) => {
      if (
        request.url().includes(`${saml_proxy_url}/samlproxy/sp/saml/sso`) &&
        request.method() == "POST"
      ) {
        let post_data = await decode(request);
        let modify = await ModifyAttack(
          post_data.SAMLResponse,
          "uuid",
          "modify"
        );
        post_data.SAMLResponse = modify;
        let data = await encode(post_data);
        await request.continue({
          method: "POST",
          postData: data,
          headers: {
            ...request.headers(),
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
      } else {
        await request.continue();
      }
    });

    await page.waitForSelector(".usa-alert-error");

    await isSensitiveError(page);
  });
});

const requestToken = async (page) => {
  await page.goto(
    `${authorization_url}/authorization?client_id=${
      process.env.CLIENT_ID
    }&scope=${defaultScope.join(
      " "
    )}&response_type=code&redirect_uri=${redirect_uri}&aud=default&state=${uuidv4()}&idp=${
      process.env.IDP
    }`
  );
  await page.waitForNavigation({
    waitUntil: "networkidle0",
  });
};

const login = async (page, useremail, password, get_code = false) => {
  await authentication(page, useremail);

  let code;
  if (get_code) {
    let request = await page.waitForRequest((request) =>
      request.url().includes(redirect_uri)
    );
    let url = new URL(request.url());
    code = url.searchParams.get("code");
  }

  return code;
};

const authentication = async (page, email = valid_user, intercept = false) => {
  await page.click(".idme-signin");
  await page.waitForSelector("#user_email");
  await page.type("#user_email", email);
  await page.type("#user_password", user_password);
  await page.click('[name="commit"]');
  await page.waitForSelector(".phone");
  await page.click("button.btn-primary");
  await page.waitForSelector("#multifactor_code");

  await page.setRequestInterception(intercept);

  await page.click("button.btn-primary");
};

const encode = async (data) => {
  await SAML.encodeSamlPost(data.SAMLResponse, function (err, encoded) {
    if (!err) {
      data.SAMLResponse = encoded;
    }
  });

  return qs.stringify(data);
};

const decode = async (request) => {
  let post_string = request.postData();
  let post_data = qs.parse(post_string);
  await SAML.decodeSamlPost(post_data.SAMLResponse, function (err, result) {
    if (!err) {
      post_data.SAMLResponse = result;
    }
  });

  return post_data;
};

const isError = async (page, header, errorMessage) => {
  const heading = await page.$eval(
    ".usa-alert-body > .usa-alert-heading",
    (elem) => elem.innerText
  );
  expect(heading).toEqual(header);

  const errorText = await page.$eval(
    ".usa-alert-body > p",
    (elem) => elem.innerText
  );
  expect(errorText).toEqual(errorMessage);

  const errorIdHeadding = await page.$eval(
    ".usa-alert-body > .usa-alert-heading:nth-of-type(2)",
    (elem) => elem.innerText
  );
  expect(errorIdHeadding).toEqual("Error ID");

  const errorId = await page.$eval(
    ".usa-alert-body > pre",
    (elem) => elem.innerText
  );
  expect(errorId);
};

const isSensitiveError = async (page) => {
  const heading = await page.$eval(
    ".usa-alert-body > .usa-alert-heading",
    (elem) => elem.innerText
  );
  expect(heading).toEqual("Error");

  const errorText = await page.$eval(
    ".usa-alert-body > p",
    (elem) => elem.innerText
  );
  expect(errorText).toEqual("Your request could not be processed.");

  const errorIdHeadding = await page.$eval(
    ".usa-alert-body > .usa-alert-heading:nth-of-type(2)",
    (elem) => elem.innerText
  );
  expect(errorIdHeadding).toEqual("Error ID");

  const errorId = await page.$eval(
    ".usa-alert-body > pre",
    (elem) => elem.innerText
  );
  expect(errorId);
};
