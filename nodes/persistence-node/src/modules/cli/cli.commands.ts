import { program } from "commander";
import { CliModule } from "./cli.module";

export function initializeCliCommands() {
  program
    .command("info")
    .description("Display useful information about the current state (pinned hash count, unresponsive count, etc)")
    .action(async (options) => {

      const cli = await CliModule.build(!!options.log);
      await cli.getInfo();

      process.exit(0);
    });

  program
    .command("reset")
    .description("Delete the storage file")
    .action(async (options) => {

      const cli = await CliModule.build(!!options.log);
      await cli.resetStorage();

      process.exit(0);
    });
}