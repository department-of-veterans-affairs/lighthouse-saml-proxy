import { renderFile } from "ejs";
import { join } from "path";

describe("button configuration renders correctly", () => {
  const templatePath = join(__dirname, "..", "views", "login_selection.ejs");

  test("does not render element", async () => {
    renderFile(
      templatePath,
      {
        login_gov_enabled: false,
        mhv_logon_enabled: false,
        ds_logon_enabled: false,
        id_me_login_link: "something",
      },
      (err, html) => {
        expect(html).not.toMatch(/DS Logon/);
        expect(html).not.toMatch(/My HealtheVet/);
        expect(html).not.toMatch(/<title>Login.gov<\/title>/);
        expect(html).not.toMatch(/Other ways to verify/);
      }
    );
  });

  test("does render element", async () => {
    renderFile(
      templatePath,
      {
        login_gov_enabled: true,
        mhv_logon_enabled: true,
        ds_logon_enabled: true,
        id_me_login_link: "something",
        mhv_login_link: "something",
        dslogon_login_link: "something",
        login_gov_login_link: "something",
      },
      (err, html) => {
        expect(html).toMatch(/DS Logon/);
        expect(html).toMatch(/My HealtheVet/);
        expect(html).toMatch(/<title>Login.gov<\/title>/);
        expect(html).toMatch(/Other ways to verify/);
      }
    );
  });
});
