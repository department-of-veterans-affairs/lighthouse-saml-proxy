# Build Args
ARG BUILD_DATE_TIME
ARG VERSION
ARG BUILD_NUMBER
ARG BUILD_TOOL

FROM ghcr.io/department-of-veterans-affairs/health-apis-docker-octopus/lighthouse-node-application-base:v2-node16 as npminstall

WORKDIR /home/lhuser

RUN git config --global url."https://".insteadOf git://
COPY --chown=lhuser:lhuser package.json package.json
COPY --chown=lhuser:lhuser package-lock.json package-lock.json
RUN npm install

FROM npminstall as tscbuild

COPY --chown=lhuser:lhuser bin/ bin/
COPY --chown=lhuser:lhuser src/ src/
COPY --chown=lhuser:lhuser public/ public/
COPY --chown=lhuser:lhuser styles/ styles/
COPY --chown=lhuser:lhuser views/ views/
COPY --chown=lhuser:lhuser tsconfig.json ./
RUN ./node_modules/.bin/tsc

FROM ghcr.io/department-of-veterans-affairs/health-apis-docker-octopus/lighthouse-node-application-base:v2-node16 as deploy

WORKDIR /home/lhuser

COPY --chown=lhuser:lhuser *.pem ./
COPY --chown=lhuser:lhuser *.key ./

COPY --from=tscbuild --chown=lhuser:lhuser /home/lhuser/bin/ ./bin/
COPY --from=tscbuild --chown=lhuser:lhuser /home/lhuser/public/ ./public/
COPY --from=tscbuild --chown=lhuser:lhuser /home/lhuser/styles/ ./styles/
COPY --from=tscbuild --chown=lhuser:lhuser /home/lhuser/views/ ./views/
COPY --from=tscbuild --chown=lhuser:lhuser /home/lhuser/node_modules/ ./node_modules/
COPY --from=tscbuild --chown=lhuser:lhuser /home/lhuser/build/ ./build/

EXPOSE 7000 7000

HEALTHCHECK --interval=1m --timeout=4s --start-period=30s \
  CMD curl -f http://localhost:7000/samlproxy/idp/metadata || exit 1

ENTRYPOINT ["/usr/local/bin/tini", "--"]
CMD ["node", "build/app.js", "--config", "/etc/saml-proxy/config.json"]

FROM npminstall as testandlint

COPY --chown=lhuser:lhuser bin/ bin/
COPY --chown=lhuser:lhuser src/ src/
COPY --chown=lhuser:lhuser test/ test/
COPY --chown=lhuser:lhuser public/ public/
COPY --chown=lhuser:lhuser styles/ styles/
COPY --chown=lhuser:lhuser views/ views/
COPY --chown=lhuser:lhuser tsconfig.json ./
COPY --chown=lhuser:lhuser .eslint* ./
COPY --chown=lhuser:lhuser tsconfig.json ./

# The following section is temporary until a followup fix on the ci
USER root
RUN chown -R lhuser:lhuser /home/node/
USER lhuser
COPY --chown=lhuser:lhuser bin/ /home/node/bin/
COPY --chown=lhuser:lhuser src/ /home/node/src/
COPY --chown=lhuser:lhuser test/ /home/node/test/
COPY --chown=lhuser:lhuser public/ /home/node/public/
COPY --chown=lhuser:lhuser styles/ /home/node/styles/
COPY --chown=lhuser:lhuser views/ /home/node/views/
COPY --chown=lhuser:lhuser tsconfig.json /home/node/
COPY --chown=lhuser:lhuser .eslint* /home/node/
COPY --chown=lhuser:lhuser tsconfig.json /home/node/

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

