import mapboxgl, { LngLatLike } from "mapbox-gl";

// make sure that MapboxGl (and WebGL) are supported in the browser
if (!mapboxgl.supported()) {
  throw new Error("Your browser does not support Mapbox GL!");
}

// provide Mapbox accessToken
if (!process.env.MapboxToken) {
  throw new Error("No valid Mapbox Token was provided!");
}
mapboxgl.accessToken = process.env.MapboxToken;

// default api to request tiles, styles, ...
// TODO could be used to load tiles from own tileserver
//mapboxgl.baseApiUrl = "https://api.mapbox.com";

// osm-scout server
//mapboxgl.baseApiUrl = "http://192.168.178.43/v1/mbgl/style?style=osmbright";
//mapboxgl.baseApiUrl = "http://192.168.178.43:8553/v1/mbgl/style?style=osmbright";
//mapboxgl.baseApiUrl = "http://127.0.0.1:8553/v1/mbgl/style?style=osmbright";
//mapboxgl.baseApiUrl = "http://192.168.99.103:8553/v1/mbgl/style?style=osmbright";

const lat = 49.008;
const lng = 12.1;
const initialPosition: LngLatLike = [lng, lat]; // Regensburg
const initialZoomLevel = 12;

// remove unused layers and features with ?optimize=true
//TODO test performance with optimize!
//const mapStyle = "mapbox://styles/mapbox/streets-v11?optimize=true";

const mapStyle = "mapbox://styles/mapbox/streets-v11";

//TODO der osmscout style ist nicht allzu hübsch, theoretisch kann aber einfach der mapbox style heruntergeladen und die tile requests ausgetauscht werden zu eigenem osmscout server! ("http://localhost:8553/v1/mbgl/tile?z={z}&x={x}&y={y}")
//const mapStyle = "http://127.0.0.1:8553/v1/mbgl/style?style=osmbright";

// setup map
const map = new mapboxgl.Map({
  container: "map",
  style: mapStyle, // stylesheet location
  center: initialPosition, // starting position: [lng, lat]
  zoom: initialZoomLevel, // starting zoom
  minZoom: 4, // as this website focuses on bavaria there is no need to show the lowest zoom levels (performance optimization)
  maxZoom: 20,
  hash: true, //sync map position with the hash fragment of the page's URL
  trackResize: true, //TODO bessere performance wenn false?
  antialias: false, // set to true for antialiasing custom layers but this has a negative impact on performance
  //TODO nicht so toll für performance -> gibt es eine bessere Lösung?
  preserveDrawingBuffer: true, // necessary to be able to export the map canvas as an image
});

export { map, initialPosition, initialZoomLevel };
