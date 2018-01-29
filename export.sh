#!/bin/sh
exec &> csv/$1
node app.js --svc Maintainer --req export
