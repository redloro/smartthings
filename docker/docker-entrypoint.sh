#!/bin/bash

cd /stnp

for plugin in "$ENABLED_PLUGINS"; do
 if [[ -f ./avail_plugins/${plugin}.js ]]; then
   cp ./avail_plugins/${plugin}.js ./plugins/
 fi
done

#$NODE ./server.js
npm run start
