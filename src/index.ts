/* eslint-env node */
import Server from "./server/server";
import { Config } from "./shared/config";
//import open from "open";

function init(): void {
  const serverPort = Config.SERVER_PORT; // port to use for the express server and for serving static files
  const server = new Server(serverPort);
  server.start();

  // open the website automatically
  //open(`http://localhost:${serverPort}`);
}

init();
