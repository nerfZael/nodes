import { Logger } from "./Logger";
import { EnsIndexerConfig } from "../config/EnsIndexerConfig";
import { EnsStateManager } from "./EnsStateManager";
import { EthereumNetwork } from "./EthereumNetwork";
import { EnsConfig } from "../config/EnsConfig";
import { EnsIndexingService } from "./EnsIndexingService";

interface IDependencies {
  ensIndexerConfig: EnsIndexerConfig;
  ensConfig: EnsConfig;
  logger: Logger;
}

export class EnsIndexerApp {
  deps: IDependencies;
  ensStateManagers: EnsStateManager[];
  indexingNetworks: EthereumNetwork[];

  constructor(deps: IDependencies) {
    this.deps = deps;
    this.indexingNetworks = this.deps.ensConfig.networks.map(networkConfig => new EthereumNetwork(networkConfig));
    this.ensStateManagers = this.indexingNetworks.map(network => new EnsStateManager(network));
  }

  async run(fromBlock: number) {
    const tasks: Promise<void>[] = [];

    for(let i = 0; i < this.ensStateManagers.length; i++) {
      const ensStateManager = this.ensStateManagers[i];
      const network = this.indexingNetworks[i];
      await ensStateManager.load();

      const ensIndexingService = new EnsIndexingService(this.deps.ensIndexerConfig, ensStateManager, this.deps.logger);
      const indexingTask = ensIndexingService.startIndexing(fromBlock, network);
      tasks.push(indexingTask);
    }

    await Promise.all(tasks);
  }

  getIpfsHashes(): string[] {
    return this.ensStateManagers
      .map(ensStateManager => ensStateManager.getIpfsHashes())
      .flat();
  }

  containsIpfsHash(ipfsHash: string): boolean {
    return this.ensStateManagers
      .some(ensStateManager => ensStateManager.containsIpfsHash(ipfsHash));
  }
}