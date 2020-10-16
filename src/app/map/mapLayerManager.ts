/* eslint-disable no-magic-numbers */
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  GeometryObject,
} from "geojson";
import type { CustomLayerInterface, GeoJSONSource, Layer } from "mapbox-gl";
import ClusterManager from "./clusterManager";
import { map } from "./mapboxConfig";
import Heatmap from "./heatmap";

// * Info: um ein bestimmtes tile an einer position zu bekommen, hilft das vllt: https://github.com/mapbox/tilebelt

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

  // Add a geojson source, see https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
  addNewGeojsonSource(
    sourceName: string,
    geojsonData?: string | Feature<Geometry, GeoJsonProperties> | FeatureCollection<Geometry, any>,
    clusteringEnabled = false
  ): void {
    let sourceOptions: mapboxgl.GeoJSONSourceOptions = {
      buffer: 70, // higher means fewer rendering artifacts near tile edges and decreased performance (max: 512)
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

    map.addSource(sourceName, { type: "geojson", ...sourceOptions });
    //console.log("Source: ", map.getSource(sourceName));

    if (clusteringEnabled) {
      const clusterManager = new ClusterManager(sourceName);

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

  //TODO add min and maxZoom to each layer for performance reasons!
  addLayers(sourceName: string): void {
    //! with ["has", "name"] it can be tested if something exists in the properties (and should be because errors
    //! have an impact on the performance!)
    const pointLayer: Layer = {
      id: sourceName + "-l1",
      type: "circle",
      source: sourceName,
      // 'all' checks 2 conditions:  on this layer show only points or multipoints and only if not clustered
      filter: [
        "all",
        ["match", ["geometry-type"], pointType, true, false],
        ["!", ["has", "point_count"]],
      ],
      //interactive: true,
      layout: {
        //"visibility": "visible",
      },
      //prettier-ignore
      paint: {
        //increase circle radius (in pixels) when zooming in
        // see https://docs.mapbox.com/help/tutorials/mapbox-gl-js-expressions/
        "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            0, 0.0,
            8, 4.0, // 4px at zoom level 8
            //12, ["/", ["get", "zoom"], 3], //TODO adjust expression values
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
            "#ff0000", // fallback color for others
        ],
        "circle-stroke-width": [
            "interpolate", ["linear"], ["zoom"],
            4, 0.0,
            10, 15,
            15, 52,
            20, 90,
        ],
        "circle-stroke-color": "rgba(100, 100, 100, 100)",
        "circle-stroke-opacity": [
            "interpolate", ["linear"], ["zoom"],
            4, 0.0,
            6, 0.08,
            15, 0.2,
            20, 0.25,
        ],
        "circle-opacity": [
            "interpolate", ["linear"], ["zoom"], 
            4, 0.0, 
            12, 0.5, 
            20, 1.0,
        ],
        "circle-blur": 0.3,
      },
    };

    const lineLayer: Layer = {
      id: sourceName + "-l2",
      type: "line",
      source: sourceName,
      filter: ["match", ["geometry-type"], lineType, true, false],
      paint: {
        "line-color": "rgba(255, 0, 0, 255)",
        "line-width": 8,
        "line-blur": 8,
        //"line-offset": 3,
        //"line-opacity": 0.5,
        //"line-gap-width": 20, // renders a second line 20 pixes away
      },
    };

    const polygonFillLayer: Layer = {
      id: sourceName + "-l3",
      type: "fill",
      //TODO extract types as an enum
      //TODO would "==" be more efficient than "match" ?
      filter: ["match", ["geometry-type"], polygonType, true, false],
      source: sourceName,
      paint: {
        //"fill-outline-color": "rgba(0,0,0,0.3)",
        "fill-outline-color": "rgba(255,255,255,0.9)", //to render white outlines around the polygon
        "fill-color": "rgba(123,123,255,0.6)",
        "fill-opacity": 0.6,
      },
    };

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

    //show points below the map symbols
    this.addNewLayer(pointLayer, true);
    //show lines
    this.addNewLayer(lineLayer, true);
    //show filled polygons
    this.addNewLayer(polygonFillLayer, true);
    //show polygon outlines
    //this.addNewLayer(polygonOutlineLayer, true);
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

  /**
   * * Um vektor sources hinzuzufügen müssen die sourcelayer angegeben werden!
   * * Um das sourceLayer herauszufinden, könnte das tileinfo-package nützlich sein (https://www.npmjs.com/package/tileinfo)
   * * oder alternativ auch https://github.com/mapbox/vector-tile-js
   */
  addVectorLayer(data: string): void {
    //TODO add to active layers by calling the addNewLayer-Method
    /*
    map.addSource("tv", {
      type: "vector",
      url: data,
    });

    map.addLayer({
      id: "tv",
      type: "circle",
      source: "tv",
      "source-layer": "Regensburg_Test",
      paint: {
        "circle-color": "#ff69b4",
      },
    });*/

    // Test für eigenen TileServer
    map.addSource("customTiles", {
      type: "vector",
      tiles: [data],
    });

    map.addLayer({
      id: "customTiles",
      type: "line",
      source: "customTiles",
      "source-layer": "state",
      paint: {
        "line-color": "#ff69b4",
      },
    });
  }

  addLocalVectorData(): void {
    //TODO add to active layers by calling the addNewLayer-Method
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

  addIconLayer(sourceName: string): void {
    //TODO add to active layers by calling the addNewLayer-Method
    map.addLayer({
      id: sourceName + "-symbol",
      type: "symbol",
      source: sourceName,
      layout: {
        "icon-image": [
          "match",
          ["get", "amenity"],
          "bar",
          "bar-11",
          "marker-11", // other
        ],
        "icon-allow-overlap": true,
      },
    });
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
