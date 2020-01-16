FROM node:12-alpine

RUN mkdir /opt/app/
WORKDIR /opt/app/

RUN apk add git python make g++
RUN git config --global url."https://".insteadOf git://
ADD ./saml-proxy/package.json package.json
ADD ./saml-proxy/package-lock.json package-lock.json
RUN npm install

ADD ./common/certs/* /usr/local/share/ca-certificates/
RUN update-ca-certificates

ADD ./saml-proxy ./
ADD ./common ../common

RUN cat ../common/certs/*.pem > ../common/certs/combined.pem
ENV NODE_EXTRA_CA_CERTS /opt/common/certs/combined.pem

EXPOSE 7000 7000

RUN ./node_modules/.bin/tsc
HEALTHCHECK --interval=1m --timeout=4s \
  CMD wget localhost:7000/samlproxy/idp/metadata -q -O - > /dev/null 2>&1

USER node
ENTRYPOINT ["node", "build/app.js"]
