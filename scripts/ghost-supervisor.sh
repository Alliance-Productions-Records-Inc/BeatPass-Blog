#!/bin/bash
# Ghost CMS supervisor for blog.beatpass.ca
#
# Invoked by cron (@reboot and every minute). flock guarantees exactly one
# instance: extra invocations exit immediately, so this is safe to run as
# often as cron fires it. Ghost is restarted 10s after any exit.
#
# Operational notes:
#   - To take Ghost down for maintenance:  touch scripts/ghost-supervisor.stop
#     then kill the running "node start.js". The loop idles until the file is removed.
#   - Logs: scripts/ghost-supervisor.log (auto-truncated above ~50MB).
#   - Ghost's own request logs remain in content/logs/.
#   - The systemd user unit ghost-blog.service is intentionally disabled
#     (autostart symlink removed) so it never double-starts Ghost.
#
# 2026-08-19 - two fixes after a reboot left the blog down with nothing to
# recover it:
#
#   1. WAIT FOR MARIADB. @reboot fired this at the same second MariaDB started.
#      Ghost spent 347s failing to acquire connections ("Knex: Timeout
#      acquiring a connection") and then sat in maintenance mode. We now wait
#      for port 3306 before starting Ghost. Started after MariaDB is settled,
#      Ghost boots in seconds instead.
#
#   2. HEALTH WATCHDOG. The old loop only restarted Ghost if the PROCESS EXITED.
#      A Ghost that is alive but serving its 503 maintenance page - exactly what
#      happened - would stay broken forever. We now probe it once a minute and
#      restart it after 12 consecutive bad minutes. The threshold is deliberately
#      well above Ghost's ~6 minute cold-boot time on this HDD, so a slow boot is
#      never mistaken for a wedge.
DIR=/home/beatpass-blog-ssh/htdocs/blog.beatpass.ca
LOG="$DIR/scripts/ghost-supervisor.log"
STOP="$DIR/scripts/ghost-supervisor.stop"
exec 200>"$DIR/scripts/ghost-supervisor.lock"
flock -n 200 || exit 0
export NODE_ENV=production
export PATH=/home/beatpass-blog-ssh/.nvm/versions/node/v22.21.1/bin:/usr/local/bin:/usr/bin:/bin
cd "$DIR" || exit 1
echo "$(date -Is) supervisor started (pid $$)" >> "$LOG"

# Block until MariaDB accepts TCP, up to 5 minutes.
wait_for_db() {
  local i
  for i in $(seq 1 60); do
    if (exec 3<>/dev/tcp/127.0.0.1/3306) 2>/dev/null; then exec 3<&- 2>/dev/null; return 0; fi
    sleep 5
  done
  return 1
}

# Check during health probes too: a healthy long-running Ghost never exits the
# outer loop, so rotating only before startup lets this log grow without bound.
trim_log() {
  if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 52428800 ]; then
    : > "$LOG"
  fi
}

while true; do
  if [ -e "$STOP" ]; then sleep 30; continue; fi
  trim_log

  if wait_for_db; then
    echo "$(date -Is) MariaDB reachable; starting Ghost" >> "$LOG"
  else
    echo "$(date -Is) WARNING: MariaDB unreachable after 5m; starting Ghost anyway" >> "$LOG"
  fi

  node start.js >> "$LOG" 2>&1 &
  NODE_PID=$!

  # Health watchdog: kill a wedged-but-running Ghost so the loop restarts it.
  (
    unhealthy=0
    while kill -0 "$NODE_PID" 2>/dev/null; do
      sleep 60
      trim_log
      # curl already prints 000 on a connection failure; do NOT append another
      # via `|| echo 000` or the log reads "000000".
      code=$(curl -s -o /dev/null -m 20 -w '%{http_code}' http://127.0.0.1:2368/ 2>/dev/null)
      [ -z "$code" ] && code=000
      case "$code" in
        2*|3*) unhealthy=0 ;;
        *)     unhealthy=$((unhealthy+1)) ;;
      esac
      if [ "$unhealthy" -ge 12 ]; then
        echo "$(date -Is) health: HTTP $code for 12 consecutive checks; restarting Ghost" >> "$LOG"
        kill "$NODE_PID" 2>/dev/null
        sleep 20
        kill -9 "$NODE_PID" 2>/dev/null
        break
      fi
    done
  ) &
  WATCHDOG_PID=$!

  wait "$NODE_PID"; rc=$?
  kill "$WATCHDOG_PID" 2>/dev/null
  wait "$WATCHDOG_PID" 2>/dev/null

  echo "$(date -Is) ghost exited (code $rc); restarting in 10s" >> "$LOG"
  sleep 10
done
