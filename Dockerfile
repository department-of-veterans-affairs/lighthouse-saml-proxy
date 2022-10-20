# Build Args
ARG BUILD_DATE_TIME
ARG VERSION
ARG BUILD_NUMBER
ARG BUILD_TOOL

FROM vasdvp/lighthouse-node-application-base:node16 as npminstall

WORKDIR /home/node

RUN git config --global url."https://".insteadOf git://
COPY --chown=node:node package.json package.json
COPY --chown=node:node package-lock.json package-lock.json
RUN npm install

FROM npminstall as tscbuild

COPY --chown=node:node bin/ bin/
COPY --chown=node:node src/ src/
COPY --chown=node:node public/ public/
COPY --chown=node:node styles/ styles/
COPY --chown=node:node templates/ templates/
COPY --chown=node:node views/ views/
COPY --chown=node:node tsconfig.json ./
RUN ./node_modules/.bin/tsc

FROM vasdvp/lighthouse-node-application-base:node16 as deploy

WORKDIR /home/node

COPY --chown=node:node *.pem ./
COPY --chown=node:node *.key ./

COPY --from=tscbuild --chown=node:node /home/node/bin/ ./bin/
COPY --from=tscbuild --chown=node:node /home/node/public/ ./public/
COPY --from=tscbuild --chown=node:node /home/node/styles/ ./styles/
COPY --from=tscbuild --chown=node:node /home/node/templates/ ./templates/
COPY --from=tscbuild --chown=node:node /home/node/views/ ./views/
COPY --from=tscbuild --chown=node:node /home/node/node_modules/ ./node_modules/
COPY --from=tscbuild --chown=node:node /home/node/build/ ./build/

EXPOSE 7000 7000

HEALTHCHECK --interval=1m --timeout=4s --start-period=30s \
  CMD curl -f http://localhost:7000/samlproxy/idp/metadata || exit 1

USER node

ENTRYPOINT ["/usr/local/bin/tini", "--"]
CMD ["node", "build/app.js", "--config", "/etc/saml-proxy/config.json"]

FROM npminstall as testandlint

COPY --chown=node:node bin/ bin/
COPY --chown=node:node src/ src/
COPY --chown=node:node test/ test/
COPY --chown=node:node public/ public/
COPY --chown=node:node styles/ styles/
COPY --chown=node:node templates/ templates/
COPY --chown=node:node views/ views/
COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node .eslint* ./
COPY --chown=node:node tsconfig.json ./

USER node

# Static Labels
LABEL org.opencontainers.image.authors="leeroy-jenkles@va.gov" \
      org.opencontainers.image.url="https://github.com/department-of-veterans-affairs/lighthouse-saml-proxy/tree/master/Dockerfile" \
      org.opencontainers.image.documentation="https://github.com/department-of-veterans-affairs/lighthouse-saml-proxy/tree/master/README.md" \
      org.opencontainers.image.vendor="lighthouse" \
      org.opencontainers.image.title="saml-proxy" \
      org.opencontainers.image.source="https://github.com/department-of-veterans-affairs/lighthouse-saml-proxy/tree/master" \
      org.opencontainers.image.description="SAML Proxy for Lighthouse APIs"

# Dynamic Labels
LABEL org.opencontainers.image.created=${BUILD_DATE_TIME} \
      org.opencontainers.image.version=${VERSION} \
      gov.va.build.number=${BUILD_NUMBER} \
      gov.va.build.tool=${BUILD_TOOL}

