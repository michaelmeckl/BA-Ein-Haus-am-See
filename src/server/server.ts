/* eslint-env node */
import express, { Request, Response, NextFunction, Router } from "express";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import helmet from "helmet";
import { performance } from "perf_hooks";
import {
  GeoJsonObject,
  FeatureCollection,
  GeometryObject,
  Geometry,
} from "geojson";
import childProcess from "child_process";
import os from "os";
import Util from "util";
import axios from "axios";
//TODO: test
import nodeFetch from "node-fetch";
import needle from "needle";

import osmtogeojson from "osmtogeojson";
import querystring from "querystring";
import xmldom from "xmldom";
//import pg from "pg";

const RESPONSE_OK = 200;
const BAD_REQUEST = 400;
const INTERNAL_SERVER_ERROR = 500;

// TODO:
/*
const tileCoords = { x: 164, y: 396, z: 10 };

const endpoint =
  "https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key=mrAq6zQEFxOkanukNbGm";
const tileURL = endpoint
  .replace(/{z}/, tileCoords.z)
  .replace(/{y}/, tileCoords.y)
  .replace(/{x}/, tileCoords.x);
  */

const exec = Util.promisify(childProcess.exec);

const staticDir = path.join(__dirname, "../", "public"); // folder with client files

export default class Server {
  // Init express
  private app = express();

  constructor() {
    // add basic security
    this.app.use(helmet());

    // enable request body parsing
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.text());

    // serve front-end content
    this.app.use(express.static(staticDir));

    // routing
    const router = this.initRouter();
    this.app.use(router);

    /*
    // catch 404 and forward to error handler
    this.app.use(function (req, res, next) {
      const err: any = new Error("Not Found");
      err.status = 404;
      next(err);
    });
    */

    // use an application-level middleware to add the CORS HTTP header to every request by default.
    //this.app.use(cors());

