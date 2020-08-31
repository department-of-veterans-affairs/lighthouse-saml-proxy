import passport from "passport";
import { Strategy } from "passport-wsfed-saml2";
import omit from "lodash.omit";
import { IDMeProfileMapper } from "../IDMeProfileMapper";

export default function createPassport(spConfig) {
  const responseParams = spConfig.getResponseParams();
  const strategy = new Strategy(responseParams, (profile, done) => {
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
      claims: new IDMeProfileMapper({
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
  passport.use(strategy);

  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (user, done) {
    done(null, user);
  });

  return [passport, strategy];
}
