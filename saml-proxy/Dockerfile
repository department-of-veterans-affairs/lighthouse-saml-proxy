FROM node:8-alpine

RUN mkdir /opt/app/
WORKDIR /opt/app/

RUN apk add git python make g++
RUN git config --global url."https://".insteadOf git://
ADD ./package.json package.json
ADD ./package-lock.json package-lock.json
RUN npm install

ADD ./ .

EXPOSE 7000 7000

RUN ./node_modules/.bin/tsc
HEALTHCHECK --interval=1m --timeout=4s \
  CMD curl -f http://localhost:7000/samlproxy/idp/metadata || exit 1

USER node
ENTRYPOINT ["node", "build/app.js"]
