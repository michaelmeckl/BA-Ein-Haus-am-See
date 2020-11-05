/* eslint-env node */
import bodyParser from "body-parser";
import compression from "compression";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status-codes";
import path from "path";
import LoggingRouter from "./loggingRouter";
import OsmRouter from "./osmRouter";

// handle crashes
process.on("uncaughtException", (e) => {
  console.log(e);
  process.exit(1);
});

process.on("unhandledRejection", (e) => {
  console.log(e);
  process.exit(1);
});

const staticDir = path.join(__dirname, "../", "app"); // folder with client files
const publicDir = path.join(__dirname, "../../", "public"); // folder with static files

export default class Server {
  // Init express
  private readonly app: express.Application = express();

  constructor() {
    this.setupExpressApp();

    // serve front-end content
    //! actually it would be better for performance not to send it from the node server as it is single-threaded
    this.app.use(express.static(publicDir));
    this.app.use(express.static(staticDir));

    this.setupRoutes();

    // error handling must be at the end!
    this.setupErrorHandling();
  }

  setupExpressApp(): void {
    //compress all routes to improve performance
    this.app.use(compression());

    // add basic security
    this.app.use(helmet());

    // use an application-level middleware to add the CORS HTTP header to every request by default.
    const localhostAddress = "http://localhost:8000";
    const corsOptions = {
      origin: localhostAddress,
      optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
    };
    this.app.use(cors(corsOptions));

    // enable request body parsing
    this.app.use(bodyParser.urlencoded({ extended: true }));
    //this.app.use(bodyParser.text());
    this.app.use(bodyParser.json());
  }

  setupRoutes(): void {
    const osmRouter = new OsmRouter(publicDir);
    // mount the routes with the prefix "osm"
    //this.app.use("/osm", osmRouter);
    this.app.use(osmRouter.instance);

    const logRouter = new LoggingRouter(publicDir);
    this.app.use(logRouter.instance);
  }

  setupErrorHandling(): void {
    this.app.use(this.errorHandler);

    // catch 404; this must be at the end!
    this.app.use(function (req, res, next) {
      res.status(NOT_FOUND);
      // respond with json
      if (req.accepts("json")) {
        res.send({ error: "Not found" });
        return;
      }
      // default to plain-text
      res.type("txt").send("Not found");
    });
  }

  errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): Response<Error> | void {
    if (res.headersSent) {
      return next(err);
    }
    console.log(err);

    res.status(INTERNAL_SERVER_ERROR);
    return res.send(err);
  }

  /**
   * Start the express server on the given port.
   */
  start(port: number): void {
    const server = this.app.listen(port, () => {
      console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
    });
  }
}
