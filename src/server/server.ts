/* eslint-env node */
import express, { Request, Response, NextFunction, Router } from "express";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import helmet from "helmet";
import os from "os";
import childProcess from "child_process";
import { OK, NOT_FOUND, INTERNAL_SERVER_ERROR } from "http-status-codes";
import compression from "compression";
import Util from "util";
import axios from "axios";
import querystring from "querystring";
import type { GeoJsonObject } from "geojson";
import osmtogeojson from "osmtogeojson";
import xmldom from "xmldom";
import Benchmark from "../shared/benchmarking";
//import pg from "pg";  //postgres

const staticDir = path.join(__dirname, "../", "app"); // folder with client files
const publicDir = path.join(__dirname, "../../", "public"); // folder with static files

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
export default class Server {
  // Init express
  private readonly app = express();

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
    this.app.use(bodyParser.text());

    // serve front-end content
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
        const osmQuery = this.buildOverpassQuery(bounds, query);
        console.log(Benchmark.stopMeasure("Building Query"));

        try {
          Benchmark.startMeasure("Getting data from osm total");
          const geoData = await this.getDataFromOSM(osmQuery);
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
  ): Response<Error> | void {
    if (res.headersSent) {
      return next(err);
    }
    res.status(INTERNAL_SERVER_ERROR);
    return res.send(err);
  }

  /**
   * Builds a query for the overpass api to fetch osm data as GeoJson in the given map bounds.
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

    // use "qt" to sort by quadtile index (sorts by location and is faster than sort by id)
    const output = "out geom qt;";
    /*
    const output1 = "out;>;out skel qt;";;
    const output2 = "out geom qt;>;out skel qt;";
    const output3 = "out geom qt;<;out skel qt;";
    */

    const query = `${querySettings}(${request});${output}`;
    return query;
  }

  async getDataFromOSM(query: string): Promise<any> {
    const encodedQuery = querystring.stringify({ data: query });
    console.log(encodedQuery);

    Benchmark.startMeasure("Requesting and parsing data from overpass");
    const data = await this.performOverpassRequest(encodedQuery);
    console.log(Benchmark.stopMeasure("Requesting and parsing data from overpass"));

    Benchmark.startMeasure("OsmtoGeojson");
    const geoJson = osmtogeojson(data);
    console.log(Benchmark.stopMeasure("OsmtoGeojson"));

    return geoJson;
  }

  async performOverpassRequest(params: string): Promise<GeoJsonObject | Document> {
    Benchmark.startMeasure("Overpass API Request");
    const response = await axios.get(`https://overpass-api.de/api/interpreter?${params}`);
    //const response = await axios.get(`http://192.168.99.101:12345/api/interpreter?${params}`);
    console.log(Benchmark.stopMeasure("Overpass API Request"));

    //console.log(response.data);
    const contentType = response.headers["content-type"];

    if (contentType.endsWith("json")) {
      return response.data as GeoJsonObject;
    } else if (contentType.endsWith("xml")) {
      const parser = new xmldom.DOMParser();
      return parser.parseFromString(response.data);
    }
    throw new Error("Content type not supported!");
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

  // executes command line scripts
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

  /**
   * Returns a string identifying the operating system platform. The value is set at compile time.
   * Possible values are 'aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', and 'win32'.
   */
  getPlatform(): string {
    return os.platform();
  }
}
