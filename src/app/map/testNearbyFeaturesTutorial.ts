import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { FeatureCollection, GeoJsonProperties } from "geojson";
import * as turfHelpers from "@turf/helpers";
import type { GeoJSONSource } from "mapbox-gl";
import { map } from "./mapboxConfig";
import buffer from "@turf/buffer";

/* eslint-disable no-magic-numbers */
const aliens = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { ID: 1, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.4580078125, 33.687781758439364] },
    },
    {
      type: "Feature",
      properties: { ID: 2, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.117431640625, 33.57000543108403] },
    },
    {
      type: "Feature",
      properties: { ID: 3, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.09957885742188, 33.91373381431625] },
    },
    {
      type: "Feature",
      properties: { ID: 4, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.26162719726562, 33.67292566628718] },
    },
    {
      type: "Feature",
      properties: { ID: 5, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.83016967773438, 33.58602331802259] },
    },
    {
      type: "Feature",
      properties: { ID: 6, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.86724853515625, 33.277731642555224] },
    },
    {
      type: "Feature",
      properties: { ID: 7, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.33990478515625, 33.53338195763831] },
    },
    {
      type: "Feature",
      properties: { ID: 8, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.23004150390625, 33.32593850874471] },
    },
    {
      type: "Feature",
      properties: { ID: 9, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.63516235351562, 33.578014746143985] },
    },
    {
      type: "Feature",
      properties: { ID: 0, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.7821044921875, 33.43717151666947] },
    },
    {
      type: "Feature",
      properties: { ID: 11, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.71755981445312, 33.20652045176062] },
    },
    {
      type: "Feature",
      properties: { ID: 12, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.22454833984374, 33.12950124445052] },
    },
    {
      type: "Feature",
      properties: { ID: 13, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.09683227539062, 33.47841764867342] },
    },
    {
      type: "Feature",
      properties: { ID: 14, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.315185546875, 33.897777013859475] },
    },
    {
      type: "Feature",
      properties: { ID: 15, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.82742309570312, 33.7825716472443] },
    },
    {
      type: "Feature",
      properties: { ID: 16, isAlien: "" },
      geometry: { type: "Point", coordinates: [-103.82354736328125, 33.710632271492095] },
    },
    {
      type: "Feature",
      properties: { ID: 17, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.58297729492188, 33.19388015067254] },
    },
    {
      type: "Feature",
      properties: { ID: 18, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.74639892578125, 33.073130945006625] },
    },
    {
      type: "Feature",
      properties: { ID: 19, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.2547607421875, 33.01326987686983] },
    },
    {
      type: "Feature",
      properties: { ID: 20, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.08172607421875, 33.22375428474926] },
    },
    {
      type: "Feature",
      properties: { ID: 21, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.98123168945311, 33.46696235807553] },
    },
    {
      type: "Feature",
      properties: { ID: 22, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.45526123046875, 33.90689555128866] },
    },
    {
      type: "Feature",
      properties: { ID: 23, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.28497314453125, 33.457797035354766] },
    },
    {
      type: "Feature",
      properties: { ID: 24, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.52255249023438, 33.384439582098224] },
    },
    {
      type: "Feature",
      properties: { ID: 25, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.61868286132812, 33.00060174664655] },
    },
    {
      type: "Feature",
      properties: { ID: 26, isAlien: "" },
      geometry: { type: "Point", coordinates: [-105.14465332031249, 32.778037985363675] },
    },
    {
      type: "Feature",
      properties: { ID: 27, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-103.81393432617188, 32.858825196463854] },
    },
    {
      type: "Feature",
      properties: { ID: 28, isAlien: "" },
      geometry: { type: "Point", coordinates: [-105.23941040039062, 34.028762179464465] },
    },
    {
      type: "Feature",
      properties: { ID: 29, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-103.68484497070312, 34.07199987534163] },
    },
    {
      type: "Feature",
      properties: { ID: 30, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.12155151367188, 33.884097379274905] },
    },
    {
      type: "Feature",
      properties: { ID: 31, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.08172607421875, 33.89207743274474] },
    },
    {
      type: "Feature",
      properties: { ID: 32, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.13940429687499, 33.920571528675076] },
    },
    {
      type: "Feature",
      properties: { ID: 33, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.05975341796875, 33.93652406150093] },
    },
    {
      type: "Feature",
      properties: { ID: 34, isAlien: "" },
      geometry: { type: "Point", coordinates: [-104.10232543945312, 33.959308210392024] },
    },
  ],
};

function makeRadius(
  lngLatArray: number[],
  radiusInMeters: number
): FeatureCollection<any, GeoJsonProperties> {
  const point = turfHelpers.point(lngLatArray);
  const collection = turfHelpers.featureCollection([point]);

  // @ts-expect-error  : "units: string" - option is apparently not recognized by typescript even though it is completely correct
  const buffered = buffer(collection, radiusInMeters, { units: "meters" });
  return buffered;
}

function spatialJoin(sourceGeoJSON: any[], filterFeature: any): any[] {
  // Loop through all the features in the source geojson and return the ones that
  // are inside the filter feature (buffered radius) and are confirmed landing sites
  // prettier-ignore
  const joined = sourceGeoJSON.filter((feature: { properties: { isAlien: string } }) => {
      /*
        console.log("feature:", feature);
        if(feature.geometry.type === "Point") {
          return booleanPointInPolygon(feature, filterFeature) && feature.properties.wheelchair === "limited";
        }
        */
       return booleanPointInPolygon(feature, filterFeature) && feature.properties.isAlien === "yes";
        
      });

  return joined;
}

export function testGettingNearbyFeatures(sourceName: string) {
  // When the map has finished loading, add a new layer that will be empty
  // at first, but will eventually house our confirmed alien landing sites.
  map.addLayer({
    id: "alien-truth",
    source: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    type: "symbol",
    layout: {
      "icon-image": "rocket-11",
      "icon-size": 1,
      "icon-allow-overlap": true,
    },
  });

  // Draw the alien search radius on the map
  map.addLayer({
    id: "search-radius",
    source: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    type: "fill",
    paint: {
      "fill-color": "#F1CF65",
      "fill-opacity": 0.1,
    },
  });

  map.on("click", (e) => {
    const eventLngLat = [e.lngLat.lng, e.lngLat.lat];

    const name = sourceName;
    const features = map.querySourceFeatures(name) as any;
    console.log("QueryFeatures:", features);
    const features2 = map.querySourceFeatures(sourceName);
    console.log("QueryFeatures2:", features2);
    const features3 = map.queryRenderedFeatures(undefined, {
      layers: [sourceName + "-l1"],
    });
    console.log("QueryFeatures3:", features3);
    const features4 = map.queryRenderedFeatures();
    console.log("QueryFeatures4:", features4);

    const searchRadius = makeRadius(eventLngLat, 15000);
    (map.getSource("search-radius") as GeoJSONSource).setData(searchRadius);

    console.log("searchRadius:", searchRadius);

    //! does not work with querySourceFeatures because the geojson coordinates are not in the expected form
    //const featuresInBuffer = spatialJoin(features, searchRadius);
    const featuresInBuffer = spatialJoin((aliens as unknown) as any[], searchRadius);
    (map.getSource("alien-truth") as any).setData(turf.featureCollection(featuresInBuffer));
  });
}
