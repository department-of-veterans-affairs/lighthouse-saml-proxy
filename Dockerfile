FROM node:alpine

RUN mkdir /opt/app/
WORKDIR /opt/app/

RUN apk add git python make
RUN git config --global url."https://".insteadOf git://
ADD ./package.json package.json
ADD ./package-lock.json package-lock.json
RUN npm install

ADD ./ .

EXPOSE 7000 7000

RUN ./node_modules/.bin/tsc

ENTRYPOINT ["node", "build/app.js"]
