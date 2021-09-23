#!/usr/bin/env bash

REPO=$(cd $(dirname $0)/../.. && pwd)

#
# Test for git-secrets
#
git secrets 2>&1 | grep "is not a git command" > /dev/null
[ $? == 0 ] && echo -e "git secrets is not installed\nSee https://github.com/awslabs/git-secrets" && exit 1

git secrets --install --force
git secrets --register-aws
git secrets --add-provider -- cat $REPO/.git-secrets-patterns
