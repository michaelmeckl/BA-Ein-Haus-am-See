import mapboxgl, { LngLatLike } from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";

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

// Initialize the geocoder
const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken, // Set the access token
  mapboxgl: mapboxgl, // Set the mapbox-gl instance
  zoom: initialZoomLevel, // Set the zoom level for geocoding results
  placeholder: "Suchen ...", // This placeholder text will display in the search bar
  language: "de-DE", // set UI language to german
  countries: "de", // limit results to Germany
  //TODO set bayern as bounding box
  //bbox: [-105.116, 39.679, -104.898, 39.837], // Set a bounding box
  collapsed: true,
  types: "poi",
});

export { map, geocoder };

//Bounding Box Bayern:
/*
[
  [10.1562564455, 47.2562960318],
  [10.170122187, 47.3302984107],
  [9.7432430376, 47.5992097129],
  [10.1022093932, 47.7625049258],
  [10.073104037, 48.0616333142],
  [9.9665476334, 48.4208229579],
  [10.2962448049, 48.6482987349],
  [10.243205383, 48.7033103266],
  [10.4012955773, 48.695484874],
  [10.4131523328, 48.8933577876],
  [10.0851155505, 49.299652347],
  [10.1127812531, 49.4540463268],
  [9.832171312, 49.4797314727],
  [9.7723483938, 49.6634499267],
  [9.6582723515, 49.6565923648],
  [9.5910841908, 49.743505594],
  [9.444850752, 49.7511669488],
  [9.444850752, 49.6514749387],
  [9.0544165709, 49.5565771987],
  [8.9671005024, 50.0699218725],
  [10.1878741587, 50.5790129177],
  [10.4645317274, 50.4080417512],
  [10.6384310497, 50.352595007],
  [10.6542398158, 50.2415070135],
  [10.701666838, 50.3198006018],
  [10.8360435212, 50.4231523374],
  [11.1482715374, 50.3626810124],
  [11.1956985595, 50.3071812873],
  [11.2352208367, 50.4910903399],
  [11.3616931369, 50.5388401027],
  [11.5079262139, 50.4256703191],
  [11.9071038912, 50.4307058231],
  [12.1205254907, 50.337461923],
  [12.2311883011, 50.135226442],
  [12.2983768236, 50.0718519133],
  [12.4722757841, 50.0033131838],
  [12.5117984231, 49.9524806256],
  [12.5434163173, 49.8481061022],
  [12.4485626349, 49.7358430292],
  [12.6382707233, 49.5515783241],
  [12.7607902892, 49.4000634837],
  [13.0967318165, 49.3099603307],
  [13.1797291051, 49.1654516869],
  [13.4010550877, 49.0982146099],
  [13.4761479933, 48.9790333664],
  [13.6737604649, 48.9452999738],
  [13.8318499355, 48.8517652146],
  [13.8120887969, 48.5465677982],
  [13.7172347527, 48.4994500599],
  [13.5196222812, 48.5491841253],
  [13.3378185758, 48.3105405367],
  [13.0097814316, 48.2342538395],
  [12.764741938, 48.0918990406],
  [13.0137338041, 47.9200218614],
  [12.9544500264, 47.7635142305],
  [13.1283489869, 47.6598007938],
  [13.0137338041, 47.4464092357],
  [12.7884561727, 47.5211950527],
  [12.7449807994, 47.6438265593],
  [12.4525139218, 47.6438265593],
  [12.3062815685, 47.673109025],
  [12.1916660239, 47.5878783175],
  [11.9387214235, 47.5638820859],
  [11.7173958027, 47.563882147],
  [11.3537887538, 47.4169998201],
  [11.0692258975, 47.3741933995],
  [10.6660969332, 47.5158568135],
  [10.4605797168, 47.3313520801],
  [10.1562564455, 47.2562960318],
];
*/
