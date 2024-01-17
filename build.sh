#!/bin/bash
NODE_ENV="development"
BUILD_MODE="production"
bash prepare.sh
npm run build

if [ "$GITHUB_REF" != "" ];
then
    version="`if [[ $GITHUB_REF == refs\/tags* ]]; then echo ${GITHUB_REF//refs\/tags\//}; fi`"
    if [ "$version" != "" ];
    then
        echo "$version" > ./dist/version.txt
        echo "$version" > ./dist/app/version.txt
    fi
fi
