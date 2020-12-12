#!/usr/bin/env bash
# Team Pivot!

# Assertions 
EXPECT_STATUS=
EXPECT_JSON=
EXPECT_PROPERTY=
HAS_PROPERTY=
HAS_OR_EXPECT_PROPERTY=

# Arguments
STATUS=
JSON=
PROPERTY=
EXPECTED_STATUS=
EXPECTED_JSON=
EXPECTED_VALUE=

usage() {
cat <<EOF
Commands
  --expect-status [--status] [--expected-status]
      Compares status to expected-status.

  --expect-json [--json] [--expected-json] 
      Compares json to expected-json.

  --expect-property [--json] [--property] [--expected-value]
      Compares json property value to expected value.

  --has-property  [--json] [--property]
      Checks for json property.

  --has-or-expect-property [--json] [--property] [--expected-value]
      If expected-value is present, compares json property to expected-value. 
      If expected value is not present check for json property.

Example
  ./assertions.sh --expect-status=200 --status=200
EOF
exit 1
}

for i in "$@"
do
case $i in
    --expect-status)
      EXPECT_STATUS=1; shift ;;
    --expect-json)
      EXPECT_JSON=1; shift ;;
    --expect-property)
      EXPECT_PROPERTY=1; shift ;;
    --has-property)
      HAS_PROPERTY=1; shift ;;
    --has-or-expect-property)
      HAS_OR_EXPECT_PROPERTY=1; shift ;;
    --help|-h)
      usage; exit 1 ;;

    --status=*)
      STATUS="${i#*=}"; shift ;;
    --expected-status=*)
      EXPECTED_STATUS="${i#*=}"; shift ;;
    --json=*)
      JSON="${i#*=}"; shift ;;
    --expected-json=*)
      EXPECTED_JSON="${i#*=}"; shift ;;
    --expected-value=*)
      EXPECTED_VALUE="${i#*=}"; shift ;;
    --property=*)
      PROPERTY="${i#*=}"; shift ;;
    --) shift ; break ;;
    *) usage ; exit 1 ;;
esac
done

# Assertion functions 

#
# Compare the status ($1) with
# the status in file $curl_status
#
expect_status() {
  local expected="$EXPECTED_STATUS"
  local actual="$STATUS"

  if [ "$actual" != "$expected" ]; then
    echo "----"
    echo "FAIL:"
    echo "  actual:   $actual"
    echo "  expected: $expected"
    echo "----"
    return 1
  fi
  return 0
}

#
# Compare the JSON body ($1) with
# the JSON in file $curl_body
#
expect_json_body() {
  expected_body="$(mktemp)"
  echo "$EXPECTED_JSON" > "$expected_body"
  actual_body="$(mktemp)"
  echo "$JSON" > "$actual_body"

  if [[ -z "$JSON" ]] || [ "$(cmp <(jq -cS . "$actual_body") <(jq -cS . "$expected_body"))" ]; then
    echo "----"
    echo "FAIL:"
    echo "  actual:   $(jq -cS . "$expected_body")"
    echo "  expected: $(jq -cS . "$expected_body")"
    echo "----"
    return 1
  fi
  return 0
}

#
# Compare the JSON property ($1)
# from the file $curl_body to the
# expected value ($2)
#
expect_json_property() {
  local property="$PROPERTY"
  local expected_value="$EXPECTED_VALUE"

  local value
  value="$(echo "$JSON" | jq ".$property" | tr -d '"')"

  if [ "$value" != "$expected_value" ]; then
    echo "----"
    echo "FAIL:"
    echo "  actual:   $value"
    echo "  expected: $expected_value"
    echo "----"
    return 1
  fi
  return 0
}

#
# Will return true if JSON body has property ($1)
#
has_json_property() {
  local property="$PROPERTY"
  local value=
  value="$(echo "$JSON" | jq ".$property" | tr -d '"')"

  if [[ -z "$value" ]] || [ "$value" = "null" ]; 
  then
    echo "----"
    echo "FAIL:"
    echo "  could not find property:   $property"
    echo "----"
  fi
}

#
# Given only a property ($1), will check JSON for property.
# Given a property and value ($2), will check if JSON property  matches value.
#
has_or_expect_property() {
  if [[ -z $EXPECTED_VALUE ]];
  then
    has_json_property 
  else
    expect_json_property
  fi
}
# -------

# CLI logic

if [[ "$EXPECT_STATUS" -gt 0 ]]
then
  expect_status 
  exit $?
fi

if [[ EXPECT_JSON -gt 0 ]]
then
  expect_json_body
  exit $?
fi

if [[ EXPECT_PROPERTY -gt 0 ]]
then
  expect_json_property
  exit $?
fi

if [[ HAS_PROPERTY -gt 0 ]]
then
  has_json_property
  exit $?
fi

if [[ HAS_OR_EXPECT_PROPERTY -gt 0 ]]
then
  has_or_expect_property
  exit $?
fi

# -------