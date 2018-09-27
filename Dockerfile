FROM node:alpine

RUN apk add git
ADD ./package.json package.json
ADD ./package-lock.json package-lock.json
RUN npm install -g bower
RUN npm install

ADD ./bower.json bower.json
RUN bower install --allow-root
ADD ./ .

EXPOSE 7000 7000

RUN ./node_modules/.bin/tsc

ENTRYPOINT ["node", "build/app.js"]
