#!/usr/bin/env bash
# This script is utilized to post slack messages based up on templates from the templates directory. Checkout the# README for more information on how to generate a template. 
#
# Exit on error. Append "|| true" if you expect an error.
set -o errexit
# Exit on error inside any functions or subshells.
set -o errtrace
# Do not allow use of undefined vars. Use ${VAR:-} to use an undefined VAR
set -o nounset
# Catch the error in case mysqldump fails (but gzip succeeds) in `mysqldump |gzip`
set -o pipefail
# Turn on traces, useful while debugging but commented out by default
#set -o xtrace

SLACK_CHANNEL=vaapi-cicd
TEMPLATE=general
DIRECTORY=${PWD}

usage() { echo "Usage: $(basename "$0") [options] <text>
Options:
    -c <slack channel>
    -w <webhook URL>
    -t <template>
    -d <template directory>
" 1>&2; exit 1; }

# Verifies arguments
while getopts ":c:w:t:d:" o; do
    case "${o}" in
        c)
            SLACK_CHANNEL="${OPTARG}"
            ;;
        w)
            SLACK_WEBHOOK="${OPTARG}"
            ;;
        t)
            TEMPLATE="${OPTARG}"
            ;;
	d)
            DIRECTORY="${OPTARG}"
	    ;;
        *)
            echo "Illegal option: ${OPTARG}"$'\n'
            usage
            ;;
     esac
done

# Verifies SLACK_WEBHOOK is defined
if [[ -z ${SLACK_WEBHOOK:-} ]]; then
    echo "No webhook URL specified. Please use the -w option."$'\n'
    usage
fi

shift $((OPTIND-1))

# Reads in the message.
message=$*
if [[ "${message}" == "" ]]; then
    if [ -t 0 ]; then
        echo "No text specified"$'\n'
	echo "Usage: $(basename "$0") [options] <text>"
    else
        while IFS= read -r line || [ -n "$line" ]; do
            message="${message}${line}"
        done
    fi
fi

# Checks the file exist
if [[ -f templates/${TEMPLATE}.json ]]; then
	template=templates/${TEMPLATE}.json
elif [[ -f /etc/slackpost/templates/${TEMPLATE}.json ]]; then
	template=/etc/slackpost/templates/${TEMPLATE}.json
elif [[ -f ${DIRECTORY}/${TEMPLATE}.json ]]; then
	template=${DIRECTORY}/${TEMPLATE}.json
else
	echo "template not found. Please place templates in /etc/slackpost/templates, local templates directory or specify directory with the -d argument. Also check for typos!"
	usage
	exit 1
fi

#Creates the JSON payload from the template.
slack_message=$(eval "echo '$(<${template})'")
# Posts to Slack
echo "$(curl --silent -X POST -H 'Content-type: application/json' --data "$slack_message" "$SLACK_WEBHOOK" 2>&1)"
