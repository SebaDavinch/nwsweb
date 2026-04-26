#!/bin/bash
# Production deploy script for the vnws.org site and API pair.

set -euo pipefail

REMOTE_HOST=${REMOTE_HOST:-your.server.example}
REMOTE_USER=${REMOTE_USER:-deploy}
REMOTE_DIR=${REMOTE_DIR:-/var/www/nws}
API_SERVICE=${API_SERVICE:-nwsweb-api}
SITE_SERVICE=${SITE_SERVICE:-nwsweb-site}
NGINX_SERVICE=${NGINX_SERVICE:-nginx}

echo "Building frontend..."
npm run build

echo "Uploading dist to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/dist"
rsync -avz --delete dist/ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/dist/

echo "Uploading server files"
rsync -avz --delete server/ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/server/
rsync -avz --delete deploy/prod/ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/deploy/prod/
rsync -avz package.json package-lock.json ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/
rsync -avz .env ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/.env

echo "Installing production dependencies and restarting services"
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo mkdir -p ${REMOTE_DIR}/data && sudo chown -R www-data:www-data ${REMOTE_DIR}/data && cd ${REMOTE_DIR} && npm ci --omit=dev && sudo systemctl daemon-reload && sudo systemctl restart ${API_SERVICE} ${SITE_SERVICE} && sudo systemctl reload ${NGINX_SERVICE}"

echo "Done."
