#!/bin/sh

if [ $# -eq 0 ]
  then
    echo "Please pass an output filename"
    exit 1
fi

exec &> csv/$1

node --max-old-space-size=4096 app.js --no_log_stdout --svc Maintainer --req export
