import express, { NextFunction, Request, Response, Router } from "express";
import { INTERNAL_SERVER_ERROR, OK } from "http-status-codes";
import Benchmark from "../shared/benchmarking";
import fs from "fs";
import * as ServerUtils from "./serverUtils";

export default class LoggingRouter {
  private readonly logRouter: Router;
  private publicDirPath: string;

  constructor(publicDir: string) {
    this.publicDirPath = publicDir;

    this.logRouter = express.Router();
    this.setupRoutes();
  }

  get instance(): Router {
    return this.logRouter;
  }

  setupRoutes(): void {
    this.logRouter.get("/saveLog", async (req: Request, res: Response, next: NextFunction) => {
      //TODO logging einbauen!
      /*
      const result = await ServerUtils.executeOSMFilter(this.publicDirPath);
      console.log("Result of operation is:\n", result);

      res.status(OK).send(result);
      */
    });
  }
}
