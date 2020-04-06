#!/usr/bin/env bash

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo >&2 "I require jq but it's not installed.  Aborting."; exit 1; }

usage() { echo "Usage: $(basename "$0") [options] <text>

Options:
    -d <extra details>
    -w <webhook URL>

" 1>&2; exit 1; }

json_escape () {
    printf '%s' "$1" | python -c 'import json,sys; print(json.dumps(sys.stdin.read()))'
}

details=""
while getopts ":d:w:" o; do
    case "${o}" in
        d)
            details="${OPTARG}"
            ;;
        w)
            SLACK_WEBHOOK="${OPTARG}"
            ;;
        *)
            echo "Illegal option: ${OPTARG}"$'\n'
            usage
            ;;
    esac
done
shift $((OPTIND-1))

if [[ "$SLACK_WEBHOOK" == "" ]]; then
    echo "No webhook URL specified. Please use the -w option."$'\n'
    usage
fi

text=$*
if [[ "$text" == "" ]]; then
    if [ -t 0 ]; then
        echo "No text specified"$'\n'
        usage
    else
        while IFS= read -r line || [ -n "$line" ]; do
            text="$text$line"
        done
    fi
fi

JSON_PAYLOAD_1=" \
{ \
    \"blocks\": [ \
        { \
			\"type\": \"section\", \
			\"text\": { \
				\"type\": \"mrkdwn\", \
				\"text\": \"$text\" \
			} \
        }\
"

JSON_PAYLOAD_2=""
if [[ -n $details ]]; then
    JSON_PAYLOAD_2=", \
            { \
                \"type\": \"divider\" \
            }, \
            { \
                \"type\": \"section\", \
                \"text\": { \
                    \"type\": \"mrkdwn\", \
                    \"text\": $(json_escape "\`\`\`$details\`\`\`") \
                } \
            } \
    "
fi

JSON_PAYLOAD_3="\
	] \
} \
"
JSON_PAYLOAD="$JSON_PAYLOAD_1$JSON_PAYLOAD_2$JSON_PAYLOAD_3"

echo "$(curl -s -X POST -H 'Content-type: application/json' --data "$JSON_PAYLOAD" "$SLACK_WEBHOOK" 2>&1)"
