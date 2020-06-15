/* eslint-env node */
import express, { Request, Response, NextFunction, Router } from "express";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import helmet from "helmet";
import queryOverpass from "query-overpass";
import { GeoJsonObject } from "geojson";

const RESPONSE_OK = 200;
const BAD_REQUEST = 400;
const INTERNAL_SERVER_ERROR = 500;

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

    // use an application-level middleware to add the CORS HTTP header to every request by default.
    //this.app.use(cors());

    // error handling (must be at the end)
    this.app.use(this.errorHandler);
  }

  /**
   * Start the express server on the given port.
   */
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

          const hrstart = process.hrtime();

          //TODO: das geht schöner (z.B. mit async und await oder promises!)
          // is this called twice?
          this.extractOSMData(bounds, query, (osmResponse, error) => {
            const hrend = process.hrtime(hrstart);
            console.log(`Execution time: ${hrend[1] / 1000000} ms`);

            if (error) {
              res.status(BAD_REQUEST).send(error);
              return next(error);
            }
            return res.status(RESPONSE_OK).send(osmResponse);
          });
        }
      }
    );

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
    res.status(INTERNAL_SERVER_ERROR);
    console.log(err);
    return res.send(err);
  }

  /*
  async wait(ms) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, ms);
    });
  }*/

  async extractOSMData(
    bounds: string,
    userQuery: string,
    callback: (data?: GeoJsonObject, err?: Error) => void
  ): Promise<void> {
    const query = this.buildOverpassQuery(bounds, userQuery);
    //console.log("Query: " + query);

    // queryOverpass adds the ?data= automatically to the beginning of the query and uses "http://overpass-api.de/api/interpreter"
    // as the baseUrl (the baseUrl can be changed however, see https://github.com/perliedman/query-overpass).
    // For this reason, only the raw data query has to be provided as parameter.
    queryOverpass(query, (err: Error, data: GeoJsonObject) => {
      if (err) {
        callback(undefined, err);
      }
      callback(data);
    });
  }

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
}
