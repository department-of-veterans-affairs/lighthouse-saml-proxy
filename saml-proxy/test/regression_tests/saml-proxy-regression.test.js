require("jest");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const puppeteer = require("puppeteer");
const { isSensitiveError, isIcnError } = require("./page-assertions");
const {
  logger,
} = require("saml-proxy-automation/logging/logger.js");
const qs = require("querystring");
const SAML = require("saml-encoder-decoder-js");
var parseString = require("xml2js").parseString;
var xml2js = require("xml2js");
const launchArgs = {
  headless: false,
  args: ["--no-sandbox", "--enable-features=NetworkService"],
};
const fs = require("fs");

const defaultScope = [
  "openid",
  "profile",
  "offline_access",
  "email",
  "address phone",
];

const authorization_url = "https://sandbox-api.va.gov/oauth2";
const redirect_uri = "https://app/after-auth";

const create_dir = ((dir) => {
  console.log('Creating ' +  dir + ' directory');
  fs.mkdir(dir, (err) => {
    if (err) {
      console.info(err.message);
    }
    else {
      console.info("Created screenshots directory");
    }
  })
});

const idp_num_to_env = (idp) => {
  switch(idp){
    case process.env.LOCAL:
      return "Local"
    case process.env.DEV:
      return "Dev"
    case process.env.SANDBOX:
      return "Sandbox"
    case process.env.STAGING:
      return "Staging"
  }
  return "Unknown"
}

create_dir('screenshots');
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
  await page.screenshot({ path: "./screenshots/icn_error.png" });
  await browser.close();
});

test("Replay", async () => {
  const browser = await puppeteer.launch(launchArgs);
  const page = await browser.newPage();

  await requestToken(page);
  await page.screenshot({ path: "./screenshots/idpSelection.png" });
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
  await anotherPage.screenshot({ path: "./screenshots/replay.png" });
  await browser.close();
});

test("modify", async () => {
    // TODO Implement
    await browser.close();
});

test("Empty SSO", async () => {
  const browser = await puppeteer.launch(launchArgs);
  const page = await browser.newPage();

  await page.goto(authorization_url);

  // assertion
  await isSensitiveError(page);
  await page.screenshot({ path: "./screenshots/empty_request.png" });
  await browser.close();
});

test("404", async () => {
  const browser = await puppeteer.launch(launchArgs);
  const page = await browser.newPage();

  await page.goto("http://localhost:7000/bad");

  await page.screenshot({ path: "./screenshots/404_request.png" });
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

const login = async (page, email, password, get_code = false) => {
  await authentication(page, (email = email));

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
