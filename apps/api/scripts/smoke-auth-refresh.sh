#!/bin/sh
set -eu

API_URL="${API_URL:-http://localhost:3000}"
TEACHER_LOGIN="${TEACHER_LOGIN:-teacher1}"
TEACHER_PASSWORD="${TEACHER_PASSWORD:-Pass123!}"
COOKIE_JAR="/tmp/continuum_auth_smoke.cookies"
OLD_COOKIE_JAR="/tmp/continuum_auth_smoke.old.cookies"
BODY_FILE="/tmp/continuum_auth_smoke.body"

cleanup() {
  rm -f "$COOKIE_JAR" "$OLD_COOKIE_JAR" "$BODY_FILE"
}

expect_success() {
  status="$1"
  step="$2"
  if [ "$status" = "200" ] || [ "$status" = "201" ]; then
    echo "OK   $step ($status)"
    return 0
  fi
  echo "FAIL $step ($status)"
  [ -f "$BODY_FILE" ] && sed -n '1,5p' "$BODY_FILE"
  exit 1
}

expect_status() {
  status="$1"
  expected="$2"
  step="$3"
  if [ "$status" = "$expected" ]; then
    echo "OK   $step ($status)"
    return 0
  fi
  echo "FAIL $step (got $status, expected $expected)"
  [ -f "$BODY_FILE" ] && sed -n '1,5p' "$BODY_FILE"
  exit 1
}

extract_cookie_value() {
  cookie_name="$1"
  awk -v name="$cookie_name" '$6 == name {print $7}' "$COOKIE_JAR" | tail -n 1
}

login() {
  status=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" \
    -c "$COOKIE_JAR" \
    -X POST "$API_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"login\":\"$TEACHER_LOGIN\",\"password\":\"$TEACHER_PASSWORD\"}")
  expect_success "$status" "login"
}

cleanup
login
cp "$COOKIE_JAR" "$OLD_COOKIE_JAR"

access_cookie=$(extract_cookie_value "access_token")
refresh_cookie=$(extract_cookie_value "refresh_token")

if [ -z "$access_cookie" ] || [ -z "$refresh_cookie" ]; then
  echo "FAIL login cookies (missing access_token or refresh_token)"
  exit 1
fi
echo "OK   login cookies set"

status=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -b "$COOKIE_JAR" "$API_URL/auth/me")
expect_success "$status" "me after login"

status=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$API_URL/auth/refresh")
expect_success "$status" "refresh"

new_refresh_cookie=$(extract_cookie_value "refresh_token")
if [ -z "$new_refresh_cookie" ]; then
  echo "FAIL refresh cookie missing after refresh"
  exit 1
fi
if [ "$new_refresh_cookie" = "$refresh_cookie" ]; then
  echo "FAIL refresh rotation (cookie value unchanged)"
  exit 1
fi
echo "OK   refresh rotation"

status=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -b "$COOKIE_JAR" -X POST "$API_URL/auth/refresh" -H "Origin: https://evil.example")
expect_status "$status" "403" "refresh blocked by foreign origin"

status=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -b "$OLD_COOKIE_JAR" -X POST "$API_URL/auth/refresh")
expect_status "$status" "401" "replay old refresh token"

status=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -b "$COOKIE_JAR" -X POST "$API_URL/auth/refresh")
expect_status "$status" "401" "refresh after reuse detection"

login

status=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -b "$COOKIE_JAR" "$API_URL/debug/teacher-only")
expect_success "$status" "teacher-only endpoint"

status=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -b "$COOKIE_JAR" "$API_URL/debug/student-only")
expect_status "$status" "403" "student-only endpoint for teacher"

status=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -b "$COOKIE_JAR" -X POST "$API_URL/auth/logout" -H "Origin: https://evil.example")
expect_status "$status" "403" "logout blocked by foreign origin"

status=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$API_URL/auth/logout")
expect_success "$status" "logout"

status=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -b "$COOKIE_JAR" "$API_URL/auth/me")
expect_status "$status" "401" "me after logout"

echo "All refresh auth smoke checks passed."
cleanup
