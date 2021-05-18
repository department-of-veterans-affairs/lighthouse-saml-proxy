FROM docker:latest

COPY /tests/bats /bats
COPY /entrypoint_test.sh /bats/entrypoint_test.sh

RUN apk update

RUN apk add jq \
    bash \
    curl \
    bats
  
WORKDIR /bats

ENTRYPOINT [ "./entrypoint_test.sh" ]