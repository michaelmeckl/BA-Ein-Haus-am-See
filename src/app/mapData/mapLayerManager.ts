/* eslint-disable no-magic-numbers */
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  GeometryObject,
} from "geojson";
import type { CustomLayerInterface, Layer } from "mapbox-gl";
import { map } from "../map/mapboxConfig";
import Legend from "./legend";
import { TagColors } from "./osmTagCollection";
//import ClusterManager from "../map/clusterManager";

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
//! clustering does work but needs some improvement (not used in the final version)
const bar = ["==", ["get", "amenity"], "Bar"];
const restaurant = ["==", ["get", "amenity"], "Restaurant"];
const supermarket = ["==", ["get", "amenity"], "Supermarket"];
const cafe = ["==", ["get", "amenity"], "Cafe"];
const other = ["==", ["get", "amenity"], ""];

/**
 * Util-Class to handle all sorts of source and layer related methods and keep track of all active (or hidden)
 * layers on the map that were created by the user.
 */
class MapLayerManager {
  private visibleLayers: (Layer | CustomLayerInterface)[] = [];
  private hiddenLayers: (Layer | CustomLayerInterface)[] = []; //! not used yet

  // small performance optimizations:
  private minZoom = 6; // Bavaria can be seen as a whole on this level
  private maxZoom = 20;

  private legend: Legend;
  private legendIsShown = false;

  geojsonSourceActive = false; // keep track of the type of shown mapbox layer (i.e. geojson or canvas)

  constructor() {
    this.legend = new Legend();
  }

  get currentVisibleLayers(): (Layer | CustomLayerInterface)[] {
    return this.visibleLayers;
  }

  get currentHiddenLayers(): (Layer | CustomLayerInterface)[] {
    return this.hiddenLayers;
  }

  /**
   * ####################################
   * Methods related to mapbox sources (see https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/)
   * ####################################
   */

  // Add a geojson source, see https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
  addNewGeojsonSource(
    tagName: string,
    geojsonData?:
      | string
      | Feature<Geometry, GeoJsonProperties>
      | FeatureCollection<Geometry, GeoJsonProperties>,
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
    this.geojsonSourceActive = true;

    this.updateLegend(tagName);

    /*
    if (clusteringEnabled) {
      const clusterManager = new ClusterManager(tagName);

      //TODO return the cluster layers so they can be added to the activeLayers array
      clusterManager.addClusterLayer();
      
    }*/
  }

  removeGeojsonSource(sourceName: string): void {
    if (!map.getSource(sourceName)) {
      console.log(`Couldn't remove source ${sourceName}`);
      return;
    }
    this.removeAllLayersForSource(sourceName);
    map.removeSource(sourceName);

    //remove from legend
    this.removeSourceFromLegend(sourceName);
  }

  /**
   * Update the data source of a given source layer. Only works for GeoJson layer.
   */
  updateGeojsonSource(
    id: string,
    data: FeatureCollection<GeometryObject, GeoJsonProperties>
  ): boolean {
    const source = map.getSource(id);
    if (source.type === "geojson") {
      const result = source.setData(data);
      return result ? true : false;
    }
    return false;
  }

  addNewCanvasSource(sourceName: string, canvas: HTMLCanvasElement, bounds: number[][]): void {
    const sourceOptions: mapboxgl.CanvasSourceOptions = {
      canvas: canvas,
      animate: false, //static canvas for better performance
      coordinates: bounds,
    };
    map.addSource(sourceName, {
      type: "canvas",
      ...sourceOptions,
    });
  }

  removeCanvasSource(sourceID: string): void {
    if (!map.getSource(sourceID)) {
      console.log(`Source ${sourceID} doesnt exist!`);
      return;
    }
    this.removeCanvasLayer("overlay");
    map.removeSource(sourceID);
  }

  /*
  updateCanvasSource(sourceId: string, newCanvas: HTMLCanvasElement, newCoords: number[][]): void {
    const source = map.getSource(sourceId) as CanvasSource;
    source.coordinates = newCoords;
    const oldCanvas = source.getCanvas();
    const ctx = oldCanvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(newCanvas, 0, 0);
    } else {
      console.warn("Error no ctx");
    }
  }*/

  /**
   * ####################################
   * Methods related to the legend (based on the sources above)
   * ####################################
   */

  //add item to legend and show it if it isn't shown already
  private updateLegend(tagName: string): void {
    const color = TagColors.get(tagName);

    if (!color) {
      //console.warn("Couldn't get color for tag: ", tagName);
      return;
    }

    if (!this.legendIsShown) {
      this.legend.show(tagName, color);
      this.legendIsShown = true;
    } else {
      this.legend.addItem(tagName, color);
    }
  }

  private removeSourceFromLegend(sourceId: string): void {
    const wasLast = this.legend.removeItem(sourceId);
    if (wasLast) {
      // if this was the only legend item, hide the legend
      this.legend.hide();
      this.legendIsShown = false;
      this.geojsonSourceActive = false;
    }
  }

  /**
   * ####################################
   * Methods related to mapbox layers (see https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/)
   * ####################################
   */

