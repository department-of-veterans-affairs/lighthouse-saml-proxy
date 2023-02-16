require("jest");
const { v4: uuidv4 } = require("uuid");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

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
const redirect_uri = "https://app/after-auth";
const user_password = process.env.USER_PASSWORD;
const filePath = path.join(__dirname, "happy_users.txt");
const happy_users = fs
  .readFileSync(filePath, { encoding: "utf-8" })
  .split(/[ ,]+/);

const testUser = async (happy_user) => {
  const browser = await puppeteer.launch(launchArgs);
  console.info("Testing with user " + happy_user);
  const page = await browser.newPage();
  await requestToken(page);

  let code = await login(page, happy_user, user_password, true);
  expect(code).not.toBeNull();
  await browser.close();
};

describe("Happy users tests", () => {
  jest.setTimeout(70000);
  const users = [];
  happy_users.forEach((user) => users.push(user.trim()));
  test.each(users)("Login with %s", (user) => testUser(user));
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

const authentication = async (page, email, intercept = false) => {
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
