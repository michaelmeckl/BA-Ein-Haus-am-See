/* eslint-env node */
import Server from "./server/server";
import opn from "opn";

const DEFAULT_PORT = 8000;

function init(): void {
  const appPort = Number(process.env.PORT || DEFAULT_PORT); // port to use for serving static files
  const server = new Server();
  server.start(appPort);

  // open the website automatically
  opn(`http://localhost:${appPort}`);
}

init();
