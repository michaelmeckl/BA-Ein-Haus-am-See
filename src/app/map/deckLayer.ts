/* eslint-disable no-magic-numbers */
import { HeatmapLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import { Deck, Layer, RGBAColor } from "@deck.gl/core";
import type { DeckProps, InitialViewStateProps } from "@deck.gl/core/lib/deck";
import type { LayerProps } from "@deck.gl/core/lib/layer";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxLayer } from "@deck.gl/mapbox";
import { initialPosition, initialZoomLevel, map } from "./mapboxConfig";

type supportedLayers = "GeojsonLayer" | "ScatterplotLayer" | "HeatmapLayer";

/*
type layerArray = (
  | GeoJsonLayer<unknown>
  | (ScatterplotLayer<unknown, any> | HeatmapLayer<unknown>)[]
  | null
)[];
*/

// source: Natural Earth http://www.naturalearthdata.com/ via geojson.xyz
const AIR_PORTS =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_airports.geojson";

const initialViewState: InitialViewStateProps = {
  latitude: initialPosition[1],
  longitude: initialPosition[0],
  zoom: initialZoomLevel,
  bearing: 0,
  pitch: 0,
};

//TODO client width and heigth instead??
const mapCanvas = map.getCanvas();

const deckProperties: DeckProps = {
  width: mapCanvas.clientWidth,
  height: mapCanvas.clientHeight,
  initialViewState: initialViewState,
  controller: true,
  effects: [],
  layers: [] as Layer<any, LayerProps<any>>[], // init as an empty array of Deckgl Layer Type
  // change the map's viewstate whenever the view state of deck.gl changes
  onViewStateChange: (change: {
    interactionState: {
      inTransition?: boolean;
      isDragging?: boolean;
      isPanning?: boolean;
      isRotating?: boolean;
      isZooming?: boolean;
    };
    viewState: any;
    oldViewState: any;
  }): any => {
    //console.log(change);
    map.jumpTo({
      center: [change.viewState.longitude, change.viewState.latitude],
      zoom: change.viewState.zoom,
      bearing: change.viewState.bearing,
      pitch: change.viewState.pitch,
    });
  },
};

let deckglLayer: Deck;

function createGeojsonLayer(data: string): GeoJsonLayer<any> {
  return new GeoJsonLayer({
    id: "geojsonLayer",
    data: data,
    // Styles
    stroked: true,
    filled: true,
    lineWidthScale: 20,
    lineWidthMinPixels: 2,
    pointRadiusMinPixels: 2,
    pointRadiusScale: 200,
    //accessors
    getRadius: (f: { properties: { scalerank: number } }) => 11 - f.properties.scalerank,
    getFillColor: [200, 0, 80, 180],
    getLineWidth: 1,
    // Interactive props
    pickable: true,
    autoHighlight: true,
  });
}

function createScatterplotLayer(data: string): ScatterplotLayer<any> {
  return new ScatterplotLayer({
    id: "scatterplotLayer",
    //TODO data: data,
    data: [{ position: [-122.45, 37.8], color: [255, 0, 0], radius: 100 }],
    getColor: (color: RGBAColor): RGBAColor => color,
    getRadius: (radius: number): number => radius,
  });
}

function createHeatmapLayer(data: string): HeatmapLayer<any> {
  console.log("in createHeatmapLayer");

  return new HeatmapLayer({
    id: "heatmapLayer",
    data: data,
    pickable: false,
    getPosition: (d) => [Number(d[0]), Number(d[1])],
    getWeight: (d) => Number(d[2]),
    intensity: 1,
    threshold: 0.6, // TODO reduces the opacity of the pixels with relatively low weight to create a fading effect at the edge.
    radiusPixels: 40,
  });
}

export function getDeckGlLayer(layerType: supportedLayers, data: string): Deck {
  let layer: Layer<any>;

  switch (layerType) {
    case "HeatmapLayer":
      layer = createHeatmapLayer(data);
      break;
    case "ScatterplotLayer":
      layer = createScatterplotLayer(data);
      break;
    case "GeojsonLayer":
      layer = createGeojsonLayer(data);
      break;
    default:
      throw new Error("Unknown Layer Type provided to Deck.gl!");
  }

  //console.log("layer: ", layer);

  deckProperties.layers?.push(layer);

  deckglLayer = new Deck(deckProperties);
  return deckglLayer;
}

export function removeDeckLayer(layerId: string): void {
  const layers = deckglLayer.props.layers;
  for (let i = layers.length - 1; i > 0; i--) {
    const layer = layers[i];
    if (layer.id === layerId) {
      layers.splice(i, 1);
      break;
    }
  }
}

export function createMapboxLayer(geoData: string): MapboxLayer<any> {
  return new MapboxLayer({
    id: "mapboxLayer",
    // @ts-expect-error :
    type: GeoJsonLayer,
    data: geoData,
    filled: true,
    //getPosition: (d: { position: any }) => d.position,
    getRadius: 20,
    getFillColor: [255, 0, 0],
    getLineColor: (d: any) => [245, 245, 245],
    getLineWidth: 1,
    lineWidthScale: 5,
    //lineWidthMinPixels: 2,
    onClick: console.log,
  });

  // * update the layer later in the code
  /*
  const key = radius;
  const value = 60;
  myLayer.setProps({
    getColor: [0, 0, 255],
    [key]: value
  });
  */
}
