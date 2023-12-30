# Prepare

git clone ..
cd anserliquid
bash prepare.sh

# Test

npm run start

# Build

BUILD_MODE="production" npm run build

# Docker

docker build -t anserliquid .

docker run -it \
--rm \
--name="anserliquid" \
--read-only \
--tmpfs /data \
--tmpfs /tmp \
--tmpfs /config \
-p 8080:80 \
anserliquid
