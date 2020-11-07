/* eslint-disable no-magic-numbers */
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  GeometryObject,
} from "geojson";
import type { CustomLayerInterface, GeoJSONSource, Layer } from "mapbox-gl";
import ClusterManager from "../map/clusterManager";
import { map } from "../map/mapboxConfig";
import Heatmap from "../map/heatmap";

type mapboxLayerType =
  | "symbol"
  | "fill"
  | "line"
  | "circle"
  | "fill-extrusion"
  | "raster"
  | "background"
  | "heatmap"
  | "hillshade"
  | undefined;

//all possible geojson geometry types
const pointType = ["Point", "MultiPoint"],
  lineType = ["LineString", "MultiLineString"],
  polygonType = ["Polygon", "MultiPolygon"];

// declare some filters for clustering
const bar = ["==", ["get", "amenity"], "Bar"];
const restaurant = ["==", ["get", "amenity"], "Restaurant"];
const supermarket = ["==", ["get", "amenity"], "Supermarket"];
const cafe = ["==", ["get", "amenity"], "Cafe"];
const other = ["==", ["get", "amenity"], ""]; //TODO oder null statt leerstring?

/**
 * Util-Class to handle all sorts of source and layer related methods and keep track of all active custom layers.
 */
class MapLayerManager {
  private activeLayers: (Layer | CustomLayerInterface)[] = [];
  //private activeLayers: string[] = [];

  //TODO visibleLayers auch noch separat speichern?

  get currentActiveLayers(): (Layer | CustomLayerInterface)[] {
    return this.activeLayers;
  }

  // Add a geojson source, see https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
  addNewGeojsonSource(
    tagName: string,
    geojsonData?: string | Feature<Geometry, GeoJsonProperties> | FeatureCollection<Geometry, any>,
    clusteringEnabled = false
  ): void {
    let sourceOptions: mapboxgl.GeoJSONSourceOptions = {
      buffer: 50, // higher means fewer rendering artifacts near tile edges and decreased performance (max: 512)
      tolerance: 1.25, // higher means simpler geometries and increased performance
      data: geojsonData, // url to geojson or inline geojson
    };

    //if clustering is enabled extend the default options with the clustering props
    if (clusteringEnabled) {
      sourceOptions = {
        ...sourceOptions,

        // Cluster near points (default: false). The point_count property will be added to the source data.
        cluster: true, //! this prevents other types like lines or polygons to be rendered! -> separate source Layer needed!
        clusterRadius: 20, //default is 50
        clusterMaxZoom: 14, // don't show clusters above zoom level 14
        clusterMinPoints: 3, // at least 3 points necessary for clustering
        //clusterProperties: { sum: ["+", ["get", "scalerank"]] },
        clusterProperties: {
          // keep separate counts for each category in a cluster
          Bar: ["+", ["case", bar, 1, 0]],
          Restaurant: ["+", ["case", restaurant, 1, 0]],
          Supermarket: ["+", ["case", supermarket, 1, 0]],
          Cafe: ["+", ["case", cafe, 1, 0]],
          Other: ["+", ["case", other, 1, 0]],
        },
      };
    }

    map.addSource(tagName, { type: "geojson", ...sourceOptions });
    //console.log("Source: ", map.getSource(sourceName));

    if (clusteringEnabled) {
      const clusterManager = new ClusterManager(tagName);

      //TODO return the cluster layers so they can be added to the activeLayers array
      clusterManager.addClusterLayer();
      /*
      clusterManager.addOtherClusterLayer();
      clusterManager.updateMarkers();
      */
    }
  }

  removeSource(sourceName: string): void {
    if (!map.getSource(sourceName)) {
      console.warn(`Couldn't remove source ${sourceName}`);
      return;
    }
    this.removeAllLayersForSource(sourceName);
    map.removeSource(sourceName);
  }

  /**
   * Update the data source of a given source layer. Only works for GeoJson layer.
   */
  updateSource(id: string, data: FeatureCollection<GeometryObject, GeoJsonProperties>): boolean {
    if (map.getSource(id)?.type !== "geojson") {
      return false;
    }
    const result = (map.getSource(id) as GeoJSONSource).setData(data);
    return result ? true : false;
  }

  /**
   * Simple Util-Function to create a new layer that allows to specify if the new layer should be added on top
   * of the map (default, beforeSymbols = false) or below the map symbols (beforeSymbols = true).
   *! This method should always be called when adding a new layer to make sure the new layer gets added to the
   *! local "activeLayers" - Array.
   */
  addNewLayer(layer: Layer | CustomLayerInterface, beforeSymbols = false): void {
    this.activeLayers.push(layer);

    if (beforeSymbols) {
      map.addLayer(layer, "waterway-label");
    } else {
      map.addLayer(layer);
    }
  }

