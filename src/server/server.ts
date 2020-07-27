/* eslint-env node */
import express, { Request, Response, NextFunction, Router } from "express";
import path from "path";
import type { ReadStream } from "fs";
import cors from "cors";
import bodyParser from "body-parser";
import helmet from "helmet";
import { OK, NOT_FOUND, INTERNAL_SERVER_ERROR } from "http-status-codes";
import compression from "compression";
import axios from "axios";
import querystring from "querystring";
import type { GeoJsonObject } from "geojson";
import Benchmark from "../shared/benchmarking";
import RedisCache from "./redisCache";
import pbf2json from "pbf2json";
import through from "through2";
import * as ServerUtils from "./serverUtils";
//import pg from "pg";  //postgres

//TODO handle crashes?
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

    // serve front-end content
    //TODO actually it would be better for performance not to send it from the node server as it is single-threaded (maybe use nginx instead?)
    this.app.use(express.static(publicDir));
    this.app.use(express.static(staticDir));

    // setup routes
    const router = this.initRouter();
    this.app.use(router);

    // error handling
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

  /**
   * Start the express server on the given port.
   */
  start(port: number): void {
    this.app.listen(port, (err) => {
      if (err) {
        return console.error(err);
      }

      return console.log(`Server started at http://localhost:${port}`);
    });
  }

  /**
   * Init the express router and setup routes.
   */
  initRouter(): Router {
    const router = express.Router();

    router.get("/osmRequest", async (req: Request, res: Response, next: NextFunction) => {
      const bounds = req.query.bounds?.toString();
      const query = req.query.osmQuery?.toString();

      //TODO: check that bounds aren't too big!

      //TODO: die gegebene query muss noch überprüft werden, und sollte mit regexes und case-insensitiv in die url eingebaut werden
      // vgl. https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide

      if (bounds && query) {
        // TODO: show user some kind of progress information: progress bar or simply percentage / remaining time!
        //res.status(200).send("Got it! You sent: " + query + ",\n" + bounds);

        Benchmark.startMeasure("Building Query");
        const osmQuery = ServerUtils.buildOverpassQuery(bounds, query);
        console.log(Benchmark.stopMeasure("Building Query"));

        try {
          Benchmark.startMeasure("Getting data from osm total");
          const geoData = await ServerUtils.getDataFromOSM(osmQuery);
          console.log(Benchmark.stopMeasure("Getting data from osm total"));

          return res.status(OK).send(geoData);
        } catch (error) {
          if (error.response) {
            // send error status to client
            return res.status(error.response.status).send(error.response.statusText);
          }
          // if no response property on error (e.g. internal error), pass to error handler
          return next(error);
        }
      }
      return res.end();
    });

    /**
     * * Alternative version for above but checks the redis cache first before sending requerst to overpass api
     */
    router.get(
      "/osmRequestCacheVersion",
      async (req: Request, res: Response, next: NextFunction) => {
        const bounds = req.query.bounds?.toString();
        const query = req.query.osmQuery?.toString();

        if (bounds && query) {
          const compositeKey = (bounds + "/" + query).trim().toLowerCase();
          const result = await RedisCache.fetchDataFromCache(compositeKey);

          if (result) {
            res.status(OK).send(result);
          } else {
            const osmQuery = ServerUtils.buildOverpassQuery(bounds, query);
            try {
              Benchmark.startMeasure("Getting data from osm total");
              const encodedQuery = querystring.stringify({ data: osmQuery });
              //const geoData = await ServerUtils.performOverpassRequest(encodedQuery);
              const geoData = await axios.get(
                `https://overpass-api.de/api/interpreter?${encodedQuery}`
              );
              console.log(Benchmark.stopMeasure("Getting data from osm total"));

              RedisCache.cacheData(compositeKey, geoData.data);
              //RedisCache.cacheData(compositeKey, JSON.stringify(geoData.data));

              return res.status(OK).send(geoData.data);
            } catch (error) {
              if (error.response) {
                // send error status to client
                return res.status(error.response.status).send(error.response.statusText);
              }
              // if no response property on error (e.g. internal error), pass to error handler
              return next(error);
            }
          }
        }
        return res.end();
      }
    );

    /**
     * * Alternative version for above but uses pbf2json with local .pbf file
     */
    router.get("/osmRequestPbfVersion", (req: Request, res: Response, next: NextFunction) => {
      const bounds = req.query.bounds?.toString();
      const query = req.query.osmQuery?.toString();
      //console.log(query);

      //TODO bounds nicht direkt möglich mit dem tool!

      /**
       * Beispiele:
       * # all buildings and shops
       * -tags="building,shop"
       * # only highways and waterways which have a name
       * -tags="highway+name,waterway+name"
       * # only extract cuisine tags which have the value of vegetarian or vegan
       * -tags="cuisine~vegetarian,cuisine~vegan"
       */
      if (bounds && query) {
        const filePath = "/assets/ny_extract.osm.pbf";
        const config = {
          file: publicDir + filePath,
          tags: ["amenity~bar"],
          leveldb: "/tmp",
        };

        try {
          const geoData: GeoJsonObject[] = [];
          const stream: ReadStream = pbf2json.createReadStream(config);

          stream
            .pipe(
              through.obj(function (item, e, next) {
                //console.log("#######\nItem from pbf2json:\n");
                geoData.push(item);
                next();
              })
            )
            .on("data", (data) => {
              //geoData.push(data);
              //TODO cache in redis!!!
            })
            .on("end", () => {
              console.log(geoData.length);
              //TODO das ergebnis ist nur json und kein valides geojson! (kann auch nicht mehr in eines umgewandelt werden!)

              return res.status(OK).send(JSON.stringify(geoData));
            });
        } catch (error) {
          if (error.response) {
            // send error status to client
            return res.status(error.response.status).send(error.response.statusText);
          }
          // if no response property on error (e.g. internal error), pass to error handler
          return next(error);
        }
      }
      //return res.end();
      return null;
    });

    //TODO fetch from postgis db
    //url: 'http://localhost:{port_of_db}/amenities',
    router.get("/amenities", function (req, res) {
      //this.getAmenities(req.body, res);
    });

    return router;
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
}
