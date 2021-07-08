FROM vasdvp/lighthouse-node-application-base:node16

WORKDIR /home/node

RUN git config --global url."https://".insteadOf git://
COPY --chown=node:node package.json package.json
COPY --chown=node:node package-lock.json package-lock.json
RUN npm install


COPY --chown=node:node ./ ./

EXPOSE 7000 7000

RUN ./node_modules/.bin/tsc
HEALTHCHECK --interval=1m --timeout=4s --start-period=30s \
  CMD curl -f http://localhost:7000/samlproxy/idp/metadata || exit 1

USER node
ENTRYPOINT ["/usr/local/bin/tini", "--"]
CMD ["node", "build/app.js"]
