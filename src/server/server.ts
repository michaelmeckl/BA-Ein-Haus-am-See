/* eslint-env node */
import express from "express";
import path from "path";
import cors from "cors";
import queryOverpass from "query-overpass";
import { GeoJsonObject } from "geojson";

const staticDir = path.join(__dirname, "../", "public"); // folder with client files

export default class Server {
  private app = express();

  constructor() {
    // serve front-end content
    this.app.use(express.static(staticDir));

    const router = express.Router();
    router.get("/", (req, res) => res.render("index"));
    router.get("/token", (req, res) => res.send(process.env.MAPBOX_TOKEN));

    this.app.use(router);

    // use an application-level middleware to add the CORS HTTP header to every request by default.
    //this.app.use(cors());

    //this.extractOSMData();
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

  extractOSMData(): void {
    /*TODO: 
      - Frontend/Client sucht sich bbox und parameter aus
      - server baut query mit den gegebenen daten und macht den api call
      - geojson/error wird an client zurückgeschickt (und client kann dann damit tun was er will)
    */
    const query = this.buildOverpassQuery();

    queryOverpass(
      query,
      (err: Error, data: GeoJsonObject) => {
        if (err) {
          console.error(err);
        } else {
          console.log(data);
        }
      }
      //{ flatProperties: true, overpassUrl: "https://lz4.overpass-api.de/api/interpreter" }
    );
  }

  buildOverpassQuery(): string {
    //[timeout:25];
    //[maxsize:1073741824]

    //TODO: interface oder class für boundingbox ?
    const bbox = "57.7,11.9,57.8,12.0"; //southwest and northeast coordinate pairs
    const type = "amenity";
    //TODO: auch mehrere möglich!
    const value = "bar";

    //[bbox:south,west,north,east]
    //ganz Regensburg: 12.028,48.966,12.192,49.076
    //kleinerer Teil: 12.06075,48.98390,12.14537,49.03052

    const defaultQuery = `[out:xml];(node(${bbox}); <;);out;`; // returns everything in the bounding box
    const newQuery = `node(${bbox})[${type}=${value}];out;`;

    return newQuery;
  }
}
