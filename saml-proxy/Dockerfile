FROM node:8-alpine

RUN mkdir /opt/app/
WORKDIR /opt/app/

RUN apk add git python make g++
RUN git config --global url."https://".insteadOf git://
ADD ./package.json package.json
ADD ./package-lock.json package-lock.json
RUN npm install

ADD ./certs/* /usr/local/share/ca-certificates/
RUN update-ca-certificates
RUN cat certs/*.pem > certs/combined.pem
ENV NODE_EXTRA_CA_CERTS /opt/app/certs/combined.pem

ADD ./ .

EXPOSE 7000 7000

RUN ./node_modules/.bin/tsc
HEALTHCHECK --interval=1m --timeout=4s \
  CMD wget localhost:7000/samlproxy/idp/metadata -q -O - > /dev/null 2>&1

USER node
ENTRYPOINT ["node", "build/app.js"]
