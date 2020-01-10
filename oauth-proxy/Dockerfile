FROM node:8-alpine

RUN mkdir /opt/app/
WORKDIR /opt/app/

RUN apk add git
RUN git config --global url."https://".insteadOf git://
ADD ./oauth-proxy/package.json package.json
ADD ./oauth-proxy/package-lock.json package-lock.json
RUN npm install

ADD ./oauth-proxy/certs/* /usr/local/share/ca-certificates/
RUN update-ca-certificates

ADD ./oauth-proxy .
ADD ./common ../common

RUN cat certs/*.pem > certs/combined.pem
ENV NODE_EXTRA_CA_CERTS /opt/app/certs/combined.pem

EXPOSE 7100 7100
HEALTHCHECK --interval=1m --timeout=4s \
  CMD wget localhost:7100/oauth2/.well-known/openid-configuration -q -O - > /dev/null 2>&1

USER node
ENTRYPOINT ["node", "index.js"]
