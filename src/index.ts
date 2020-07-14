/* eslint-env node */
import Server from "./server/server";
import { Config } from "./shared/config";

function init(): void {
  const appPort = Config.SERVER_PORT; // port to use for the express server
  const server = new Server();
  server.start(appPort);
}

init();
