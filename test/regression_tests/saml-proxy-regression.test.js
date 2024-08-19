require("jest");
const { v4: uuidv4 } = require("uuid");
const puppeteer = require("puppeteer");
const qs = require("querystring");
const SAML = require("saml-encoder-decoder-js");
const speakeasy = require("speakeasy");
const ModifyAttack = require("./modifyAttack");
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

const redirect_uri = "https://app/after-auth";
const authorization_url = process.env.AUTHORIZATION_URL;
const saml_proxy_url = process.env.SAML_PROXY_URL;
const valid_login_gov_user_email = process.env.VALID_LOGIN_GOV_USER_EMAIL;
const valid_login_gov_user_seed = process.env.VALID_LOGIN_GOV_USER_SEED;
const login_gov_user_password = process.env.LOGIN_GOV_USER_PASSWORD;
const icn_error_login_gov_user_email =
  process.env.ICN_ERROR_LOGIN_GOV_USER_EMAIL;
const icn_error_login_gov_user_seed = process.env.ICN_ERROR_LOGIN_GOV_USER_SEED;
const regression_test_timeout = process.env.REGRESSION_TEST_TIMEOUT
  ? Number(process.env.REGRESSION_TEST_TIMEOUT)
  : 70000;

describe("Regression tests", () => {
  jest.setTimeout(regression_test_timeout);
  let browser;
  beforeEach(async () => {
    browser = await puppeteer.launch(launchArgs);
  });

  afterEach(async () => {
    await browser.close();
  });

  test("Happy Path", async () => {
    const page = await browser.newPage();
    await requestToken(page);

    let code = await login(
      page,
      valid_login_gov_user_email,
      login_gov_user_password,
      valid_login_gov_user_seed,
      true
    );
    expect(code).not.toBeNull();
  });

  test("ICN Error", async () => {
    const page = await browser.newPage();
    await requestToken(page);

    await login(
      page,
      icn_error_login_gov_user_email,
      login_gov_user_password,
      icn_error_login_gov_user_seed
    );

    await page.waitForRequest((request) => {
      return request.url().includes("/samlproxy/sp/saml/sso");
    });

    await page.waitForNavigation({
      waitUntil: "networkidle0",
    });

    await isError(
      page,
      "We need to verify your identity before giving you access to your information",
      "We're sorry. We can't match the information you provided with what we have in our Veteran records. We take your privacy seriously, and we're committed to protecting your information. You won't be able to access some VA tools until we match your information and verify your identity."
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

  test("Empty Assertion Response", async () => {
    const page = await browser.newPage();
    await page.goto(`${saml_proxy_url}/samlproxy/sp/saml/sso`);
    await page.waitForSelector(".usa-alert-error");
    await isError(page, "Error", "Invalid assertion response.");
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
    await authentication(
      page,
      valid_login_gov_user_email,
      login_gov_user_password,
      valid_login_gov_user_seed
    );

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

    await page.waitForSelector(".usa-alert-error", {
      timeout: regression_test_timeout,
    });

    await isSensitiveError(page);
  });
});

const requestToken = async (page) => {
  await page.setViewport({ width: 0, height: 0, deviceScaleFactor: 0 });
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

const login = async (page, useremail, password, seed, get_code = false) => {
  await authentication(page, useremail, password, seed);

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

const authentication = async (
  page,
  email = valid_login_gov_user_email,
  password = login_gov_user_password,
  seed = valid_login_gov_user_seed
) => {
  await page.waitForSelector(".logingov-signin");

  await Promise.all([
    page.$eval(".logingov-signin", (elem) => elem.click()),
    page.setViewport({ width: 0, height: 0, deviceScaleFactor: 0 }),
  ]);

  await Promise.all([
    page.waitForSelector("#user_email"),
    page.waitForSelector('[name="user[password]"]'),
    page.waitForSelector('[name="button"]'),
  ]);

  await page.type("#user_email", email);
  await page.type('[name="user[password]"]', password);

  await page.$eval('[name="button"]', (elem) => elem.click());

  if (page.url().includes("rules_of_use")) {
    await Promise.all([
      page.$eval('[class="usa-checkbox__label boolean required"]', (elem) =>
        elem.click()
      ),
      page.$eval('[name="button"]', (elem) => elem.click()),
    ]);
  }

  await Promise.all([
    page.waitForSelector('[autocomplete="one-time-code"]'),
    page.waitForSelector('[name="button"]'),
    page.setViewport({ width: 0, height: 0, deviceScaleFactor: 0 }),
  ]);

  const totp = speakeasy.totp({
    secret: seed,
    encoding: "base32",
  });

  await page.type('[autocomplete="one-time-code"]', totp);

  await page.waitForSelector('[type="submit"]');

  await page.$eval('[type="submit"]', (elem) => elem.click());
  await page.waitForNavigation();

  if (page.url().includes("second_mfa_reminder")) {
    await page.waitForSelector('[type="submit"]');
    const buttons = await page.$$('[type="submit"]');

    for (const button of buttons) {
      const buttonText = await button.evaluate((node) => node.textContent);
      if (buttonText.includes("Continue to")) {
        await button.click(), page.waitForNavigation();
        break;
      }
    }
  }

  if (page.url().includes("sign_up/completed")) {
    await page.waitForSelector('[type="submit"]');
    await page.$eval('[type="submit"]', (elem) => elem.click());
  }
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
