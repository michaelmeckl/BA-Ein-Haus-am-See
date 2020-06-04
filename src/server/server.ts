/* eslint-env node */
import express, { Request, Response, NextFunction, Router } from "express";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import helmet from "helmet";
import queryOverpass from "query-overpass";
import { GeoJsonObject } from "geojson";

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

          //TODO: das geht schöner (z.B. mit async und await oder promises!)
          // is this called twice?
          this.extractOSMData(bounds, query, (osmResponse, error) => {
            //console.log(osmResponse);
            if (error) {
              res.status(400).send(error);
              //res.end();
              return next(error);
            }
            return res.status(200).send(osmResponse);
            //res.end();
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
    res.status(500);
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
    overpassQuery: string,
    callback: (data?: GeoJsonObject, err?: Error) => void
  ): Promise<void> {
    const query = this.buildOverpassApiUrl(bounds, overpassQuery);
    //console.log("Query: " + query);

    // queryOverpass adds the ?data= automatically to the beginning of the query and uses "http://overpass-api.de/api/interpreter"
    // as the baseUrl (the baseUrl can be changed however, see https://github.com/perliedman/query-overpass).
    // For this reason, only the raw data query must be given as parameter.
    queryOverpass(
      query,
      (err: Error, data: GeoJsonObject) => {
        if (err) {
          callback(undefined, err);
        }
        callback(data);
      }
      //{ flatProperties: true, overpassUrl: "https://lz4.overpass-api.de/api/interpreter" }
    );
  }

  /**
   * Builds an url for the overpass api to fetch osm data for the current map bounds and the given query.
   * See https://andreas-bruns.com/2014/11/30/openstreetmap-daten-abfragen-mit-der-overpass-api/.
   */
  buildOverpassApiUrl(bounds: string, overpassQuery: string): string {
    const nodeQuery = `node[${overpassQuery}];`;
    const wayQuery = `way[${overpassQuery}];`;
    const relationQuery = `relation[${overpassQuery}];`;
    // shorthand for the above (nwr = node, way, relation)
    //const compoundQuery = `nwr[${overpassQuery}](${bounds});`;
    const compoundQuery = `nwr[${overpassQuery}];`;

    // TODO: what is the best output format: xml or json?
    // output-format xml, runtime of max. 25 seconds (needs to be higher for more complex queries) and global bounding box
    const querySettings = `[out:xml][timeout:25][bbox:${bounds}];`;

    // output (default) body then use recurse down ">;" (to resolve ways into nodes and relations into nodes and ways)
    // and output only the necessary infos (skel), also use "qt" to sort by quadtile index
    // (sorts by location and is faster than sort by id)
    const query = `${querySettings}(${
      nodeQuery + wayQuery + relationQuery
    });out;>;out skel qt;`;

    return query;
  }
}
