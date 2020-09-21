/**
 * This file provides mapbox util and helper functions to query and extract features from sources and layers.
 */
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
