FROM vasdvp/lighthouse-node-application-base:node12

WORKDIR /home/node

RUN git config --global url."https://".insteadOf git://
COPY --chown=node:node ./saml-proxy/package.json package.json
COPY --chown=node:node ./saml-proxy/package-lock.json package-lock.json
RUN npm install

USER root
RUN mkdir -p /home/common/certs && \
  chown -R node:node /home/common/certs
COPY ./common/certs/* /etc/pki/ca-trust/source/anchors/
RUN update-ca-trust

COPY --chown=node:node ./saml-proxy ./
COPY --chown=node:node ./common /home/common

RUN cat /home/common/certs/*.pem > /home/common/certs/combined.pem
ENV NODE_EXTRA_CA_CERTS /home/common/certs/combined.pem

EXPOSE 7000 7000

RUN ./node_modules/.bin/tsc
HEALTHCHECK --interval=1m --timeout=4s \
  CMD wget localhost:7000/samlproxy/idp/metadata -q -O - > /dev/null 2>&1

RUN chown -R node:node /home/node 

USER node
CMD ["node", "build/app.js"]
