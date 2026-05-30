#!/bin/bash
set -e

# Copy certs to a local dir and fix permissions
mkdir -p /tmp/certs
cp /certs/server.crt /tmp/certs/
cp /certs/server.key /tmp/certs/
chown postgres:postgres /tmp/certs/server.*
chmod 600 /tmp/certs/server.key

# Run the original entrypoint with SSL args
exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tmp/certs/server.crt -c ssl_key_file=/tmp/certs/server.key
