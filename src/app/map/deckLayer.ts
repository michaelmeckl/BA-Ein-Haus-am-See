import { Deck } from "@deck.gl/core";
import { ArcLayer, GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";

// source: Natural Earth http://www.naturalearthdata.com/ via geojson.xyz
const COUNTRIES =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_scale_rank.geojson";
const AIR_PORTS =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_airports.geojson";

const INITIAL_VIEW_STATE = {
  latitude: 51.47,
  longitude: 0.45,
  zoom: 4,
  bearing: 0,
  pitch: 30,
};

const deck = new Deck({
  width: 0,
  height: 0,
  effects: [],
  initialViewState: INITIAL_VIEW_STATE,
  controller: true,
  layers: [
    new ScatterplotLayer({
      data: [{ position: [-122.45, 37.8], color: [255, 0, 0], radius: 100 }],
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      getColor: (color: any) => color,
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      getRadius: (radius: any) => radius,
      //getRadius: (d: {radius: number}) => d.radius,
    }),
  ],
});

export const deckgl = new Deck({
  width: 0,
  height: 0,
  effects: [],
  initialViewState: INITIAL_VIEW_STATE,
  controller: true,
  layers: [
    new GeoJsonLayer({
      id: "base-map",
      data: COUNTRIES,
      // Styles
      stroked: true,
      filled: true,
      lineWidthMinPixels: 2,
      opacity: 0.4,
      getLineColor: [60, 60, 60],
      getFillColor: [200, 200, 200],
    }),
    new GeoJsonLayer({
      id: "airports",
      data: AIR_PORTS,
      // Styles
      filled: true,
      pointRadiusMinPixels: 2,
      pointRadiusScale: 2000,
      getRadius: (f: { properties: { scalerank: number } }) => 11 - f.properties.scalerank,
      getFillColor: [200, 0, 80, 180],
      // Interactive props
      pickable: true,
      autoHighlight: true,
      // eslint-disable-next-line
      onClick: (info: { object: { properties: { name: any; abbrev: any } } }) =>
        info.object && alert(`${info.object.properties.name} (${info.object.properties.abbrev})`),
    }),
    new ArcLayer({
      id: "arcs",
      data: AIR_PORTS,
      dataTransform: (d: { features: any[] }) =>
        d.features.filter((f: { properties: { scalerank: number } }) => f.properties.scalerank < 4),
      // Styles
      getSourcePosition: (f: any) => [-0.4531566, 51.4709959], // London
      getTargetPosition: (f: { geometry: { coordinates: any } }) => f.geometry.coordinates,
      getSourceColor: [0, 128, 200],
      getTargetColor: [200, 0, 80],
      getWidth: 1,
    }),
  ],
});
