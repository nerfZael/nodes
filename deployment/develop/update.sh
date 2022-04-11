#!/bin/sh
staging=~/staging
hosting=~/hosting
data=~/data

persistenceNode=polywrap/nodes/nodes/persistence-node
ensIndexerNode=polywrap/nodes/nodes/ens-contenthash-indexer-node
persistenceNodePort=8081
ensIndexerNodeRinkebyPort=8082
ensIndexerNodeRopstenPort=8083
startingBlock=10470682

export NVM_DIR=$HOME/.nvm;
source $NVM_DIR/nvm.sh;

npm config set prefix '~/.npm-global'
echo "export PATH=~/.npm-global/bin:\$PATH" >> ~/.profile
source ~/.profile

pm2 delete persistence-node
pm2 delete ens-indexer-node-rinkeby
pm2 delete ens-indexer-node-ropsten

set -e

cd $hosting/$persistenceNode
cp -r $staging/$persistenceNode/bin ./
cp -r $staging/$persistenceNode/node_modules ./

cd $hosting/$ensIndexerNode
cp -r $staging/$ensIndexerNode/bin ./
cp -r $staging/$ensIndexerNode/node_modules ./

node $hosting/$persistenceNode/bin/main.js init --data $data/persistence-node --log
node $hosting/$ensIndexerNode/bin/main.js init --data $data/ens-indexer-node/rinkeby --network rinkeby --log
node $hosting/$ensIndexerNode/bin/main.js init --data $data/ens-indexer-node/ropsten --network ropsten --log

pm2 start $hosting/$persistenceNode/bin/main.js --name persistence-node -- daemon --data $data/persistence-node --http $persistenceNodePort --log
pm2 start $hosting/$ensIndexerNode/bin/main.js --name ens-indexer-node-rinkeby -- daemon --data $data/ens-indexer-node/rinkeby --port $ensIndexerNodeRinkebyPort --log --from-block $startingBlock --log
pm2 start $hosting/$ensIndexerNode/bin/main.js --name ens-indexer-node-ropsten -- daemon --data $data/ens-indexer-node/ropsten --port $ensIndexerNodeRopstenPort --log --from-block $startingBlock --log

pm2 save