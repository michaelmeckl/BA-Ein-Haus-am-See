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
//TODO test performance with optimize!
//const mapStyle = "mapbox://styles/mapbox/streets-v11?optimize=true";

//! TODO: style als eigene datei und dann tiles sowohl von mapbox als auch von eigenem osmscout server holen
// * -> beide urls unter source angeben, damit bessere performance beim tile fetching (weil dann parallel gearbeitet werden kann)
const mapStyle = "mapbox://styles/mapbox/streets-v11";
//TODO der osmscout style ist nicht allzu hübsch, theoretisch kann aber einfach der mapbox style heruntergeladen und die tile requests ausgetauscht werden zu eigenem osmscout server! ("http://localhost:8553/v1/mbgl/tile?z={z}&x={x}&y={y}")
//const mapStyle = ""../assets/osmscoutStyle.json"";  // path to local osmscout style which serves own hosted tiles

// setup map
const map = new mapboxgl.Map({
  container: "map",
  style: mapStyle, // stylesheet location
  center: initialPosition, // starting position: [lng, lat]
  zoom: initialZoomLevel, // starting zoom
  interactive: false, //* set interactive false when deck gl should handle all interactions
  minZoom: 4, // as this website focuses on bavaria there is no need to show the lowest zoom levels (performance optimization)
  maxZoom: 20,
  hash: true, //sync map position with the hash fragment of the page's URL
  trackResize: true, //TODO bessere performance wenn false?
  antialias: false, // set to true for antialiasing custom layers but this has a negative impact on performance
  //TODO nicht so toll für performance -> gibt es eine bessere Lösung?
  preserveDrawingBuffer: true, // necessary to be able to export the map canvas as an image
});

export { map, initialPosition, initialZoomLevel };
