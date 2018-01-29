#!/bin/sh

if [ $# -eq 0 ]
  then
    echo "Please pass an output filename"
    exit 1
fi

exec &> csv/$1

node app.js --svc Maintainer --req export
