/**
 * Utility-Methods for working with Mapbox Gl.
 */
import mapboxgl, { GeoJSONSource } from "mapbox-gl";

/**
 * Utility function to check whether MapboxGl (and WebGL) are supported in the browser.
 */
export function checkGLSupport(): void {
  if (!mapboxgl.supported()) {
    throw new Error("Your browser does not support Mapbox GL!");
  }
}

//TODO: get all points in a distance around click
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
      const clusterRadius = 50; //TODO: woher radius?

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

//TODO: or use a set instead
// called like this:
/*
var features = map.queryRenderedFeatures({ layers: ['airport'] });
 
if (features) {
    var uniqueFeatures = getUniqueFeatures(features, 'iata_code');
}
*/
export function getUniqueFeatures(array, comparatorProperty) {
  const existingFeatureKeys = {};
  // Because features come from tiled vector data, feature geometries may be split
  // or duplicated across tile boundaries and, as a result, features may appear
  // multiple times in query results.
  const uniqueFeatures = array.filter(function (el) {
    if (existingFeatureKeys[el.properties[comparatorProperty]]) {
      return false;
    } else {
      existingFeatureKeys[el.properties[comparatorProperty]] = true;
      return true;
    }
  });

  return uniqueFeatures;
}

/**
 * Find the first layer with the given type and return its id (or undefined if no layer with that type exists).
 */
export function findLayerByType(map: mapboxgl.Map, layerType: string): string | undefined {
  const layers = map.getStyle().layers;

  if (layers) {
    for (const layer of layers) {
      if (layer.type === layerType) {
        return layer.id;
      }
    }
  }
  return undefined;
}

/**
 * Delete all layers for the source with the given ID.
 */
export function removeAllLayersForSource(map: mapboxgl.Map, sourceID: string): boolean {
  // eslint-disable-next-line no-unused-expressions
  map.getStyle().layers?.forEach((layer) => {
    if (layer.source === sourceID) {
      console.log("deleting layer:" + JSON.stringify(layer));
      map.removeLayer(layer.id);
    }
  });

  /*
    const mapLayer = map.getLayer(id);

    console.log("maplayer:" + mapLayer);

    //TODO: improve this! there can be more than one layer (and they don't have the same id name as the source but only start with it)
    if (typeof mapLayer !== "undefined") {
      // Remove map layer & source.
      map.removeLayer(id).removeSource(id);
      return true;
    }
    */

  return false;
}

/**
 * Update the data source of a given source layer. MUST be a GeoJson layer.
 */
export function updateLayerSource(map: mapboxgl.Map, id: string, data: string): boolean {
  if (map.getSource(id)?.type !== "geojson") {
    return false;
  }
  const result = (map.getSource(id) as GeoJSONSource).setData(data);
  return result ? true : false;
}
