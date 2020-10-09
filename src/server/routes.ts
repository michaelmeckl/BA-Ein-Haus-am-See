import axios from "axios";
import express, { NextFunction, Request, Response, Router } from "express";
import type { ReadStream } from "fs";
import type { GeoJsonObject } from "geojson";
import { OK } from "http-status-codes";
import pbf2json from "pbf2json";
import querystring from "querystring";
import through from "through2";
import union from "@turf/union";
import Benchmark from "../shared/benchmarking";
import RedisCache from "./redisCache";
import fs from "fs";
import * as ServerUtils from "./serverUtils";
//import pg from "pg";  //postgres

export default class OsmRouter {
  private readonly osmRouter: Router;
  private publicDirPath: string;

  constructor(publicDir: string) {
    this.publicDirPath = publicDir;

    this.osmRouter = express.Router();
    this.initRoutes();
  }

  get instance(): Router {
    return this.osmRouter;
  }

  /**
   * Init the express router and setup routes.
   */
  initRoutes(): void {
    this.osmRouter.get("/testCmd", async (req: Request, res: Response, next: NextFunction) => {
      const result = await ServerUtils.executeOSMFilter(this.publicDirPath);
      console.log("Result of operation is:\n", result);

      res.status(OK).send(result);
    });

    this.osmRouter.get("/osmRequest", async (req: Request, res: Response, next: NextFunction) => {
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
    this.osmRouter.get(
      "/osmRequestCacheVersion",
      this.checkCache,
      async (req: Request, res: Response, next: NextFunction) => {
        const bounds = req.query.bounds?.toString();
        const query = req.query.osmQuery?.toString();

        if (bounds && query) {
          const compositeKey = (bounds + "/" + query).trim().toLowerCase();
          const osmQuery = ServerUtils.buildOverpassQuery(bounds, query);

          try {
            Benchmark.startMeasure("Getting data from osm total");
            const encodedQuery = querystring.stringify({ data: osmQuery });
            const geoData = await axios.get(
              `https://overpass-api.de/api/interpreter?${encodedQuery}`
            );
            console.log(Benchmark.stopMeasure("Getting data from osm total"));

            //TODO redis spatial features genauer anschauen, die könnten das hier um einiges verbessern vllt

            Benchmark.startMeasure("Caching data");
            // cache data for one hour
            RedisCache.cacheData(compositeKey, geoData.data, 3600);
            Benchmark.stopMeasure("Caching data");

            return res.status(OK).json(geoData.data);
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
      }
    );

    /**
     * * Alternative version for above but uses pbf2json with local .pbf file
     */
    this.osmRouter.get(
      "/osmRequestPbfVersion",
      (req: Request, res: Response, next: NextFunction) => {
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
            file: this.publicDirPath + filePath,
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

                //* wieso übertrag ich nicht gleich das pbf? -> mapbox kann das doch auch ?
                //* und zum filtern nach tags könnten dann andere Tools sinnvoller sein
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
      }
    );

    //TODO so nicht, das sind viel zu große daten die da übertragen werden
    // entweder mit stream api oder sowas wie socket io maybe
    // oder mit geobuf format vllt?
    this.osmRouter.get(
      "/calculateMask",
      async (req: Request, res: Response, next: NextFunction) => {
        const param = req.query.polygonData;
        if (!param) {
          return res.send("No data or wrong data format passed in request!");
        }

        const data = JSON.parse(param as string);
        console.log(data);

        let unionResult: any = data[0];
        for (let index = 1; index < data.length; index++) {
          const element = data[index];
          unionResult = union(unionResult, element);
        }
        console.log(unionResult);

        fs.writeFile("./unionResult.geojson", JSON.stringify(unionResult), (err) => {
          if (err) {
            throw err;
          }
          console.log("Union Result saved successfully!");
        });

        return res.send(unionResult);
      }
    );
  }

  //Express middleware function to check Redis Cache
  checkCache = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bounds = req.query.bounds?.toString();
    const query = req.query.osmQuery?.toString();

    //TODO am besten nicht die exakten Bounds, sondern auf überlappung prüfen und nur nötiges holen?
    //TODO vllt mit einer geospatial query möglich?? siehe Redis Plugin für Geodaten!
    const compositeKey = (bounds + "/" + query).trim().toLowerCase();
    Benchmark.startMeasure("Getting data from cache");
    const result = await RedisCache.fetchDataFromCache(compositeKey);
    Benchmark.stopMeasure("Getting data from cache");

    if (result) {
      res.status(OK).send(result);
    } else {
      //if not in cache proceed to next middleware function
      next();
    }
  };
}
