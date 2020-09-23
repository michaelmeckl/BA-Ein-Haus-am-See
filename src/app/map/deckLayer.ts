import { HeatmapLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import { Deck, Layer } from "@deck.gl/core";
import { ArcLayer, GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxLayer } from "@deck.gl/mapbox";
import { initialPosition, initialZoomLevel, map } from "./mapboxConfig";

type supportedLayers =
  | "GeoJsonLayer"
  | "ScatterplotLayer"
  | "HeatmapLayer"
  | "MapboxLayer"
  | "ArcLayer";

type layerArray = (
  | GeoJsonLayer<unknown>
  | (ScatterplotLayer<unknown, any> | HeatmapLayer<unknown>)[]
  | ArcLayer<unknown, any>
  | null
)[];

// source: Natural Earth http://www.naturalearthdata.com/ via geojson.xyz
const AIR_PORTS =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_airports.geojson";

const INITIAL_VIEW_STATE = {
  latitude: initialPosition[1],
  longitude: initialPosition[0],
  zoom: initialZoomLevel,
  bearing: 0,
};

//TODO client width and heigth instead??
const mapCanvas = map.getCanvas();
const deckProperties = {
  width: mapCanvas.width,
  height: mapCanvas.height,
  initialViewState: INITIAL_VIEW_STATE,
  controller: true,
  layers: [],
  effects: [],
};

let deckglLayer: Deck;

function createGeojsonLayer(data: string): GeoJsonLayer<any> {
  return new GeoJsonLayer({
    id: "geojsonLayer",
    data: AIR_PORTS,
    // Styles
    stroked: true,
    filled: true,
    lineWidthScale: 20,
    lineWidthMinPixels: 2,
    pointRadiusMinPixels: 2,
    pointRadiusScale: 2000,
    getRadius: (f: { properties: { scalerank: number } }) => 11 - f.properties.scalerank,
    getFillColor: [200, 0, 80, 180],
    getLineColor: (d) => colorToRGBArray(d.properties.color),
    getLineWidth: 1,
    // Interactive props
    pickable: true,
    autoHighlight: true,
    onClick: (info: { object: { properties: { name: any; abbrev: any } } }) =>
      // eslint-disable-next-line
      info.object && alert(`${info.object.properties.name} (${info.object.properties.abbrev})`),
  });
}

function createScatterplotLayer(data: string): ScatterplotLayer<any> {
  return new ScatterplotLayer({
    id: "scatterplotLayer",
    //TODO data: data,
    data: [{ position: [-122.45, 37.8], color: [255, 0, 0], radius: 100 }],
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    getColor: (color: any) => color,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    getRadius: (radius: any) => radius,
    //getRadius: (d: {radius: number}) => d.radius,
  });
}

function createMapboxLayer(data: string): MapboxLayer<any> {
  return new MapboxLayer({
    id: "mapboxLayer",
    type: ScatterplotLayer,
    data: [{ position: [-74.5, 40], size: 100 }],
    getPosition: (d: { position: any }) => d.position,
    getRadius: (d: { size: any }) => d.size,
    getColor: [255, 0, 0],
  });
}

//TODO
function addMapboxLayerAlternative(): void {
  const DATA_URL =
    "https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/3d-heatmap/heatmap-data.csv";

  const COLOR_RANGE = [
    [1, 152, 189],
    [73, 227, 206],
    [216, 254, 181],
    [254, 237, 177],
    [254, 173, 84],
    [209, 55, 78],
  ];
  const LIGHT_SETTINGS = {
    lightsPosition: [-0.144528, 49.739968, 8000, -3.807751, 54.104682, 8000],
    ambientRatio: 0.4,
    diffuseRatio: 0.6,
    specularRatio: 0.2,
    lightsStrength: [0.8, 0.0, 0.8, 0.0],
    numberOfLights: 2,
  };

  let hexagonLayer;
  map.on("load", () => {
    hexagonLayer = new MapboxLayer({
      type: HexagonLayer,
      id: "heatmap",
      //data: d3.csv(DATA_URL),
      data: AIR_PORTS,
      radius: 2000,
      coverage: 1,
      upperPercentile: 100,
      colorRange: COLOR_RANGE,
      elevationRange: [0, 1000],
      elevationScale: 250,
      extruded: true,
      getPosition: (d) => [Number(d.lng), Number(d.lat)],
      lightSettings: LIGHT_SETTINGS,
      opacity: 1,
      pickable: true,
      autoHighlight: true,
      onClick: console.log,
    });

    map.addLayer(hexagonLayer, "waterway-label");
  });
}

function createHeatmapLayer(data: string): HeatmapLayer<any> {
  return new HeatmapLayer({
    id: "heatmapLayer",
    data: AIR_PORTS,
    pickable: false,
    getPosition: (d) => [d[0], d[1]],
    getWeight: (d) => d[2],
    intensity: 1,
    threshold: 0.03,
    radiusPixels: 30,
  });
}

function createArcLayer(data: string): ArcLayer<any> {
  return new ArcLayer({
    id: "arcLayer",
    data: AIR_PORTS,
    dataTransform: (d: { features: any[] }) =>
      d.features.filter((f: { properties: { scalerank: number } }) => f.properties.scalerank < 4),
    // Styles
    getSourcePosition: (f: any) => [-0.4531566, 51.4709959], // London
    getTargetPosition: (f: { geometry: { coordinates: any } }) => f.geometry.coordinates,
    getSourceColor: [0, 128, 200],
    getTargetColor: [200, 0, 80],
    getWidth: 1,
  });
}

export function getDeckGlLayer(layerType: supportedLayers, data: string): Deck {
  let layer: Layer<any> | MapboxLayer<any>;

  switch (layerType) {
    case "HeatmapLayer":
      layer = createHeatmapLayer(data);
      break;
    case "MapboxLayer":
      layer = createMapboxLayer(data);
      break;
    case "ScatterplotLayer":
      layer = createScatterplotLayer(data);
      break;
    case "ArcLayer":
      layer = createArcLayer(data);
      break;
    case "GeoJsonLayer":
      layer = createGeojsonLayer(data);
      break;
    default:
      throw new Error("Unknown Layer Type provided to Deck.gl!");
  }

  deckProperties.layers.push(layer);

  //eslint-disable-next-line
  deckglLayer = new Deck(deckProperties);
  return deckglLayer;
}

export function removeDeckLayer(layerId: string) {
  const layers = deckglLayer.props.layers;
  for (let i = layers.length - 1; i > 0; i--) {
    const layer = layers[i];
    if (layer.id === layerId) {
      layers.splice(i, 1);
      break;
    }
  }
}

/**
 * TODO map sollte auf interactive false gesetzt werden
const map = new mapboxgl.Map({
  ...
  // Note: deck.gl will be in charge of interaction and event handling
  interactive: false,
  ...
});

// TODO besseres Beispiel für Layer auf Mapbox:
export const deck = new Deck({
  canvas: 'deck-canvas',
  width: '100%',
  height: '100%',
  initialViewState: INITIAL_VIEW_STATE,
  controller: true,
  onViewStateChange: ({viewState}) => {
    map.jumpTo({
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      bearing: viewState.bearing,
      pitch: viewState.pitch
    });
  },
});

 */
