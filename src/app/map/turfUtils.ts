import buffer from "@turf/buffer";
import circle from "@turf/circle";
import * as turfHelpers from "@turf/helpers";
import intersect from "@turf/intersect";
import sector from "@turf/sector";
import shortestPath from "@turf/shortest-path";
import type { Feature, GeoJsonProperties, Geometry, Point, Polygon } from "geojson";
import { map } from "./mapboxConfig";
import * as mapboxUtils from "./mapboxUtils";

export function getNearestPoint(map: mapboxgl.Map): void {
  map.on("click", function (e: mapboxgl.MapMouseEvent) {
    const libraryFeatures = map.queryRenderedFeatures(e.point, { layers: ["libraries"] });
    if (!libraryFeatures.length) {
      return;
    }

    const libraryFeature = libraryFeatures[0];

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

type turfUnits = "meters" | "kilometers";

export function addBufferToFeature(
  element: Feature<Geometry, GeoJsonProperties>,
  units: turfUnits,
  bufferSize = 100
): Feature<any> {
  //const newElement = buffer(element as Feature<Polygon, GeoJsonProperties>, 50, {units: "meters"});

  //@ts-expect-error
  return buffer(element, bufferSize, {
    units: units,
  });
}

function addTurfBuffer(p): void {
  const point = turfHelpers.point(p);
  const buff = buffer(p, 1.4, { units: "kilometers" });
  console.log(buff);
  const source = "turfBuffer";
  mapboxUtils.removeSource(source);

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
  mapboxUtils.removeSource(source);

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
  mapboxUtils.removeSource(source);

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
  mapboxUtils.removeSource(source);

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
  mapboxUtils.removeSource(sourceLine);

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
