import config from "./config.json";

export class LoggerConfig {
  loggerEnabled = !!config.persistenceNode.loggerEnabled;
}
