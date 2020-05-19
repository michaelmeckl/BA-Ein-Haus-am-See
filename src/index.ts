/* eslint-env node */
import Server from "./server/server";

const DEFAULT_PORT = 8000;

function init(): void {
  const appPort = Number(process.env.PORT || DEFAULT_PORT); // port to use for serving static files
  const server = new Server();
  server.start(appPort);
}

init();
