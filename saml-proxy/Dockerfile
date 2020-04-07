FROM vasdvp/lighthouse-node-application-base:node12

WORKDIR /home/node
RUN mkdir -p /home/node/certs && \
  chown -R node:node /home/node/certs
RUN yum -y install git python make g++
RUN git config --global url."https://".insteadOf git://
COPY --chown=node:node ./saml-proxy/package.json package.json
COPY --chown=node:node ./saml-proxy/package-lock.json package-lock.json
RUN npm install

COPY ./common/certs/* /usr/local/share/ca-certificates/
RUN update-ca-certificates

COPY --chown=node:node ./saml-proxy ./
COPY --chown=node:node ./common /home/node/common

RUN cat /home/node/common/certs/*.pem > /home/node/common/certs/combined.pem
ENV NODE_EXTRA_CA_CERTS /home/node/common/certs/combined.pem

EXPOSE 7000 7000

RUN ./node_modules/.bin/tsc
HEALTHCHECK --interval=1m --timeout=4s \
  CMD wget localhost:7000/samlproxy/idp/metadata -q -O - > /dev/null 2>&1

RUN chown -r node:node /home/node 

USER node
CMD ["node", "build/app.js"]
