FROM vasdvp/lighthouse-node-application-base:node12

WORKDIR /home/node

RUN git config --global url."https://".insteadOf git://
COPY --chown=node:node ./saml-proxy/package.json package.json
COPY --chown=node:node ./saml-proxy/package-lock.json package-lock.json
RUN npm install

USER root
RUN mkdir -p /home/common && \
  chown -R node:node /home/common

COPY --chown=node:node ./saml-proxy ./
COPY --chown=node:node ./common /home/common

EXPOSE 7000 7000

RUN ./node_modules/.bin/tsc
HEALTHCHECK --interval=1m --timeout=4s --start-period=30s \
  CMD node bin/healthcheck.js

RUN chown -R node:node /home/node 

USER node
ENTRYPOINT ["/usr/local/bin/tini", "--"]
CMD ["node", "build/app.js"]
