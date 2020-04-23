CICD Workflow


## CICD scripts are included in the Docker image used for the Codebuild job: vasdvp/lighthouse-codebuild-dsva-fargate:latest
- /usr/local/bin/increment.sh
  - smart incrementer for version numbers
- /usr/local/bin/tag_containers.py
  - tags container <commitId> in ECR with a <version> tag
- /usr/local/bin/deploy_to_ecs.sh
  - deploys new containers to ECS/Fargate
- /usr/local/bin/slackpost.sh
  - Handles slack notifications


## CI (https://console.amazonaws-us-gov.com/codesuite/codebuild/projects/oauth-proxy-ci/history?region=us-gov-west-1)
- Codebuild CI job at /buildspec.yml runs on every code push to the repository
  - uses the pre-built environment from Codebuild
  - uses docker 18 runtime
  - prebuild (failure fails entire job)
    - installs AWS CLI
    - builds the CI Docker image (docker build --target base)
    - lints the code
    - runs the CI tests
    - copies the junit reporter results to the pwd (currently govcloud reports are not working)
  - build (failure does not fail job)
    - builds the Docker image (docker build --target prod)
    - tags the image with the current commit ID
  - post_build
    - pushes the Docker image to ECR

## Release/Deploy (https://console.amazonaws-us-gov.com/codesuite/codebuild/projects/oauth-proxy-release/history?region=us-gov-west-1)
- when PR is merged to master, it will trigger cicd/buildspec-release.yml in Codebuild for the project dev-portal-backend-release.
  - Uses the vasdvp/lighthouse-codebuild-dsva-fargate image
    - cicd/buildspec-release.yml
    - pre_build
      - logs into ECR
      - creates a new release in Github by naively incrementing the last digit of the version (configurable behavior in cicd/increment.sh)
      - tags the ECR image that matches the current git commit ID
      - uses tag_containers.py which will wait on a CI build if necessary
    - build
      - deploy script is triggered to lower environments for CD
      - deploy_to_ecs.sh 
        - configurable for allowed environments

## Manual Deploy (https://console.amazonaws-us-gov.com/codesuite/codebuild/projects/saml-proxy-manual-deploy/history?region=us-gov-west-1)
- Arbitrary deploys of a revision can be accomplished with the Manual deploy job.
  - DEPLOY_ENVS
    - Set DEPLOY_ENVS to a space separated list of environments you would like to deploy to, i.e.: `prod staging`
  - DEPLOY_TAG
    - Set DEPLOY_TAG to the version tag in github you wish to deploy.
- Defaults: DEPLOY_ENVS = 'prod'
            DEPLOY_TAG = most recent tag created in github (git tag|sort --version-sort|tail -1)
