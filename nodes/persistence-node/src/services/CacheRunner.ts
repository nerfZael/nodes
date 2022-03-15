import { ethers } from "ethers";
import { getPastContenthashChanges } from "../getPastContenthashChanges";
import { getIpfsHashFromContenthash } from "../getIpfsHashFromContenthash";
import { Storage } from "../types/Storage";
import { isWrapper } from "../isWrapper";
import * as IPFS from 'ipfs-core';
import { pinCid } from "../pinCid";
import { unpinCid } from "../unpinCid";
import { toShortString } from "../toShortString";
import { IpfsConfig } from "../config/IpfsConfig";
import { Logger } from "./Logger";
import { ProcessEnsIpfsResult } from "../types/ProcessEnsIpfsResult";

interface IDependencies {
  ethersProvider: ethers.providers.Provider;
  ensPublicResolver: ethers.Contract;
  storage: Storage;
  ipfsNode: IPFS.IPFS;
  ipfsConfig: IpfsConfig;
  logger: Logger;
}

export class CacheRunner {
  deps: IDependencies;

  constructor(deps: IDependencies) {
    this.deps = deps;
  }

  //TODO: runned missed events while updating
  async runForPastBlocks(blockCnt: number) {
    const latestBlock = await this.deps.ethersProvider.getBlockNumber();

    if(blockCnt !== 0) {
      this.deps.logger.log("Processing past blocks...");

      await this.processPastBlocks(latestBlock - blockCnt);
    }
  }

  async runForMissedBlocks() {
    this.deps.logger.log("Processing missed blocks...");
  
    await this.processPastBlocks(this.deps.storage.lastBlockNumber);
  }

  async listenForEvents() {
    this.deps.logger.log("Listening for events...");
  
    this.deps.ensPublicResolver.on("ContenthashChanged", async (ensNode: string, contenthash: string, event: any) => {
      
      if (Object.keys(this.deps.storage.unresponsiveEnsNodes).includes(ensNode)) {
        this.deps.logger.log(`Ens domain already included in unresponsive list (${Object.keys(this.deps.storage.unresponsiveEnsNodes).length})`);
        return;
      }

      this.deps.logger.log("----------------------------------------------");
      await this.processEnsIpfs(ensNode, getIpfsHashFromContenthash(contenthash));

      this.deps.storage.lastBlockNumber = event.blockNumber - 1;
      await this.deps.storage.save();
      this.deps.logger.log("----------------------------------------------");
    });
  }

  async processPastBlocks(blockNumber: number) {    
    const resp = await getPastContenthashChanges(
      this.deps.ethersProvider, 
      this.deps.ensPublicResolver, 
      blockNumber
    );

    await this.processEnsNodes(resp.results.map(x => x.ensNode));

    this.deps.storage.lastBlockNumber = resp.toBlock;
    await this.deps.storage.save();
  }
  
