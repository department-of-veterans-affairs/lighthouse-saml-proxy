FROM node:8-alpine

RUN mkdir /opt/app/
WORKDIR /opt/app/

RUN apk add git
RUN git config --global url."https://".insteadOf git://
ADD ./package.json package.json
ADD ./package-lock.json package-lock.json
RUN npm install

ADD ./ .

EXPOSE 7100 7100
HEALTHCHECK --interval=1m --timeout=4s \
  CMD curl -f http://localhost:7100/oauth2/.well-known/openid-configuration || exit 1

ENTRYPOINT ["node", "index.js"]
