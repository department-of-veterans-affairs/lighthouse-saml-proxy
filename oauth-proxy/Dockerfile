FROM node:8-alpine

RUN mkdir /opt/app/
WORKDIR /opt/app/

RUN apk add git
RUN git config --global url."https://".insteadOf git://
ADD ./package.json package.json
ADD ./package-lock.json package-lock.json
RUN npm install

ADD ./ .

EXPOSE 8080 8080
HEALTHCHECK --interval=1m --timeout=4s \
  CMD curl -f http://localhost:8080/.well-known/smart-configuration.json || exit 1

ENTRYPOINT ["node", "index.js"]
