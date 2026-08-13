#!/bin/sh
set -eu

skill_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
script="$skill_dir/scripts/check-final-report.sh"
project_root=${1:-/Users/bigfu/code/bigOS}

fail() {
    echo "ERR $*" >&2
    exit 1
}

run_good_stdin() {
    output=$(printf '%s\n' \
        '**1. 执行结果**' \
        '1. ok' \
        '**2. 阶段进度**' \
        '- 进度百分比：1%' \
        '**3. 下一步建议**' \
        '1. ok' | sh "$script" "$project_root" -)
    printf '%s\n' "$output" | grep -F 'response-check=ok' >/dev/null || fail 'valid stdin draft should pass'
}

run_empty_stdin_fails() {
    if output=$(printf '' | sh "$script" "$project_root" - 2>&1); then
        printf '%s\n' "$output" >&2
        fail 'empty stdin should fail instead of being treated as a malformed draft'
    fi
    printf '%s\n' "$output" | grep -F 'ERR stdin response draft is empty' >/dev/null || fail 'empty stdin error should be explicit'
}

run_unclosed_stdin_times_out() {
    fifo=$(mktemp -u "${TMPDIR:-/tmp}/bigos-final-report-test-fifo.XXXXXX")
    mkfifo "$fifo"
    cleanup() {
        rm -f "$fifo" "$fifo.out"
        [ -z "${writer_pid:-}" ] || kill "$writer_pid" 2>/dev/null || true
    }
    trap cleanup EXIT INT TERM

    (
        exec 3> "$fifo"
        printf '%s\n' '**1. 执行结果**' >&3
        sleep 6
        exec 3>&-
    ) &
    writer_pid=$!

    if BIGOS_FINAL_REPORT_STDIN_TIMEOUT=1 sh "$script" "$project_root" - < "$fifo" > "$fifo.out" 2>&1; then
        cat "$fifo.out" >&2
        fail 'unclosed stdin should time out instead of hanging'
    fi
    grep -F 'ERR stdin response draft did not finish within 1s' "$fifo.out" >/dev/null || fail 'timeout error should be explicit'
}

run_good_stdin
run_empty_stdin_fails
run_unclosed_stdin_times_out

echo 'check-final-report tests passed'
