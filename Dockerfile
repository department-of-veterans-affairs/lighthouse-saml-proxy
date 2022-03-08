FROM vasdvp/lighthouse-node-application-base:node16

# Build Args
ARG BUILD_DATE_TIME
ARG VERSION
ARG BUILD_NUMBER
ARG BUILD_TOOL

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

WORKDIR /home/node

RUN git config --global url."https://".insteadOf git://
COPY --chown=node:node package.json package.json
COPY --chown=node:node package-lock.json package-lock.json
RUN npm install


COPY --chown=node:node ./ ./

EXPOSE 7000 7000

RUN ./node_modules/.bin/tsc
HEALTHCHECK --interval=1m --timeout=4s --start-period=30s \
  CMD curl -f http://localhost:7000/samlproxy/idp/metadata || exit 1

USER node

ENTRYPOINT ["/usr/local/bin/tini", "--"]
CMD ["node", "build/app.js", "--config", "/etc/saml-proxy/config.json"]
