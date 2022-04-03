import config from "./config.json";

export interface EnsNetworkConfig {
  network: string,
  ResolverAddr: string
  ResolverAbi: string[]
}

export class EnsConfig {
  networks = mapNetworksFromConfig();
}

function mapNetworksFromConfig() {
  return config.ensIndexer.networks.map(network => {
    return {
      network: network.network,
      ResolverAddr: network.ensResolverAddress,
      ResolverAbi: [
        "function contenthash(bytes32 node) external view returns (bytes memory)",
        "event ContenthashChanged(bytes32 indexed node, bytes hash)"
      ]
    };
  });
}
