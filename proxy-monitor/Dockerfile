FROM node:8-alpine

RUN mkdir /opt/app/
WORKDIR /opt/app/

RUN apk add git
RUN git config --global url."https://".insteadOf git://
ADD ./package.json package.json
ADD ./package-lock.json package-lock.json
RUN npm install

ADD ./ .

EXPOSE 7200 7200
HEALTHCHECK --interval=1m --timeout=4s \
  CMD curl -f http://localhost:7200/health-check || exit 1

ENTRYPOINT ["node", "index.js"]