  hideLayer(layerId: string): void {
    map.setLayoutProperty(layerId, "visibility", "none");
  }

  removeLayerFromMap(layerId: string): void {
    map.removeLayer(layerId);
    // filter the elements with the given layerid out
    this.activeLayers = this.activeLayers.filter((el) => el.id !== layerId);
  }

  /**
   * Delete all layers for the source with the given ID.
   */
  removeAllLayersForSource(sourceID: string): boolean {
    // eslint-disable-next-line no-unused-expressions
    map.getStyle().layers?.forEach((layer) => {
      if (layer.source === sourceID) {
        console.log("deleting layer:" + JSON.stringify(layer));
        map.removeLayer(layer.id);

        // remove it from the local active layers as well
        const index = this.activeLayers.indexOf(layer, 0);
        if (index > -1) {
          this.activeLayers.splice(index, 1);
        }
      }
    });

    return false;
  }

  addLayers(sourceName: string): void {
    //! with ["has", "name"] it can be tested if something exists in the properties (and should be because errors
    //! have an impact on the performance!)
    const pointLayer: Layer = {
      id: sourceName + "-l1",
      type: "circle",
      source: sourceName,
      minzoom: 7,
      maxzoom: 20,
      // 'all' checks 2 conditions:  on this layer show only points or multipoints and only if not clustered
      filter: [
        "all",
        ["match", ["geometry-type"], pointType, true, false],
        ["!", ["has", "point_count"]],
      ],
      //prettier-ignore
      paint: {
        //increase circle radius (in pixels) when zooming in
        // see https://docs.mapbox.com/help/tutorials/mapbox-gl-js-expressions/
        
        "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            8, 5.0, // 5px at zoom level 8
            12, 15.0,
            16, 25.0,
        ],
        // style color based on amenity type
        "circle-color": [
            "match",
            //["get", "amenity", ["get", "tags"]],    //* wird automatisch "geflattened"!
            ["get", "amenity"],
            "bar", "#fbb03b",
            "restaurant", "#223b53",
            "supermarket", "#3bb2d0",
            "#eeeeee", // fallback color for others
        ],
        "circle-opacity": [
            "interpolate", ["linear"], ["zoom"], 
            7, 0.0, 
            12, 0.5, 
            18, 1.0,
        ],
        //"circle-blur": 0.3,
      },
    };

    const lineLayer: Layer = {
      id: sourceName + "-l2",
      type: "line",
      source: sourceName,
      minzoom: 7,
      maxzoom: 20,
      filter: ["match", ["geometry-type"], lineType, true, false],
      paint: {
        "line-color": "rgba(255, 0, 0, 255)",
        "line-width": 8,
      },
    };

    const polygonFillLayer: Layer = {
      id: sourceName + "-l3",
      type: "fill",
      //TODO extract types as an enum
      //TODO would "==" be more efficient than "match" ?
      filter: ["match", ["geometry-type"], polygonType, true, false],
      source: sourceName,
      minzoom: 7,
      maxzoom: 20,
      paint: {
        "fill-color": "rgba(123,123,255,0.6)",
        "fill-opacity": 0.8,
      },
    };

    /*
    //*add line strokes around polygons as there is no stroke paint property for polygons for performance reasons
    const polygonOutlineLayer: Layer = {
      id: sourceName + "-l4",
      type: "line",
      filter: ["match", ["geometry-type"], polygonType, true, false],
      source: sourceName,
      paint: {
        "line-color": "rgba(13, 13, 13, 60)",
        "line-width": 50,
        "line-blur": 4,
        "line-opacity": 0.5,
        //"line-gap-width": 20,
      },
    };
    */

    //show points below the map symbols
    this.addNewLayer(pointLayer, true);
    //show lines
    this.addNewLayer(lineLayer, true);
    //show filled polygons
    this.addNewLayer(polygonFillLayer, true);
  }

  /**
   * Find the first layer with the given type and return its id (or undefined if no layer with that type exists).
   */
  findLayerByType(layerType: mapboxLayerType): string | undefined {
    const layers = map.getStyle().layers;

    if (layers) {
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === layerType) {
          return layers[i].id;
        }
      }
    }
    return undefined;
  }

  addWithinStyleLayer(): void {
    //TODO
    //"paint": {"fill-color": ["case", ["within", poylgonjson], "black", "red"]}
  }

  addHeatmapLayer(data?: string): void {
    const heatmap = new Heatmap(data);
    heatmap.show();
  }
}

export default new MapLayerManager();
