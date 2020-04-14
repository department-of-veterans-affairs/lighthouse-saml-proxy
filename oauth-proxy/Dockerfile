FROM vasdvp/lighthouse-node-application-base:node12

WORKDIR /home/node

RUN git config --global url."https://".insteadOf git://
COPY --chown=node:node ./oauth-proxy/package.json package.json
COPY --chown=node:node ./oauth-proxy/package-lock.json package-lock.json
RUN npm install

USER root
RUN mkdir -p /home/common && \
  chown -R node:node /home/common

COPY --chown=node:node ./oauth-proxy ./
COPY --chown=node:node ./common /home/common

EXPOSE 7100 7100

HEALTHCHECK --interval=1m --timeout=4s \
  CMD wget localhost:7100/oauth2/.well-known/openid-configuration -q -O - > /dev/null 2>&1

USER node
ENTRYPOINT ["/usr/local/bin/tini", "--"]
CMD ["node", "index.js"]
