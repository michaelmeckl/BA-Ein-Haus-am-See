import mapboxgl from "mapbox-gl";

// make sure that MapboxGl (and WebGL) are supported in the browser
if (!mapboxgl.supported()) {
  throw new Error("Your browser does not support Mapbox GL!");
}

// provide Mapbox accessToken
if (!process.env.MapboxToken) {
  throw new Error("No valid Mapbox Token was provided!");
}
mapboxgl.accessToken = process.env.MapboxToken;

const lat = 49.008;
const lng = 12.1;
const initialPosition: [number, number] = [lng, lat]; // Regensburg
const initialZoomLevel = 12;

// remove unused layers and features with ?optimize=true
//const mapStyle = "mapbox://styles/mapbox/streets-v11?optimize=true";
const mapStyle = "mapbox://styles/mapbox/streets-v11";
//const mapStyle = ""../assets/osmscoutStyle.json"";  // path to local osmscout style which serves own hosted tiles

// setup map
const map = new mapboxgl.Map({
  container: "map",
  style: mapStyle, // stylesheet location
  center: initialPosition, // starting position: [lng, lat]
  zoom: initialZoomLevel, // starting zoom
  interactive: true,
  minZoom: 4, // as this website focuses on bavaria there is no need to show the lowest zoom levels (performance optimization)
  maxZoom: 20,
  hash: true, //sync map position with the hash fragment of the page's URL
  trackResize: true,
  antialias: false, // * set to true for antialiasing custom layers but this has a negative impact on performance
  preserveDrawingBuffer: false, // necessary to be able to export the map canvas as an image but has negative performance impact
});

//! resetting map like this not working, a deep copy is probably needed
/*
const originalMap: mapboxgl.Map = Object.assign(map);
//const originalMap: mapboxgl.Map = {...map};

export function resetMap(): void {
  map = Object.assign(originalMap);
}*/

export { map, initialPosition, initialZoomLevel };
