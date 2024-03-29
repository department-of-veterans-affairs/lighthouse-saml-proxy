import passport from "passport";
import { Strategy } from "passport-wsfed-saml2";
import omit from "lodash.omit";
import { IDPProfileMapper } from "../IDPProfileMapper";

/**
 * Creates the passport strategy using the response params
 * which come from the service provider config data
 *
 * @param {*} spConfig config parameter
 * @returns {Strategy} returns the strategy which contains response params from
 * service provider configs and user profile
 */
export default function createPassportStrategy(spConfig) {
  const responseParams = spConfig.getResponseParams();
  const strategy = new Strategy(responseParams, (profile, done) => {
    profile.category = responseParams.category;
    return done(null, {
      issuer: profile.issuer,
      userName: profile.nameIdAttributes.value,
      nameIdFormat: profile.nameIdAttributes.Format,
      authnContext: {
        sessionIndex: profile.sessionIndex,
        authnMethod:
          profile[
            "http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationmethod"
          ],
      },
      claims: new IDPProfileMapper({
        claims: omit(
          profile,
          "issuer",
          "sessionIndex",
          "nameIdAttributes",
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
          "http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationmethod"
        ),
      }).getMappedClaims(),
    });
  });

  return strategy;
}

/**
 * This function prepare passport user info and is
 * called before handling the SAML response.
 *
 * @param {*} strategy passport strategy
 * @returns {passport} returns passports information after passport either
 * serialized, deserialized or initialized.
 */
export function preparePassport(strategy) {
  passport.use(strategy);

  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (user, done) {
    done(null, user);
  });

  passport.initialize();
  return passport;
}

/**
 * Uses the request to select a key which will be used
 * for selecting the appropriate passport strategy when
 * handing a SAML response
 *
 * @param {*} req The instance of IConfiguredRequest
 * @returns {*} A string with the correct spIdp key
 */
export const selectPassportStrategyKey = (req) => {
  const origin = req.headers.origin;
  let passportKey = "id_me";
  Object.entries(req.sps.options).forEach((spIdpEntry) => {
    if (spIdpEntry[1].idpSsoUrl.startsWith(origin)) {
      passportKey = spIdpEntry[0];
    }
  });
  return passportKey;
};
