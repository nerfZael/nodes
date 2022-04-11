#!/bin/sh
export NVM_DIR=$HOME/.nvm;
source $NVM_DIR/nvm.sh;

npm config set prefix '~/.npm-global'
echo "export PATH=~/.npm-global/bin:\$PATH" >> ~/.profile
source ~/.profile

pm2 delete persistence-node
pm2 delete ens-indexer-node-rinkeby
pm2 delete ens-indexer-node-ropsten

set -e

cd /home/ubuntu/hosting/polywrap/nodes/nodes/persistence-node
cp -r /home/ubuntu/staging/polywrap/nodes/nodes/persistence-node/bin ./
cp -r /home/ubuntu/staging/polywrap/nodes/nodes/persistence-node/node_modules ./

cd /home/ubuntu/hosting/polywrap/nodes/nodes/ens-contenthash-indexer-node
cp -r /home/ubuntu/staging/polywrap/nodes/nodes/ens-contenthash-indexer-node/bin ./
cp -r /home/ubuntu/staging/polywrap/nodes/nodes/ens-contenthash-indexer-node/node_modules ./

node /home/ubuntu/hosting/polywrap/nodes/nodes/ens-contenthash-indexer-node/bin/main.js init --data ./.data/rinkeby --log
node /home/ubuntu/hosting/polywrap/nodes/nodes/ens-contenthash-indexer-node/bin/main.js init --data ./.data/ropsten --log

node /home/ubuntu/hosting/polywrap/nodes/nodes/persistence-node/bin/main.js init --data ./.data --log

pm2 start /home/ubuntu/hosting/polywrap/nodes/nodes/ens-contenthash-indexer-node/bin/main.js --name ens-indexer-node-rinkeby -- daemon --data ./.data/rinkeby --port 8082 --log --from-block 10470682 --log
pm2 start /home/ubuntu/hosting/polywrap/nodes/nodes/ens-contenthash-indexer-node/bin/main.js --name ens-indexer-node-ropsten -- daemon --data ./.data/ropsten --port 8083 --log --from-block 10470682 --log

pm2 start /home/ubuntu/hosting/polywrap/nodes/nodes/persistence-node/bin/main.js --name persistence-node -- daemon --data ./.data --http 8081 --log

sudo env PATH=$PATH:/home/ubuntu/.nvm/versions/node/v16.13.0/bin /home/ubuntu/.npm-global/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

pm2 save