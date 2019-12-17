FROM node:8-alpine

RUN mkdir /opt/app/
WORKDIR /opt/app/

RUN apk add git
RUN git config --global url."https://".insteadOf git://
ADD ./package.json package.json
ADD ./package-lock.json package-lock.json
RUN npm install

ADD ./certs/* /usr/local/share/ca-certificates/
RUN update-ca-certificates

ADD ./ .

RUN cat certs/*.pem > certs/combined.pem
ENV NODE_EXTRA_CA_CERTS /opt/app/certs/combined.pem

EXPOSE 7100 7100
HEALTHCHECK --interval=1m --timeout=4s \
  CMD wget localhost:7100/oauth2/.well-known/openid-configuration -q -O - > /dev/null 2>&1

USER node
ENTRYPOINT ["node", "index.js"]
