FROM node:latest 

ADD ./package.json package.json
RUN npm install -g bower
RUN npm install

ADD ./bower.json bower.json
RUN bower install --allow-root

EXPOSE 7000 7000

# ADD ./node_modules node_modules
ADD ./lib lib
ADD ./templates templates
ADD ./views views
ADD ./app.js app.js
ADD ./config.js config.js
add ./idp-metadata.js idp-metadata.js
ADD ./idp-public-cert.pem idp-public-cert.pem
ADD ./idp-private-key.pem idp-private-key.pem
ADD ./sp-cert.pem sp-cert.pem
ADD ./sp-key.pem sp-key.pem
ADD ./public public

ENTRYPOINT ["node", "app.js", "--idpAcsUrl", "https://deptva-vetsgov-eval.okta.com/sso/saml2/0oa1pbnlkmlWpo0q22p7", "--idpIssuer", "samlproxy-idp.vetsgov.dev", "--idpAudience", "https://www.okta.com/saml2/service-provider/spshbtcxwhreqinrtome", "--idpBaseUrl", "https://dev.vets.gov/samlproxy/idp", "--spIdpMetaUrl", "https://api.idmelabs.com/saml/metadata/provider", "--spNameIDFormat", "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent", "--spAudience", "samlproxy.vetsgov.dev", "--spIdpIssuer", "api.idmelabs.com", "--spAuthnContextClassRef", "http://idmanagement.gov/ns/assurance/loa/3", "--spAcsUrls", "/samlproxy/sp/saml/sso"]
