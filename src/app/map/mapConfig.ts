import mapboxgl, { LngLatLike } from "mapbox-gl";
import { Config } from "../../shared/config";

// make sure that MapboxGl (and WebGL) are supported in the browser
if (!mapboxgl.supported()) {
  throw new Error("Your browser does not support Mapbox GL!");
}

// provide Mapbox accessToken
mapboxgl.accessToken = Config.MAPBOX_TOKEN;

// default api to request tiles, styles, ...
// TODO could be used to load tiles from own tileserver
mapboxgl.baseApiUrl = "https://api.mapbox.com";

const lat = 49.008;
const lng = 12.1;
const defaultCoordinates: LngLatLike = [lng, lat];

// remove unused layers and features with ?optimize=true
//TODO test performance with optimize!
//const mapStyle = "mapbox://styles/mapbox/streets-v11?optimize=true";
const mapStyle = "mapbox://styles/mapbox/streets-v11";
const defaultZoom = 12;

// init map
const map = new mapboxgl.Map({
  container: "map",
  style: mapStyle, // stylesheet location
  center: defaultCoordinates, // starting position: [lng, lat]
  zoom: defaultZoom, // starting zoom
  antialias: false, // set to true for antialiasing custom layers but has a negative impact on performance
});

export { map };
