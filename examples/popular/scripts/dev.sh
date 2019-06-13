#!/usr/bin/env bash
{
  rm -rf dist && mkdir dist
  echo '#!/usr/bin/env ts-node
  require("../src/index")' > ./dist/bin.js && \
  yarn unlink; yarn link && \
  chmod +x ./dist/bin.js
} > /dev/null

echo 'linked. run <hello> to start.'
