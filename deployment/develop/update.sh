#!/bin/sh
staging=/home/staging
hosting=/home/hosting

persistenceNode=polywrap/nodes/nodes/persistence-node
ensIndexerNode=polywrap/nodes/nodes/ens-contenthash-indexer-node

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

node $hosting/bin/main.js init --data ./.data/rinkeby --network rinkeby --log
node $hosting/bin/main.js init --data ./.data/ropsten --network ropsten --log

node $hosting/$persistenceNode/bin/main.js init --data ./.data --log

pm2 start $hosting/$persistenceNode/bin/main.js --name persistence-node -- daemon --data ./.data --http 8081 --log

pm2 start $hosting/$ensIndexerNode/bin/main.js --name ens-indexer-node-rinkeby -- daemon --data ./.data/rinkeby --port 8082 --log --from-block 10470682 --log
pm2 start $hosting/$ensIndexerNode/bin/main.js --name ens-indexer-node-ropsten -- daemon --data ./.data/ropsten --port 8083 --log --from-block 10470682 --log

sudo env PATH=$PATH:/home/ubuntu/.nvm/versions/node/v16.13.0/bin /home/ubuntu/.npm-global/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

pm2 save