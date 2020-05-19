/* eslint-env node */
import express from "express";
import path from "path";

const staticDir = path.join(__dirname, "../", "public"); // folder with client files

//TODO: use webpack later?
export default class Server {
  private app = express();

  constructor() {
    // serve front-end content
    this.app.use(express.static(staticDir));

    // Default every route to serve the index.html
    this.app.get("*", (req, res) => {
      res.sendFile("index.html", { root: staticDir });
    });
  }

  start(port: number): void {
    this.app.listen(port, (err) => {
      if (err) {
        return console.error(err);
      }

      return console.log(
        `Server started. Client available at http://localhost:${port}`
      );
    });
  }

  /*
  stop(): void {
    if (this.server === undefined) {
      return;
    }
    this.server.close();
  }
  */
}
