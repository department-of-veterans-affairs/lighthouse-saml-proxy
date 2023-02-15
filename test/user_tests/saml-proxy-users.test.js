require("jest");
const { v4: uuidv4 } = require("uuid");
const puppeteer = require("puppeteer");
const qs = require("querystring");
const { ModifyAttack } = require("saml-attacks");
const SAML = require("saml-encoder-decoder-js");
const fs = require("fs");
const path = require('path');

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

const authorization_url = process.env.AUTHORIZATION_URL;
const saml_proxy_url = process.env.SAML_PROXY_URL;
const redirect_uri = "https://app/after-auth";
const user_password = process.env.USER_PASSWORD;
const valid_user = process.env.VALID_USER_EMAIL;
const icn_error_user = process.env.ICN_ERROR_USER_EMAIL;

describe("Happy users tests", () => {
  jest.setTimeout(70000);
  let browser;
  beforeEach(async () => {
    browser = await puppeteer.launch(launchArgs);
  });

  afterEach(async () => {
    await browser.close();
  });

  const filePath = path.join(__dirname, 'happy_users.txt');
  let users;
  fs.readFile(filePath, {encoding: 'utf-8'}, (error, data) => {
    if (error) {
      console.error(error);
      return;
    }
    users = data.split(/[ ,]+/);
  });

  const testUser = async (happy_user) => {
    const page = await browser.newPage();
    await requestToken(page);

    let code = await login(page, valid_user, user_password, true);
    expect(code).not.toBeNull();
  };

  test.only("Happy Path", async () => {
   await testUser(valid_user);
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
  await page.$eval(".idme-signin", (elem) => elem.click());
  await page.waitForSelector("#user_email");
  await page.type("#user_email", email);
  await page.type("#user_password", user_password);
  await page.$eval('[name="commit"]', (elem) => elem.click());
  await page.waitForSelector(".phone");
  await page.$eval("button.btn-primary", (elem) => elem.click());
  await page.waitForSelector("#multifactor_code");

  await page.setRequestInterception(intercept);

  await page.$eval("button.btn-primary", (elem) => elem.click());
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
