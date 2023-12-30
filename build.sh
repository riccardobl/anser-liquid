#!/bin/bash
NODE_ENV="development"
BUILD_MODE="production"
bash prepare.sh
npm run build