    // error handling (must be at the end)
    this.app.use(this.errorHandler);
  }

  /**
   * Start the express server on the given port.
   */
  start(port: number): void {
    //this.executeScript("dir");

    this.app.listen(port, (err) => {
      if (err) {
        return console.error(err);
      }

      return console.log(
        `Server started. Client available at http://localhost:${port}`
      );
    });
  }

  initRouter(): Router {
    const router = express.Router();

    router.get("/", (req: Request, res: Response) => res.render("index"));

    router.get("/token", (req: Request, res: Response) => {
      return res.send(process.env.MAPBOX_TOKEN);
      // TODO: or send it with the "/" route above at the beginning?
      //res.redirect("/");
    });

    router.get(
      "/osmRequest",
      async (req: Request, res: Response, next: NextFunction) => {
        const bounds = req.query.bounds?.toString();
        const query = req.query.osmQuery?.toString();

        //TODO: check that bounds aren't too big!

        //TODO: die gegebene query muss noch überprüft werden, und sollte mit regexes und case-insensitiv in die url eingebaut werden
        // vgl. https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide

        if (bounds && query) {
          // TODO: show user some kind of progress information: progress bar or simply percentage / remaining time!
          //res.status(200).send("Got it! You sent: " + query + ",\n" + bounds);

          //TODO: measure time
          const osmQuery = this.buildOverpassQuery(bounds, query);
          const geoData = await this.getDataFromOSM(osmQuery);

          if (geoData instanceof Error) {
            console.log("instance of was error");
            res.status(BAD_REQUEST).send(geoData);
            return next(geoData);
          }
          console.log("sending to client");
          return res.status(RESPONSE_OK).send(geoData);
        }
        return res.end();
      }
    );

    //TODO: fetch from db
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
  ): Response<any> | void {
    if (res.headersSent) {
      return next(err);
    }
    //res.status(err.status || INTERNAL_SERVER_ERROR);
    res.status(INTERNAL_SERVER_ERROR);
    console.log(err);
    return res.send(err);
  }

  /*
  //TODO: use custom benchmarking class
  // eslint-disable-next-line no-magic-numbers
  measureTime(func: (args: any) => any, action: string, accuracy = 3): any {
    const t0 = performance.now();
    const val = func(args);
    const t1 = performance.now();
    console.log(`${action} took ${(t1 - t0).toFixed(accuracy)} milliseconds.`);
    return val;
  }
  */

  /**
   * Builds a query for the overpass api to fetch osm data as GeoJson in the given map bounds.
   * See https://andreas-bruns.com/2014/11/30/openstreetmap-daten-abfragen-mit-der-overpass-api/.
   */
  buildOverpassQuery(bounds: string, userQuery: string): string {
    // shorthand for query instead of 3 separate ones (nwr = node, way, relation)
    const request = `nwr[${userQuery}];`;

    /*TODO: support different types and conjunctions: -> query vllt schon ganz in client bauen?
    * AND:
    nwr[${userQuery1}][${userQuery2}]...;

    * OR - different key:
    nwr[${userQuery1}];
    nwr[${userQuery2}];
    ...

    * OR - same key, different values:
    nwr[${userQuery1}];   // in the form of ["key"~"value1|value2|value3|..."] -> no whitespace between! (regex)
    */

    // TODO: what is the best output format: xml or json?
    // output-format json, runtime of max. 25 seconds (needs to be higher for more complex queries) and global bounding box
    const querySettings = `[out:json][timeout:25][bbox:${bounds}];`;

    const output = "out geom qt;";
    /*
    // output (default) body then use recurse down ">;" (to resolve ways into nodes and relations into nodes and ways)
    // and output only the necessary infos (skel), also use "qt" to sort by quadtile index (sorts by location and is faster than sort by id)
    const output1 = "out;>;out skel qt;";;
    const output2 = "out geom qt;>;out skel qt;";
    const output3 = "out geom qt;<;out skel qt;";
    */

    const query = `${querySettings}(${request});${output}`;

    return query;
  }

  async getDataFromOSM(query: string): Promise<any | Error> {
    try {
      const encodedQuery = querystring.stringify({ data: query });

      //TODO: test performance for the others too
      const response = await axios.get(
        `https://overpass-api.de/api/interpreter?${encodedQuery}`
      );

      const response2 = await nodeFetch(
        `https://overpass-api.de/api/interpreter?${encodedQuery}`
      );
      console.log(response2);
      console.log(await response2.json());

      const response3 = await needle(
        "get",
        `https://overpass-api.de/api/interpreter?${encodedQuery}`
      );
      console.log(response3);
      console.log(response3.body);

      const contentType = response.headers["content-type"];
      console.log(contentType);

      let data: any;
      if (contentType.endsWith("json")) {
        data = response.data as GeoJsonObject;
      } else if (contentType.endsWith("xml")) {
        const parser = new xmldom.DOMParser();
        data = parser.parseFromString(response.data);
      } else {
        throw new Error("Content type not supported!");
      }

      const geoJson = osmtogeojson(data);
      return geoJson;
    } catch (error) {
      console.log("Request failed: " + error);
      return error;
    }
  }

  //TODO: connect to and request data from postgres:
  /*
  getAmenities(amenities, res) {
    const conString = "pg://localhost/portland_from_osm";
    const client = new pg.Client(conString);
    client.connect();

    const fc = {
      type: "FeatureCollection",
      features: [],
    };

    const sql =
      "SELECT name, ST_AsGeoJSON(ST_TRANSFORM(way, 4326)) AS way, tags->'cuisine' AS cuisine " +
      "FROM planet_osm_point " +
      "WHERE amenity = 'restaurant' AND name IS NOT NULL;";

    client.query(sql, function (err, result) {
      result.rows.forEach(function (feature) {
        const tags = feature.tags;

        const f = {
          type: "Feature",
          geometry: JSON.parse(feature.way),
          properties: {
            name: feature.name,
            cuisine: feature.cuisine,
          },
        };
        fc.features.push(f);
      });

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(fc);
    });
  }
  */

  //TODO: test: execute command line scripts
  async executeScript(script: string): Promise<void> {
    // TODO: check for correct os!
    const platform = this.getPlatform();
    let exampleScript: string;

    if (platform === "win32") {
      exampleScript = "dir";
    } else if (platform === "linux") {
      exampleScript = "ls";
    } else {
      console.error("Only Windows and Linux are supported at the moment!");
      return;
    }

    try {
      const { stdout, stderr } = await exec(script);

      // the *entire* stdout and stderr (buffered)
      console.log("stdout: " + stdout);
      console.log("stderr: " + stderr);
    } catch (error) {
      // node couldn't execute the command
      console.log("exec error: " + error);
      return;
    }
  }

  getPlatform(): string {
    // Returns a string identifying the operating system platform. The value is set at compile time.
    // Possible values are 'aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', and 'win32'.
    return os.platform();
  }
}
