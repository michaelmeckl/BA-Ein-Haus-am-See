/* eslint-disable no-magic-numbers */
import { HeatmapLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import { Deck, Layer, PostProcessEffect, RGBAColor } from "@deck.gl/core";
import type { DeckProps, InitialViewStateProps } from "@deck.gl/core/lib/deck";
import type { LayerProps } from "@deck.gl/core/lib/layer";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxLayer } from "@deck.gl/mapbox";
import { initialPosition, initialZoomLevel, map } from "./mapboxConfig";
import { triangleBlur, tiltShift } from "@luma.gl/shadertools";

type supportedLayers = "GeojsonLayer" | "ScatterplotLayer" | "HeatmapLayer";

const initialViewState: InitialViewStateProps = {
  latitude: initialPosition[1],
  longitude: initialPosition[0],
  zoom: initialZoomLevel,
  bearing: 0,
  pitch: 0,
};

/*
const postProcessEffect = new PostProcessEffect(tiltShift, {
  blurRadius: 15,
});
*/
const postProcessEffect = new PostProcessEffect(triangleBlur, {
  radius: 7,
});

const mapCanvas = map.getCanvas();

const deckProperties: DeckProps = {
  //canvas: document.querySelector("#test_canvas") as HTMLCanvasElement,
  //canvas: document.createElement("canvas") as HTMLCanvasElement,
  width: mapCanvas.clientWidth,
  height: mapCanvas.clientHeight,
  initialViewState: initialViewState,
  controller: true,
  effects: [postProcessEffect], // add postprocess effects to the layers
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
    //getRadius: (f: { properties: { scalerank: number } }) => 11 - f.properties.scalerank,
    getRadius: 0.7,
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
    //data: data,
    data: [
      {
        position: [12.09582, 49.01343],
        color: [255, 0, 0],
        radius: 100,
      },
      {
        position: [12.29579, 49.01323],
        color: [0, 0, 255],
        radius: 100,
      },
      {
        position: [12.09572, 49.03443],
        color: [255, 0, 255],
        radius: 40,
      },
      {
        position: [12.12533, 49.01343],
        color: [255, 255, 0],
        radius: 100,
      },
    ],
    // accessors loop over the provided data
    getFillColor: (d: any): RGBAColor => d.color, // access the color attribute in the data above with d.color
    getRadius: (d: any): number => d.radius,
  });
}

function createHeatmapLayer(data: string): HeatmapLayer<any> {
  return new HeatmapLayer({
    id: "heatmapLayer",
    //data: data, //TODO die geodaten in assets funktionieren nicht, da im falschen format
    data: [
      {
        position: [12.09582, 49.01343],
        color: [255, 0, 0],
        radius: 100,
      },
      {
        position: [12.09829, 49.05323],
        color: [0, 0, 255],
        radius: 100,
      },
      {
        position: [12.09572, 49.03443],
        color: [255, 0, 255],
        radius: 40,
      },
      {
        position: [12.09543, 49.01556],
        color: [255, 255, 0],
        radius: 100,
      },
    ],
    pickable: false,
    getPosition: (d: any) => {
      //console.log(d);
      return d.position;
      //return [Number(d.geometry.coordinates[0]), Number(d.geometry.coordinates[1])];
    },
    getWeight: (d: any) => 10,
    intensity: 1,
    threshold: 0.1, //* reduces the opacity of the pixels with relatively low weight to create a fading effect at the edge.
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

type BaseLayerType = typeof GeoJsonLayer | typeof HeatmapLayer | typeof ScatterplotLayer;

export function createMapboxLayer(geoData: string, baseType: BaseLayerType): MapboxLayer<any> {
  const l = new MapboxLayer({
    id: "mapboxLayer",
    // @ts-expect-error
    type: baseType,
    data: geoData,
    renderingMode: "2d",
    filled: true,
    //getPosition: (d: { position: any }) => d.position,
    getRadius: 20,
    getFillColor: [255, 0, 0],
    getLineColor: (d: any) => [245, 245, 245],
    getLineWidth: 1,
    lineWidthScale: 5,
    //lineWidthMinPixels: 2,
  });

  deckglLayer = new Deck(deckProperties);
  deckglLayer.setProps({
    effects: [postProcessEffect],
  });
  l.deck = deckglLayer;
  //l.map = map;

  //l.deck.setProps({ effects: [postProcessEffect] });
  // not working as context exists already
  /*
  const ctx = l.deck.canvas.getContext("2d");if (ctx) {
    ctx.filter = `blur(${30}px)`;
    //TODO oder: ctx.shadowBlur = blurAmount;
  }*/

  //deckProperties.layers?.push(l);

  console.log(l);
  console.log(l.deck); //null if not provided above
  console.log(l.map); //null  "   "

  return l;
}

// test to create another circle around the points
export function createNewMapboxLayer(geoData: string, baseType: BaseLayerType, radius = 100): any {
  const l = new MapboxLayer({
    id: "newMapboxLayer",
    // @ts-expect-error
    type: baseType,
    data: geoData,
    renderingMode: "2d",
    filled: true,
    //getPosition: (d: { position: any }) => d.position,
    getRadius: radius,
    getFillColor: (d: any) => [127, 127, 127],
    getLineColor: (d: any) => [127, 127, 127],
    getLineWidth: 1,
  });

  deckglLayer.setProps({
    effects: [postProcessEffect],
  });
  l.deck = deckglLayer;

  //deckglLayer.redraw(true);

  return l;
}
