import type {
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
/**
 * This file provides mapbox util and helper functions to query and extract features from sources and layers.
 */
import { chunk } from "lodash";
import mapboxgl, { LngLatLike } from "mapbox-gl";
import { map } from "./mapboxConfig";

//TODO has to be called after layer is loaded!
export function getAllPoints(src: string, layerName: string) {
  map.once("sourcedata", (e) => {
    if (map.getSource(layerName) && map.isSourceLoaded(layerName)) {
      console.log("source loaded!");
      const features = map.querySourceFeatures(layerName);
      console.log(features);
      const everyPoint = map.queryRenderedFeatures({ layers: [layerName] });
      const everyPoint2 = map.querySourceFeatures(src, { sourceLayer: layerName });
      console.log(everyPoint);
      console.log(everyPoint2);
    }
  });
  /*
    console.log(layerName);
    const everyPoint = map.queryRenderedFeatures({ layers: [layerName] });
    const everyPoint2 = map.querySourceFeatures(src, { sourceLayer: layerName });
    console.log(everyPoint);
    console.log(everyPoint2);
    */
}

export function testGetQueryFeatures(sourceName: string) {
  const layerName = sourceName + "-l1";

  const everyPoint = map.queryRenderedFeatures({ layers: [layerName] });
  const everyPoint2 = map.querySourceFeatures(sourceName, { sourceLayer: layerName });
  console.log(everyPoint);
  console.log(everyPoint2);

  //TODO: dont do it like this -> endlossschleife
  /*
  for (let index = 0; index < everyPoint.length; index++) {
	const point = everyPoint[index].geometry.coordinates;
	console.log(point);
	this.addTurfCircle(point, 0.2);
  }
  */
  const allPoints = getAllPoints(sourceName, sourceName + "-l1");
  console.log(allPoints);
}

export function getAllRenderedFeaturesIn(
  /*point: LngLat*/
  bbox: [mapboxgl.PointLike, mapboxgl.PointLike]
): void {
  // Convert LatLng coordinates to screen pixel and only query the rendered features.
  //const pixel = map.project(point);
  const features = map.queryRenderedFeatures(bbox);

  // Get the first feature within the list if one exist
  if (features.length > 0) {
    const feature = features[0];

    // Ensure the feature has properties defined
    if (!feature.properties) {
      return;
    }

    Object.entries(feature.properties).forEach(([key, value]) => {
      console.log(key, value);
    });
  }
}

export function getDataforFeaturesInSelection(filters: Set<string>) {
  console.log(filters.entries.toString());

  const allGeoData: mapboxgl.MapboxGeoJSONFeature[] = [];
  for (const el of filters) {
    //TODO
    // With features[0].geometry.coordinates you will receive all points along the LineString
    /**
	  var features = map.queryRenderedFeatures({
	  layers:['roads-bm6ga5'],
	  filter: ["==", "id", 1]
	   */
    const features = map.querySourceFeatures(el);
    allGeoData.push(...features);
  }

  //TODO: doesn'T work
  /*
  console.log(allGeoData);
  allGeoData.forEach((li) => {
    const newData = cleanCoords(li);
    console.log(newData);
  });
  */

  //const newData = cleanCoords(allGeoData);
  //console.log(newData);

  return allGeoData;
}

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

//TODO use geojson-coords() to flatten all to the format necessary for the custom layer
export function getDataFromMap(filters: Set<string>): number[] {
  const allGeoData = getDataforFeaturesInSelection(filters);
  console.log("QuerySourceFeatures: ");
  console.log(allGeoData);

  //console.log(...allGeoData.flatMap((el) => el.geometry.coordinates.flat(3)));
  const testData: number[] = [].concat(
    ...allGeoData.flatMap((el) => el.geometry.coordinates.flat(3))
  );
  console.log(testData);
  const newArray = chunk(testData, 2);
  console.log("newArray after lodash:", newArray);

  //TODO: remove me later
  newArray.forEach((element) => {
    //addTurfCircle(element, 0.5);
  });

  const MercatorCoordinates = newArray.map((el) =>
    mapboxgl.MercatorCoordinate.fromLngLat(el as LngLatLike)
  );
  console.log("Mercator:", MercatorCoordinates);
  /*
	  console.log([].concat(...allGeoData.flatMap((el) => el.geometry.coordinates.flat(3))));
	  console.log(allGeoData.flatMap((el) => [].concat(el.geometry.coordinates.flat(3))));
  
	  console.log(allGeoData.flatMap((el) => [].concat(...el.geometry.coordinates.flat(3))));
	  console.log(
		allGeoData.flatMap((el) =>
		  [].concat(...el.geometry.coordinates.flatMap((li) => [li.x, li.y]))
		)
	  );
	  */

  //TODO
  /*
	  allGeoData.forEach((el) => {
		console.log(el.properties?.type);
		console.log(el.geometry.coordinates);
		console.log(...el.geometry.coordinates);
	  });
  
	  for (const el of allGeoData) {
		console.log(...this.flatten(el.geometry.coordinates));
	  }
	  */

  //const test = mapboxgl.MercatorCoordinate.fromLngLat({geoData});

  /*
	  const data = [uniSouthWest, uniSouthEast, uniNorthWest, uniNorthEast];
	  const flatData = data.flatMap((x) => [x.x, x.y]);
	  */

  //const customData = [uniNorthEast.x, uniNorthEast.y, uniSouthWest.x, uniSouthWest.y];
  const customData = MercatorCoordinates.flatMap((x) => [x.x, x.y]);
  console.log(customData);
  return customData;
}
