#!/usr/bin/env bash
set -euo pipefail
# deploy container to ECS/Fargate
# args: $1 = ghVersion
#       $2 = name
#       $3 = friendly name (used in parameter store as /project/environment/friendly-name)
#       $4 = environment
#       $5 = environment (optional)
#       $6... = environment (optional)

command -v ecs >/dev/null 2>&1 || { echo >&2 "I require ecs-deploy but it's not installed.  Aborting."; exit 1; }
command -v cicd/slackpost.sh >/dev/null 2>&1 || { echo >&2 "I require slackpost.sh but it's not installed.  Aborting."; exit 1; }

TAG="${1}"
NAME="${2}"
FRIENDLY_NAME="${3}"

if [ $# -le 4 ]; then
  echo "Not enough parameters"
fi

for (( e=4; e <= $#; e++))
do
  # In this loop, the environment is ${!e}
  ENV="${!e}"
  # service is dvp-[ENVIRONMENT]-[NAME]
  SERVICE="dvp-${ENV}-${NAME}"
  # cluster is [ENVIRONMENT]_[NAME_WITH_UNDERSCORES]_cluster
  CLUSTER="${ENV}_${NAME//-/_}_cluster"
  case "${ENV}" in
    dev|staging)
      echo "Kicking off deploy of version ${TAG} of ${NAME} to ${ENV}..."
      # Notify slack of deploy
      cicd/slackpost.sh "Deploying ${TAG} of ${NAME} to ${ENV}..."
      # Deploy to each environment and set env vars for parameter store
      if ecs deploy \
           -t "${TAG}" \
           -e "${SERVICE}" CHAMBER_ENV "${ENV}" \
           -e "${SERVICE}" AWS_APP_NAME "${FRIENDLY_NAME}" \
           --timeout 1200 "${CLUSTER}" "${SERVICE}" \
           | tee "$SRC_DIR"/deploy_output.txt; then
        # Notify slack of success
        cicd/slackpost.sh "Deploy of version ${TAG} of ${NAME} to ${ENV} complete."
      else
        # Notify slack of failure
        cicd/slackpost.sh -d "$(cat "${SRC_DIR}"/deploy_output.txt)" "Deploy of version ${TAG} of ${NAME} to ${ENV} marked as failed."
        PROJECT=$(echo "${CODEBUILD_BUILD_ID}"|awk -F":" '{print $1}')
        BUILD=$(echo "${CODEBUILD_BUILD_ID}"|awk -F":" '{print $2}')
        cicd/slackpost.sh "<https://console.amazonaws-us-gov.com/codesuite/codebuild/projects/${PROJECT}/build/${PROJECT}%3A${BUILD}/log?region=${AWS_REGION}|CodeBuild Project>"
        exit 1
      fi
      ;;
    *)
      echo "Usage: deploy-to-ecs.sh ghVersion name friendly-name environment [environment...]"
      echo "Environment must be dev or staging, or both"
      ;;
  esac
done

