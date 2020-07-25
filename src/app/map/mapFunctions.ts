//Test-Methods //TODO delete this file for production!!

import { map } from "./mapConfig";
import type { Point } from "geojson";
import shortestPath from "@turf/shortest-path";
import * as mapboxUtils from "./mapboxUtils";
import sector from "@turf/sector";
import buffer from "@turf/buffer";
import circle from "@turf/circle";
import intersect from "@turf/intersect";
import * as turfHelpers from "@turf/helpers";

//TODO get unique features from a geojson source:
/*
//TODO: or use a set instead
var features = map.queryRenderedFeatures({layers: ['my_layer']});
if (features) {
    var uniqueFeatures = getUniqueFeatures(features, "icon"); 

    uniqueFeatures.forEach(function(feature) {
            var prop = feature.properties;
            console.log(prop.icon);
    })
}

function getUniqueFeatures(array, comparatorProperty) {
    var existingFeatureKeys = {};
    // Because features come from tiled vector data, feature geometries may be split
    // or duplicated across tile boundaries and, as a result, features may appear
    // multiple times in query results.
    var uniqueFeatures = array.filter(function(el) {
        if (existingFeatureKeys[el.properties[comparatorProperty]]) {
            return false;
        } else {
            existingFeatureKeys[el.properties[comparatorProperty]] = true;
            return true;
        }
    });

    return uniqueFeatures;
}
*/

//TODO duplicate
function removeData(sourceName: string): void {
  if (!map.getSource(sourceName)) {
    return;
  }
  mapboxUtils.removeAllLayersForSource(map, sourceName);
  map.removeSource(sourceName);
}

//TODO get all points in a distance around click
export function getPointsInRadius(map: mapboxgl.Map) {
  // map click handler
  map.on("click", (e) => {
    /*
      const cluster: mapboxgl.MapboxGeoJSONFeature[] = this.map.queryRenderedFeatures(e.point, {
        layers: ["points-l1"],
      });
      */
    const cluster: mapboxgl.MapboxGeoJSONFeature[] = map.queryRenderedFeatures(e.point);

    console.log(cluster[0]);

    if (cluster[0]) {
      const clusterRadius = 50; //TODO woher radius?

      const pointsInCluster = features.filter((f) => {
        const pointPixels = map.project(f.geometry.coordinates);
        const pixelDistance = Math.sqrt(
          Math.pow(e.point.x - pointPixels.x, 2) + Math.pow(e.point.y - pointPixels.y, 2)
        );
        return Math.abs(pixelDistance) <= clusterRadius;
      });
      console.log(cluster, pointsInCluster);
    }
  });
}

export function getNearestPoint(map: mapboxgl.Map): void {
  map.on("click", function (e: mapboxgl.MapMouseEvent) {
    const libraryFeatures = map.queryRenderedFeatures(e.point, { layers: ["libraries"] });
    if (!libraryFeatures.length) {
      return;
    }

    const libraryFeature = libraryFeatures[0];

    //TODO import turf nearest
    const nearestHospital = turf.nearest(libraryFeature, hospitals);

    if (nearestHospital !== null) {
      map.getSource("nearest-hospital").setData({
        type: "FeatureCollection",
        features: [nearestHospital],
      });

      map.addLayer(
        {
          id: "nearest-hospital",
          type: "circle",
          source: "nearest-hospital",
          paint: {
            "circle-radius": 12,
            "circle-color": "#486DE0",
          },
        },
        "hospitals"
      );
    }
  });
}

export function testX(): void {
  map.addSource("vector", {
    type: "vector",
    tiles: ["./assets/ny_extract.osm.pbf"],
  });

  /*
    map.addLayer({
      id: "vector",
      type: "line",
      source: "vector",
      "source-layer": "state",
      paint: {
        "line-color": "#ff69b4",
      },
    });*/
}

function addTurfBuffer(p): void {
  const point = turfHelpers.point(p);
  const buff = buffer(p, 1.4, { units: "kilometers" });
  console.log(buff);
  const source = "turfBuffer";
  removeData(source);

  map.addSource(source, {
    type: "geojson",
    data: buff,
  });
  map.addLayer({
    id: source,
    type: "line",
    source: source,
    paint: {
      "line-width": 2,
      "line-color": "#ff0000",
    },
  });
  map.addLayer({
    id: source + "f",
    type: "fill",
    source: source,
    paint: {
      "fill-color": "rgba(255, 0, 0, 0)",
    },
  });
}

export function addTurfCircle(p: Point, radius: number): void {
  const kreis = circle(p, radius);
  const source = "turfCircle" + p;
  removeData(source);

  map.addSource(source, {
    type: "geojson",
    data: kreis,
  });

  map.addLayer({
    id: "l" + p,
    type: "line",
    source: source,
    paint: {
      "line-width": 1,
      "line-color": "#dddddd",
    },
  });
  map.addLayer({
    id: "f" + p,
    type: "fill",
    source: source,
    paint: {
      "fill-color": "rgba(127, 127, 127, 0.1)",
    },
  });
}

function addTurfIntersection(s1, s2): void {
  //TODO: doesn't work for some reason
  const intersection = intersect(s1, s2);
  const source = "turfIntersection";
  removeData(source);

  map.addSource(source, {
    type: "geojson",
    data: intersection,
  });
  map.addLayer({
    id: "l",
    type: "line",
    source: source,
    paint: {
      "line-width": 2,
      "line-color": "#ff0000",
    },
  });
  map.addLayer({
    id: "f",
    type: "fill",
    source: source,
    paint: {
      "fill-color": "rgb(255, 0, 0)",
    },
  });
}

function addTurfSector(center, radius, name): any {
  //const radius = 0.2; // in kilometer, 0.2 == 200 m
  const bearing1 = 0;
  const bearing2 = 360;

  const circle = sector(center, radius, bearing1, bearing2);

  const source = name;
  removeData(source);

  map.addSource(source, {
    type: "geojson",
    data: circle,
  });
  map.addLayer({
    id: name + "ttt-l",
    type: "line",
    source: source,
    paint: {
      "line-width": 1,
    },
  });
  map.addLayer({
    id: name + "ttt-f",
    type: "fill",
    source: source,
    paint: {
      "fill-color": "rgba(127, 127, 127, 0.3)",
    },
  });

  return circle;
}

function addTurfPath(start, end): void {
  const options = {
    resolution: 100,
  };
  const path = shortestPath(start, end, options);
  const sourceLine = "turfShortestPath";
  removeData(sourceLine);

  map.addSource(sourceLine, {
    type: "geojson",
    data: path,
  });
  map.addLayer({
    id: "line",
    type: "line",
    source: sourceLine,
    paint: {
      "line-color": "#66dddd",
    },
  });
}

export function testTurfFunctions(): void {
  const start = [12.089283, 48.9920256];
  const end = [12.0989967, 49.0016276];
  const point = [12.132873153688053, 49.01678217405953];
  addTurfPath(start, end);

  const firstSector = addTurfSector(start, 0.6, "sector1");
  const secondSector = addTurfSector(end, 1, "sector2");

  //addTurfIntersection(firstSector, secondSector);
  addTurfBuffer(firstSector);
  addTurfCircle(point, 1.4);
}
