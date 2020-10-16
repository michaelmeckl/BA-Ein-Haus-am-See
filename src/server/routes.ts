import axios from "axios";
import express, { NextFunction, Request, Response, Router } from "express";
import type { ReadStream } from "fs";
import type {
  Feature,
  GeoJsonObject,
  GeoJsonProperties,
  LineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import { INTERNAL_SERVER_ERROR, OK } from "http-status-codes";
import pbf2json from "pbf2json";
import querystring from "querystring";
import through from "through2";
import union from "@turf/union";
import circle from "@turf/circle";
import buffer from "@turf/buffer";
import Benchmark from "../shared/benchmarking";
import RedisCache from "./redisCache";
import fs from "fs";
import * as ServerUtils from "./serverUtils";
import geobuf from "geobuf";
import Pbf from "pbf";
import Util from "util";
import osmtogeojson from "osmtogeojson";
import { features } from "process";
import intersect from "@turf/intersect";
import mask from "@turf/mask";
//import pg from "pg";  //postgres

const readFile = Util.promisify(fs.readFile);

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

            //this.saveGeoData(geoData.data, query);

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

    this.osmRouter.get("/getMask", async (req: Request, res: Response, next: NextFunction) => {
      const queryParam = req.query.filter;
      if (!queryParam) {
        //console.log("Something, somewhere went horribly wrong!");
        return res
          .status(INTERNAL_SERVER_ERROR)
          .send("Couldn't get the queryParameter, something might be wrong with the request!");
      }

      //TODO use the local pbf files with osmium or something like this?

      //const filePath = `./public/data/mask_${queryParam}.geojson`;
      const filePath = `./public/data/mask_${queryParam}`;

      try {
        //check if the file exists
        await fs.promises.access(filePath);
        // it does
        const pbfFile = await readFile(filePath);
        const geoBufMask = geobuf.decode(new Pbf(pbfFile));
        return res.status(OK).send(geoBufMask);

        //! vllt direkt eine URL schicken? sonst muss alles in data mit in den browser übertragen werden oder?
        //return res.status(OK).send(`../data/mask_${queryParam}.geojson`);
      } catch (error) {
        console.error("File does not exist: ", error);
        return res.status(INTERNAL_SERVER_ERROR).send("Mask File not found!");
      }
    });
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

  saveGeoData(geoData: any, query: string): void {
    const geoJson = osmtogeojson(geoData.data);
    const features = this.filterGeojson(geoJson);

    const polygonFeatures = this.convertAllFeaturesToPolygons(features, 150);

    const unionResult = this.performUnion(polygonFeatures);

    //get all intersections and remove all null values
    //const intersections = this.findIntersections(polygonFeatures).filter((it) => it !== null);

    //const unionIntersections = performUnion(intersections);

    const geoMask = mask(unionResult);
    const geoBufMask = geobuf.encode(geoMask, new Pbf());

    fs.writeFile(`./public/data/mask_${query}`, geoBufMask, (err) => {
      if (err) {
        throw err;
      }
      console.log("GeoBuf Mask saved successfully!");
    });
  }

  filterGeojson(geoJson: any): any {
    const currentPoints = new Set<Feature<Point, GeoJsonProperties>>();
    const currentWays = new Set<Feature<LineString, GeoJsonProperties>>();
    const currentPolygons = new Set<Feature<Polygon, GeoJsonProperties>>();

    for (let index = 0; index < geoJson.features.length; index++) {
      const element = geoJson.features[index];

      switch (element.geometry.type) {
        case "Point":
          currentPoints.add(element as Feature<Point, GeoJsonProperties>);
          break;

        case "MultiPoint":
          for (const coordinate of element.geometry.coordinates) {
            const point = {
              geometry: { type: "Point", coordinates: coordinate },
              properties: { ...element.properties },
              type: "Feature",
            } as Feature<Point, GeoJsonProperties>;

            currentPoints.add(point);
          }
          break;

        case "LineString": {
          currentWays.add(element as Feature<LineString, GeoJsonProperties>);
          break;
        }
        case "MultiLineString":
          for (const coordinate of element.geometry.coordinates) {
            const way = {
              geometry: { type: "LineString", coordinates: coordinate },
              properties: { ...element.properties },
              type: "Feature",
            } as Feature<LineString, GeoJsonProperties>;

            currentWays.add(way);
          }
          break;

        case "Polygon": {
          currentPolygons.add(element as Feature<Polygon, GeoJsonProperties>);
          break;
        }
        case "MultiPolygon":
          for (const coordinate of element.geometry.coordinates) {
            // construct a new polygon for every coordinate array in the multipolygon
            const polygon = {
              geometry: { type: "Polygon", coordinates: coordinate },
              properties: { ...element.properties },
              type: "Feature",
            } as Feature<Polygon, GeoJsonProperties>;

            currentPolygons.add(polygon);
          }
          break;

        default:
          throw new Error("Unknown geojson geometry type in data!");
      }
    }

    return [...currentPoints, ...currentWays, ...currentPolygons];
  }

  convertAllFeaturesToPolygons(
    features: Feature<Point | LineString | Polygon, GeoJsonProperties>[],
    bufferSize = 100
  ): Feature<Polygon | MultiPolygon, GeoJsonProperties>[] {
    const polygonFeatures: Feature<Polygon | MultiPolygon, GeoJsonProperties>[] = [];

    for (let index = 0; index < features.length; index++) {
      const feature = features[index];

      if (feature.geometry.type === "Point") {
        const circleOptions = { steps: 80, units: "meters" /*, properties: {foo: 'bar'}*/ };
        // replace all point features with circle polygon features
        polygonFeatures.push(
          //@ts-expect-errorö
          circle(feature as Feature<Point, GeoJsonProperties>, bufferSize, circleOptions)
        );
      } else if (feature.geometry.type === "LineString" || feature.geometry.type === "Polygon") {
        // add a buffer to all lines and polygons
        // This also replaces all line features with buffered polygon features as turf.buffer() returns
        // Polygons (or Multipolygons).
        //@ts-expect-error
        polygonFeatures.push(buffer(feature, bufferSize, { units: "meters" }));
      } else {
        break;
      }
    }

    return polygonFeatures;
  }

  performUnion(polygonFeatures: any): any {
    let unionResult: any = polygonFeatures[0];
    for (let index = 1; index < polygonFeatures.length; index++) {
      const element = polygonFeatures[index];
      unionResult = union(unionResult, element);
    }
    return unionResult;
  }

  findIntersections(
    features: Feature<Polygon | MultiPolygon, GeoJsonProperties>[]
  ): Feature<any, GeoJsonProperties>[] {
    const allIntersections: Feature<any, GeoJsonProperties>[] = [];

    /*
    //* create a lookup object to improve performance from O(m*n) to O(m+n)
    // see https://bytes.com/topic/javascript/insights/699379-optimize-loops-compare-two-arrays
    const lookup: any = {};
  
    for (const key in features) {
      if (Object.prototype.hasOwnProperty.call(features, key)) {
        lookup[features[key]] = features[key];
      }
    }
  
    for (const i in features) {
      if (typeof lookup[list1[i]] !== "undefined") {
          alert("found " + list1[i] + " in both lists");
          break;
        }
    }
    */

    //TODO make this more efficient than O(m^2)!
    for (const feature1 of features) {
      for (const feature2 of features) {
        if (feature1 !== feature2) {
          allIntersections.push(intersect(feature1, feature2));
        }
      }
    }

    return allIntersections;
  }
}
