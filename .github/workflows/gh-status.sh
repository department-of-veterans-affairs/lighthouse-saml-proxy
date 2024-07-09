#!/usr/bin/env bash
# Exit on error. Append "|| true" if you expect an error.
set -o errexit
# Exit on error inside any functions or subshells.
set -o errtrace
# Do not allow use of undefined vars. Use ${VAR:-} to use an undefined VAR
set -o nounset
# Catch the error in case mysqldump fails (but gzip succeeds) in `mysqldump |gzip`
set -o pipefail
# Turn on traces, useful while debugging but commented out by default
# set -o xtrace

usage() { 
	echo "Usage: $(basename "$0") [options]"
        echo "Options:
    		-r <repository>
    		-c <commit_hash>
		-x <build projects to exclude> : separated by comma e.g. check1,check2
		-o <repository owner> : defaults to department-of-veterans-affairs" 1>&2
}

err() {
  printf "$*" >&2
}

XBUILDS=""
OWNER="department-of-veterans-affairs"

# Verifies arguments
while getopts "hc:r:x:o:" o; do
    case "${o}" in
        c)
            COMMIT_HASH="${OPTARG:-}"
            ;;
        r)
            REPO="${OPTARG:-}"
            ;;
	x)
	    XBUILDS="${OPTARG}"
	    ;;
	o)
	    OWNER="${OPTARG}"
	    ;;
	h)
	   usage
	   exit
	   ;;
	:)
      	    echo "Option -$OPTARG requires an argument." >&2
            exit 1
	    ;;	
        *)
            echo "Illegal option: ${OPTARG:-}"$'\n'
            usage
	    exit 1
            ;;
     esac
done

shift $((OPTIND-1))


# GH CLI requires authorization prior to API calls
if  [[ -z "${GITHUB_TOKEN:-}" ]] ; then
  err "Please set environment variable for GITHUB_TOKEN." 
  exit 1
fi

# Required arguments
if [[ -z "${COMMIT_HASH:-}" ]] || [[ -z "${REPO:-}" ]]; then
    usage
    exit 1
fi

# Check for erroneous arguments
if [[ $# -ne 0 ]]; then
    err "Illegal number of arguments.\n"
    usage
    exit 1 
fi

build_filter () {
	# Builds CI filter from passing multiple jobs to xbuilds
	filter=""
	OLDIFS=$IFS
	IFS=','
	for buildjob in $XBUILDS; do
		# Not sure if we want to add this here or not. Problem this solves is matching on multiple checks with same name.
		# Codebuild anchors checks with () which gives us a exact match. We could instruct that as in put instead of adding the characters here.
		# ie. gh-status.sh -x (ci-1),(ci-2)
		# Triple \ needed for proper escape
		#filter="${filter} select(.context | test(\".*\\\(${buildjob}\\\).*\") | not ) |"
		filter="${filter} select(.context | test(\".*${buildjob}.*\") | not ) |"
	done
	IFS=$OLDIFS
	echo "${filter}"
}

status_check () {
	pending=0
	success=0
	checks=$( ci_status | jq -r ".statuses[] | $(build_filter) \"\(.context),\(.state)\"")
	OLDIFS=$IFS
	IFS=$'\n'$'\r'
	for check in ${checks}; do
		IFS=',' read context status <<< "${check}"
		if [[ ${status} == "pending" ]]; then 
			echo "${context} check is pending"
			((pending=pending+1))
		elif [[ ${status} == "success" ]]; then
			echo "${context} check is successful"
			((success=success+1))
		else
			echo "${context} failed! Status: ${status}"
			exit 1
		fi
	done
	IFS=$OLDIFS
}

ci_status () {
	status=$(gh api /repos/${OWNER}/${REPO}/commits/${COMMIT_HASH}/status)
	if [[ $? -eq 0 ]]; then
		echo ${status}
	else
		echo ${status} >&2 
		exit 1
	fi
}

loop_status () {
	count=0
	status_check
	while [[ ${pending} -gt 0 ]];
	do
		echo "${pending} pending check(s)... ${count}s"
		sleep 10s
		((count=count+10))
		status_check
	done
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
	loop_status
fi
