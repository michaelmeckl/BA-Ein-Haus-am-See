/* eslint-env node */
import Server from "./server/server";
import { Config } from "./shared/config";
//import open from "open";

function init(): void {
  /*
  if ((module as any).hot) {
    (module as any).hot.accept(function (err: any) {
      console.log("An error occurred while accepting new version");
    });
  }*/

  const appPort = Config.SERVER_PORT; // port to use for the express server and for serving static files
  const server = new Server();
  server.start(appPort);

  // open the website automatically
  //open(`http://localhost:${appPort}`);
}

init();
