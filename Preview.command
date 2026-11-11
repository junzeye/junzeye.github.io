#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  print "Node.js is needed to preview the website. Install Node.js 18 or newer, then reopen this file."
  read "?Press Return to close."
  exit 1
fi
exec npm run dev -- --open