  async processEnsIpfs(ensNode: string, ipfsHash: string | undefined): Promise<ProcessEnsIpfsResult> {
    const ensIpfsCache = this.deps.storage.ensIpfs;
    const ipfsEnsCache = this.deps.storage.ipfsEns;

    if (!ipfsHash) {
      const savedIpfsHash = ensIpfsCache[ensNode];

      if (savedIpfsHash) {
        this.deps.logger.log("ENS no longer points to an IPFS hash");
        this.deps.logger.log("Unpinning...");

        const success = await unpinCid(this.deps.ipfsNode, this.deps.ipfsConfig, savedIpfsHash);
        
        if (success) {
          if (ipfsEnsCache[savedIpfsHash]) {
            delete ipfsEnsCache[savedIpfsHash];
          }

          delete ensIpfsCache[ensNode];

          this.deps.logger.log("Unpinned successfully");
          return ProcessEnsIpfsResult.Unpinned;
        } else {
          this.deps.logger.log("Unpinning failed");
          this.deps.storage.unresponsiveEnsNodes[ensNode] = true;
          this.deps.logger.log(`Added ${toShortString(ensNode)} to unresponsive list (${Object.keys(this.deps.storage.unresponsiveEnsNodes).length})`);
          return ProcessEnsIpfsResult.Error;
        }
      } else {
        this.deps.logger.log("Nothing changed");
        return ProcessEnsIpfsResult.NothingChanged;
      }
    }
    
    if (!ipfsEnsCache[ipfsHash]) {
      this.deps.logger.log(`Checking if ${ipfsHash} is a wrapper`);

      const resp = await isWrapper(this.deps.ipfsNode, this.deps.ipfsConfig, this.deps.logger, ipfsHash);

      if (resp === "no") {
        this.deps.logger.log("IPFS hash is not a valid wrapper");
        return ProcessEnsIpfsResult.NothingChanged;
      } else if (resp === "timeout") {
        this.deps.storage.unresponsiveEnsNodes[ensNode] = true;
        this.deps.logger.log(`Added ${toShortString(ensNode)} to unresponsive list (${Object.keys(this.deps.storage.unresponsiveEnsNodes).length})`);
        return ProcessEnsIpfsResult.Error;
      }

      const success = await pinCid(this.deps.ipfsNode, this.deps.ipfsConfig, ipfsHash);  

      if (!success) {
        this.deps.logger.log("Pinning failed");
        this.deps.storage.unresponsiveEnsNodes[ensNode] = true;
        this.deps.logger.log(`Added ${toShortString(ensNode)} to unresponsive list (${Object.keys(this.deps.storage.unresponsiveEnsNodes).length})`);
        return ProcessEnsIpfsResult.Error;
      }

      ipfsEnsCache[ipfsHash] = ensNode;
      ensIpfsCache[ensNode] = ipfsHash;

      return ProcessEnsIpfsResult.Pinned;
    } else {
      this.deps.logger.log(`${ipfsHash} is already pinned`);
      return ProcessEnsIpfsResult.NothingChanged;
    }
  }

  async processEnsNodes(nodes: string[]) {
    const ensNodes = [...new Set(nodes)];

    this.deps.logger.log(`Found ${ensNodes.length} eligible ENS domains`);

    if(!ensNodes.length) {
      return;
    }

    this.deps.logger.log(`Pinning...`);
    let pinnedCnt = 0;
    let unresponsiveCnt = 0;

    for (let i = 0; i < ensNodes.length; i++) {
      const ensNode = ensNodes[i];

      if (Object.keys(this.deps.storage.unresponsiveEnsNodes).includes(ensNode)) {
        this.deps.logger.log(`Ens domain already included in unresponsive list (${Object.keys(this.deps.storage.unresponsiveEnsNodes).length})`);
        continue;
      }

      this.deps.logger.log("----------------------------------------------");
      this.deps.logger.log(`Retrieving contenthash for ${toShortString(ensNode)} (${i+1}/${ensNodes.length})`);
      
      try {
        const contenthash = await this.deps.ensPublicResolver.contenthash(ensNode);
        const ipfsHash = getIpfsHashFromContenthash(contenthash);
  
        this.deps.logger.log("Retrieved IPFS hash for ENS domain");
        const status = await this.processEnsIpfs(ensNode, ipfsHash);

        if (status === ProcessEnsIpfsResult.Pinned) {
          pinnedCnt++;
        }
        if (status === ProcessEnsIpfsResult.Error) {
          unresponsiveCnt++;
        }
      } catch(ex) {
        this.deps.storage.unresponsiveEnsNodes[ensNode] = true;
        unresponsiveCnt++;
        this.deps.logger.log(`Added ${toShortString(ensNode)} to unresponsive list (${Object.keys(this.deps.storage.unresponsiveEnsNodes).length})`);
        this.deps.logger.log("Error retrieving contenthash");
        this.deps.logger.log(JSON.stringify(ex));
      }
      await this.deps.storage.save();
      this.deps.logger.log(`${pinnedCnt} newly pinned nodes`);
      this.deps.logger.log(`${unresponsiveCnt} new unresponsive nodes`);
      this.deps.logger.log("----------------------------------------------");
    }

    this.deps.logger.log(`Finished processing ${ensNodes.length} ENS domains`);
    this.deps.logger.log(`${Object.keys(this.deps.storage.ipfsEns).length} pinned IPFS hashes`);

    this.deps.logger.log(`${Object.keys(this.deps.storage.unresponsiveEnsNodes).length} unresponsive domains/ipfs hashes`);
  }
}