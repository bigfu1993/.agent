#!/bin/sh
# Check the repeatable closing-report items that are easy to miss.
#
# Usage:
#   sh check-final-report.sh <project-root> [response-draft.md|-]
#
# Without a response draft, the script only prints source line counts and the
# manual checklist. With a response draft, it also checks the three required
# sections, phase percentage, and that section 3 does not mention push.
set -eu

usage() {
    cat <<'EOF'
Usage:
  sh check-final-report.sh <project-root> [response-draft.md|-]

Inputs:
  <project-root>        Repository root used for source line counts.
  [response-draft.md]   Optional final response draft to verify.
  [-]                   Read the response draft from stdin.

Checks:
  - source line counts for src implementation, module tests, and top-level tests
  - final response headings: 1. 执行结果 / 2. 阶段进度 / 3. 下一步建议
  - phase progress contains a percentage in section 2
  - section 3 does not mention push / 推送
EOF
}

if [ "${1:-}" = "--help" ]; then
    usage
    exit 0
fi

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    usage >&2
    exit 2
fi

project_root=$1
response_file=${2:-}
tmp_response=""
section_two=""
section_three=""

cleanup() {
    [ -z "$tmp_response" ] || rm -f "$tmp_response"
    [ -z "$section_two" ] || rm -f "$section_two"
    [ -z "$section_three" ] || rm -f "$section_three"
}
trap cleanup EXIT INT TERM

if [ ! -d "$project_root" ]; then
    echo "ERR project-root not found: $project_root" >&2
    exit 1
fi

count_c_lines() {
    root=$1
    kind=$2

    case "$kind" in
        implementation)
            [ -d "$root/src" ] || {
                printf "0\n"
                return
            }
            find "$root/src" -type f \( -name '*.c' -o -name '*.h' \) \
                -not -path '*/tests/*' -exec awk 'END { print NR }' {} + 2>/dev/null |
                awk '{ total += $1 } END { print total + 0 }'
            ;;
        module-tests)
            [ -d "$root/src" ] || {
                printf "0\n"
                return
            }
            find "$root/src" -type f \( -name '*.c' -o -name '*.h' \) \
                -path '*/tests/*' -exec awk 'END { print NR }' {} + 2>/dev/null |
                awk '{ total += $1 } END { print total + 0 }'
            ;;
        top-level-tests)
            [ -d "$root/tests" ] || {
                printf "0\n"
                return
            }
            find "$root/tests" -type f -name '*.c' \
                -exec awk 'END { print NR }' {} + 2>/dev/null |
                awk '{ total += $1 } END { print total + 0 }'
            ;;
        *)
            echo "ERR unknown line-count kind: $kind" >&2
            exit 2
            ;;
    esac
}

implementation_lines=$(count_c_lines "$project_root" implementation)
module_test_lines=$(count_c_lines "$project_root" module-tests)
top_level_test_lines=$(count_c_lines "$project_root" top-level-tests)
test_lines=$((module_test_lines + top_level_test_lines))
total_lines=$((implementation_lines + test_lines))

printf 'source-lines implementation=%s module-tests=%s top-level-tests=%s tests=%s total=%s\n' \
    "$implementation_lines" "$module_test_lines" "$top_level_test_lines" "$test_lines" "$total_lines"

if [ -z "$response_file" ]; then
    echo "response-check=skipped reason=no-response-file"
    echo "manual-check=need-refined-prompt-and-human-quality-review"
    exit 0
fi

if [ "$response_file" = "-" ]; then
    tmp_response=$(mktemp "${TMPDIR:-/tmp}/bigos-final-report.XXXXXX")
    cat > "$tmp_response"
    response_file=$tmp_response
elif [ ! -f "$response_file" ]; then
    echo "ERR response draft not found: $response_file" >&2
    exit 1
fi

heading_number_awk='
function heading_no(line, s) {
    s = line
    sub(/^[[:space:]]*#+[[:space:]]*/, "", s)
    sub(/^[[:space:]]*\*\*/, "", s)
    sub(/\*\*[[:space:]]*$/, "", s)
    if (s ~ /^[123][.] /) {
        return substr(s, 1, 1)
    }
    return ""
}
'

has_heading_number() {
    number=$1
    awk -v target="$number" "$heading_number_awk"'
{
    if (heading_no($0) == target) {
        found = 1
    }
}
END {
    exit found ? 0 : 1
}
' "$response_file"
}

extract_section() {
    number=$1
    awk -v target="$number" "$heading_number_awk"'
{
    h = heading_no($0)
    if (h != "") {
        in_section = (h == target)
        next
    }
    if (in_section) {
        print
    }
}
' "$response_file"
}

errors=0
check_ok() {
    echo "OK $*"
}
check_fail() {
    echo "ERR $*" >&2
    errors=$((errors + 1))
}

for number in 1 2 3; do
    if has_heading_number "$number"; then
        case "$number" in
            1) check_ok "heading 1. 执行结果" ;;
            2) check_ok "heading 2. 阶段进度" ;;
            3) check_ok "heading 3. 下一步建议" ;;
        esac
    else
        case "$number" in
            1) check_fail "missing heading 1. 执行结果" ;;
            2) check_fail "missing heading 2. 阶段进度" ;;
            3) check_fail "missing heading 3. 下一步建议" ;;
        esac
    fi
done

section_two=$(mktemp "${TMPDIR:-/tmp}/bigos-final-report-section2.XXXXXX")
section_three=$(mktemp "${TMPDIR:-/tmp}/bigos-final-report-section3.XXXXXX")
extract_section 2 > "$section_two"
extract_section 3 > "$section_three"

if grep -Eq '[0-9]+([.][0-9]+)?%' "$section_two"; then
    check_ok "phase progress percentage"
else
    check_fail "section 2 missing phase progress percentage"
fi

if grep -Eiq '(^|[^[:alnum:]_])(push|git push|推送)([^[:alnum:]_]|$)' "$section_three"; then
    check_fail "section 3 mentions push/推送; keep push out of next suggestions"
else
    check_ok "section 3 has no push suggestion"
fi

if [ "$errors" -ne 0 ]; then
    echo "response-check=failed errors=$errors" >&2
    exit 1
fi

echo "response-check=ok"
