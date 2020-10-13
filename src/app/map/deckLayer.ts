/* eslint-disable no-magic-numbers */
import { HeatmapLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import { Deck, Layer, LayerExtension, PostProcessEffect, RGBAColor } from "@deck.gl/core";
import type { DeckProps, InitialViewStateProps } from "@deck.gl/core/lib/deck";
import type { DataSet, LayerProps } from "@deck.gl/core/lib/layer";
import { GeoJsonLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxLayer } from "@deck.gl/mapbox";
import { initialPosition, initialZoomLevel, map } from "./mapboxConfig";
import { triangleBlur, tiltShift } from "@luma.gl/shadertools";
import GL from "@luma.gl/constants";

type supportedLayers = "GeojsonLayer" | "ScatterplotLayer" | "HeatmapLayer" | "PathLayer";

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
const deckCanvas = document.querySelector("#deck_canvas") as HTMLCanvasElement;

const deckProperties: DeckProps = {
  //TODO soll laut docu mit canvas gemacht werden, geht aber nicht richtig mit camera dann?
  //canvas: deckCanvas,
  width: "100%",
  height: "100%",
  initialViewState: initialViewState,
  controller: true,
  effects: [], // add postprocess effects to the layers
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

// * Layer Extension, see https://deck.gl/docs/developer-guide/custom-layers/layer-extensions
// can now be used even with composite layers like the GeojsonsLayer without overriding each of the layers its made of
class RedFilter extends LayerExtension {
  getShaders() {
    return {
      inject: {
        // Declare custom uniform
        "fs:#decl": "uniform bool highlightRed;",
        // Standard injection hook - see "Writing Shaders"
        "fs:DECKGL_FILTER_COLOR": `
          if (highlightRed) {
            if (color.r / max(color.g, 0.001) > 2. && color.r / max(color.b, 0.001) > 2.) {
              // is red
              color = vec4(1.0, 0.0, 0.0, 1.0);
            } else {
              discard;
            }
          }
        `,
      },
    };
  }

  updateState(params) {
    const { highlightRed = true } = params.props;
    for (const model of this.getModels()) {
      model.setUniforms({ highlightRed });
    }
  }

  //FIXME
  getSubLayerProps() {
    const { highlightRed = true } = params.props;
    return {
      highlightRed,
    };
  }
}

const customFragmentShader = `\
#define SHADER_NAME custom-scatterplot-layer-fragment-shader

precision highp float;

uniform float cornerRadius;

varying vec4 vFillColor;
varying vec2 unitPosition;

void main(void) {

  float distToCenter = length(unitPosition);

  /* Calculate the cutoff radius for the rounded corners */
  float threshold = sqrt(2.0) * (1.0 - cornerRadius) + 1.0 * cornerRadius;
  if (distToCenter <= threshold) {
    gl_FragColor = vFillColor;
  } else {
    discard;
  }

  gl_FragColor = picking_filterHighlightColor(gl_FragColor);

  gl_FragColor = picking_filterPickingColor(gl_FragColor);
}
`;

// * example for subclassing the ScatterplotLayer with custom shader
//TODO hiermit könnte ich die shader und die daten im decklayer direkt manipulieren -> bringt mir das so viel??
export default class CustomScatterplotLayer extends ScatterplotLayer<any> {
  initializeState() {
    super.initializeState();

    // * für attribute data in vertex shader:
    this.state.attributeManager.addInstanced({
      instanceRadiusPixels: { size: 1, accessor: "getRadius" },
    });
  }

  draw({ uniforms }) {
    super.draw({
      uniforms: {
        ...uniforms,
        cornerRadius: this.props.cornerRadius,
      },
    });
  }

  getShaders() {
    // use object.assign to make sure we don't overwrite existing fields like `vs`, `modules`...
    return Object.assign({}, super.getShaders(), {
      fs: customFragmentShader,
    });
  }
}

CustomScatterplotLayer.defaultProps = {
  //* für attribute oben
  getRadius: { type: "accessor", value: 1 },

  // cornerRadius: the amount of rounding at the rectangle corners
  // 0 - rectangle. 1 - circle.
  cornerRadius: 0.1,
};

//* 2 geojson layer? eins für die kreise und eins für die stroke?
// -> entweder mit separatem DeckLayer und einer neuen Deck Instance oder (vermutlich besser) als Composite-Layer
// vgl. https://deck.gl/docs/developer-guide/custom-layers/composite-layers
function createGeojsonLayer(data: string, name: string): GeoJsonLayer<any> {
  return new GeoJsonLayer({
    id: name,
    data: data,
    // Styles
    //stroked: true,
    filled: true,
    opacity: 0.8,
    pointRadiusMinPixels: 2,
    pointRadiusScale: 200,
    //accessors
    //getRadius: (f: { properties: { scalerank: number } }) => 11 - f.properties.scalerank,
    getRadius: 1.7,
    getFillColor: [53, 53, 53, 53],
    getLineColor: [0, 0, 0, 0],
    getLineWidth: 50,
    // Interactive props
    pickable: true,
    //parameters: () => GL.BLEND_DST_RGB,
    //extensions: [new RedFilter()], //TODO not working right now
  });
}

function createPathLayer(data: DataSet<any>, name: string): PathLayer<any> {
  const testData = [
    {
      path: [
        [12.089283, 48.9920256],
        [12.1025303, 48.9941069],
        [12.0909411, 49.0012031],
      ],
    },
  ];

  return new PathLayer({
    id: name,
    data: testData,
    pickable: true,
    widthScale: 20,
    widthMinPixels: 2,
    //getPath: d => d.path,
    getColor: (d) => [255, 0, 0, 127],
    getWidth: (d) => 2,
  });
}

function createScatterplotLayer(data: string, name: string): ScatterplotLayer<any> {
  //return new ScatterplotLayer({
  //TODO
  return new CustomScatterplotLayer({
    id: name,
    //data: data,
    data: [
      {
        position: [12.09582, 49.01343],
        color: [255, 0, 0],
        radius: 200,
      },
      {
        position: [12.11579, 49.01323],
        color: [0, 0, 255],
        radius: 300,
      },
      {
        position: [12.09572, 49.02443],
        color: [255, 0, 255],
        radius: 150,
      },
      {
        position: [12.08533, 49.01343],
        color: [0, 255, 0],
        radius: 200,
      },
    ],
    // accessors loop over the provided data
    getFillColor: (d: any): RGBAColor => d.color, // access the color attribute in the data above with d.color
    getRadius: (d: any): number => d.radius,
  });
}

function createHeatmapLayer(data: string, name: string): HeatmapLayer<any> {
  return new HeatmapLayer({
    id: name,
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

export function getDeckGlLayer(layerType: supportedLayers, data: string, name: string): Deck {
  let layer: Layer<any>;

  switch (layerType) {
    case "HeatmapLayer":
      layer = createHeatmapLayer(data, name);
      break;
    case "ScatterplotLayer":
      layer = createScatterplotLayer(data, name);
      break;
    case "GeojsonLayer":
      layer = createGeojsonLayer(data, name);
      break;
    case "PathLayer":
      layer = createPathLayer(data, name);
      break;
    default:
      throw new Error("Unknown Layer Type provided to Deck.gl!");
  }

  //console.log("layer: ", layer);
  deckProperties.layers?.push(layer);

  deckglLayer = new Deck(deckProperties);
  deckglLayer.setProps({
    effects: [postProcessEffect],
  });

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

type BaseLayerType =
  | typeof GeoJsonLayer
  | typeof HeatmapLayer
  | typeof ScatterplotLayer
  | typeof CustomScatterplotLayer;

export function createMapboxLayer(geoData: string, baseType: BaseLayerType): MapboxLayer<any> {
  const l = new MapboxLayer({
    id: "mapboxLayer",
    // @ts-expect-error
    type: baseType,
    //data: geoData,
    data: [
      {
        position: [12.09582, 49.01343],
        color: [255, 0, 0],
        radius: 100,
      },
      {
        position: [12.11579, 49.01323],
        color: [0, 0, 255],
        radius: 100,
      },
      {
        position: [12.09572, 49.02443],
        color: [255, 0, 255],
        radius: 40,
      },
      {
        position: [12.08533, 49.01343],
        color: [0, 255, 0],
        radius: 100,
      },
    ],
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

//* Alternative to the createMapboxLayer - Method that takes full adavantage of the Deck API
//! Does not work!!!
export function createMapboxDeck(geoData: string): void {
  //@ts-expect-error
  const deck = new Deck({
    //gl: map.getCanvas().getContext("webgl") as WebGLRenderingContext,
    gl: map.painter.context.gl,
    initialViewState: initialViewState,
    layers: [
      new GeoJsonLayer({
        id: "geojson-baselayer",
        data: geoData,
        filled: true,
        getRadius: 40,
        getFillColor: [53, 53, 53],
        getLineColor: (d: any) => [0, 0, 0, 255],
        getLineWidth: 1,
        lineWidthScale: 5,
      }),
    ],
  });

  map.addLayer(new MapboxLayer({ id: "mapboxDeckLayer", deck }), "waterway-label");

  //TODO nicht so, das zerschießt den map Canvas komplett
  /*
  deck.setProps({
    effects: [postProcessEffect],
  });
  */
}
