import { HttpConfig } from "../../api-server/HttpConfig";
import { HttpsConfig } from "../../api-server/HttpsConfig";
import { buildMainDependencyContainer, MainDependencyContainer } from "./daemon.deps";

export class Daemon {

    private constructor(
        private deps: MainDependencyContainer,
        shouldLog: boolean
    ) {
        this.deps.persistenceNodeApi.run()
        this.deps.loggerConfig.shouldLog = shouldLog;
     }

    static async build(shouldLog: boolean): Promise<Daemon> {
        const container = await buildMainDependencyContainer();

        return new Daemon(container.cradle, shouldLog);
    }

    async runApi(httpConfig: HttpConfig, httpsConfig: HttpsConfig) {
        await this.deps.ipfsGatewayApi.run(
            httpConfig,
            httpsConfig
        );
    }

    async listenForEvents() {
        await this.deps.cacheRunner.listenForEvents()
    }

    async runForPastBlocks(blocks: number) {
        await this.deps.cacheRunner.runForPastBlocks(blocks);
    }

    async runForMissedBlocks() {
        await this.deps.cacheRunner.runForMissedBlocks();
    }

    async processUnresponsive() {
        await this.deps.cacheRunner.processUnresponsive()
    }
}
