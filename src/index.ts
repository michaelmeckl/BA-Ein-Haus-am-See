/* eslint-env node */
import Server from "./server/server";

function init(): void {
  const appPort = Number(process.env.PORT); // port to use for serving static files
  const server = new Server();
  server.start(appPort);
}

init();