  /**
   * Util-Function to create a new layer that allows to specify if the new layer should be added on top
   * of the map (default, beforeSymbols = false) or below the map symbols (beforeSymbols = true).
   *! This method should always be called when adding a new layer to make sure the new layer gets added to the
   *! local "activeLayers" - Array.
   */
  addNewGeojsonLayer(layer: Layer | CustomLayerInterface, beforeSymbols = false): void {
    //console.log("add new layer: ", layer);

    // show on map
    if (beforeSymbols) {
      map.addLayer(layer, "waterway-label");
    } else {
      map.addLayer(layer);
    }

    // add to local list
    this.visibleLayers.push(layer);
  }

  //! hiding not used yet
  hideGeojsonLayer(layer: Layer | CustomLayerInterface): void {
    //console.log("hiding layer: ", layer);

    //hide layer on map
    map.setLayoutProperty(layer.id, "visibility", "none");

    //switch layer to the local hidden layers list
    this.visibleLayers = this.visibleLayers.filter((el) => el.id !== layer.id);
    this.hiddenLayers.push(layer);

    /*
    //remove it from the legend
    this.removeSourceFromLegend();
    */
  }

  removeGeojsonLayerFromMap(layerId: string): void {
    //remove it from the map
    map.removeLayer(layerId);

    // remove it from the local lists by filtering it out
    this.visibleLayers = this.visibleLayers.filter((el) => el.id !== layerId);
    this.hiddenLayers = this.hiddenLayers.filter((el) => el.id !== layerId);
  }

  /**
   * Delete all layers for the source with the given ID.
   */
  removeAllLayersForSource(sourceID: string): void {
    // eslint-disable-next-line no-unused-expressions
    map.getStyle().layers?.forEach((layer) => {
      if (layer.source === sourceID) {
        //console.log("deleting layer:" + JSON.stringify(layer));

        this.removeGeojsonLayerFromMap(layer.id);
      }
    });
  }

  removeCanvasLayer(layerID: string): void {
    map.removeLayer(layerID);
    // remove it from the local list
    this.visibleLayers = this.visibleLayers.filter((el) => el.id !== layerID);
  }

  addLayersForSource(sourceName: string): void {
    const tagColor = TagColors.get(sourceName);

    //! with ["has", "name"] it can be tested if something exists in the geojson properties

    const pointLayer: Layer = {
      id: sourceName + "-l1",
      type: "circle",
      source: sourceName,
      minzoom: this.minZoom,
      maxzoom: this.maxZoom,
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
            6, 1.0, // = 1px at zoom level 6
            10, 4.0,
            20, 8.0,
        ],
        // style color based on amenity type
        "circle-color": tagColor,
        "circle-opacity": [
            "interpolate", ["linear"], ["zoom"], 
            6, 0.0, 
            10, 0.7, 
            14, 1.0,
        ],
        //"circle-blur": 0.3,
      },
    };

    const lineLayer: Layer = {
      id: sourceName + "-l2",
      type: "line",
      source: sourceName,
      minzoom: this.minZoom,
      maxzoom: this.maxZoom,
      filter: ["match", ["geometry-type"], lineType, true, false],
      paint: {
        "line-color": tagColor,
        "line-width": 7,
      },
    };

    const polygonFillLayer: Layer = {
      id: sourceName + "-l3",
      type: "fill",
      filter: ["match", ["geometry-type"], polygonType, true, false],
      source: sourceName,
      minzoom: this.minZoom,
      maxzoom: this.maxZoom,
      paint: {
        "fill-color": tagColor,
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

    //! add the layers to the map and show them below the map symbols so they don't hide labels and names
    this.addNewGeojsonLayer(pointLayer, true);
    this.addNewGeojsonLayer(lineLayer, true);
    this.addNewGeojsonLayer(polygonFillLayer, true);
  }

  addCanvasLayer(id: string, layerId: string, opacity: number): void {
    const overlayLayer: Layer = {
      id: layerId,
      source: id,
      type: "raster",
      paint: {
        "raster-opacity": opacity,
      },
    };

    map.addLayer(overlayLayer);

    // add to local list
    this.visibleLayers.push(overlayLayer);
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

  removeAllDataFromMap(): void {
    //console.log("Sources: ", map.getStyle().sources);

    //clear all sources on map
    const allSources = map.getStyle().sources;
    for (const source in allSources) {
      //! "composite" is the default vector layer of mapbox-streets; don't delete this!
      if (source !== "composite") {
        if (source === "overlaySource") {
          this.removeCanvasSource(source);
        } else {
          this.removeGeojsonSource(source);
        }
      }
    }

    this.geojsonSourceActive = false;

    //clear local lists
    this.visibleLayers.length = 0;
    this.hiddenLayers.length = 0;

    //hide legend
    if (this.legendIsShown) {
      this.legend.hide();
      this.legendIsShown = false;
    }
  }

  //! Classic Heatmap does work, but isn't selectable as a visual type in the UI yet
  /*
  addHeatmapLayer(data?: string): void {
    const heatmap = new Heatmap(data);
    heatmap.show();
  }
  */
}

export default new MapLayerManager();
