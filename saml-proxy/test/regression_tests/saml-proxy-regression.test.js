require("jest");
const { v4: uuidv4 } = require("uuid");
const puppeteer = require("puppeteer");
const { isSensitiveError, isIcnError } = require("./page-assertions");
const qs = require("querystring");
const { ModifyAttack } = require("saml-attacks");
const SAML = require("saml-encoder-decoder-js");
const launchArgs = {
  headless: false,
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
const redirect_uri = "https://app/after-auth";

jest.setTimeout(30000);

test("Happy Path", async () => {
  const browser = await puppeteer.launch(launchArgs);
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(30000);
  await requestToken(page);

  let code = await login(
    page,
    "va.api.user+idme.001@gmail.com",
    "Password1234!",
    true
  );
  expect(code).not.toBeNull();
  await browser.close();
});

test("ICN Error", async () => {
  const browser = await puppeteer.launch(launchArgs);
  const page = await browser.newPage();
  await requestToken(page);

  await login(page, "va.api.user+idme.043@gmail.com", "Password1234!");

  await page.waitForRequest((request) => {
    return request.url().includes("/samlproxy/sp/saml/sso");
  });

  await page.waitForNavigation({
    waitUntil: "networkidle0",
  });

  await isIcnError(page);
  await browser.close();
});

test("Replay", async () => {
  const browser = await puppeteer.launch(launchArgs);
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
      request.url().includes("/samlproxy/sp/saml/sso") &&
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
  await anotherPage.goto(`${authorization_url}/samlproxy/sp/saml/sso`);

  // assertion
  await isSensitiveError(anotherPage);
  await browser.close();
});

test("modify", async () => {
  const browser = await puppeteer.launch(launchArgs);
  const page = await browser.newPage();
  await requestToken(page);
  await authentication(page, "va.api.user+idme.001@gmail.com", true);

  page.on("request", async (request) => {
    if (
      request.url().includes("/samlproxy/sp/saml/sso") &&
      request.method() == "POST"
    ) {
      let post_data = decode(request);
      post_data.SAMLResponse = ModifyAttack(
        post_data.SAMLResponse,
        "uuid",
        "modify"
      );

      await request.continue({
        method: "POST",
        postData: encode(post_data),
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

  await browser.close();
});

test("Empty SSO", async () => {
  const browser = await puppeteer.launch(launchArgs);
  const page = await browser.newPage();

  await page.goto(authorization_url);

  // assertion
  await isSensitiveError(page);
  await browser.close();
});

test("404", async () => {
  const browser = await puppeteer.launch(launchArgs);
  const page = await browser.newPage();

  await page.goto("http://localhost:7000/bad");

  await browser.close();
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

const authentication = async (
  page,
  email = "va.api.user+idme.001@gmail.com",
  intercept = false
) => {
  await page.click(".idme-signin");
  await page.waitForSelector("#user_email");
  await page.type("#user_email", email);
  await page.type("#user_password", "Password1234!");
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
