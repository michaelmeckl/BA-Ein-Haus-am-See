import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import mapboxgl, { Control, GeoJSONSource } from "mapbox-gl";
import { initialZoomLevel, map } from "./mapboxConfig";
import { queryAllTiles } from "./tilequeryApi";

type mapboxGeocoder = Control;

/**
 * This class provides access to the Mapbox Geocoder plugin.
 */
class Geocoder {
  public geocoder: mapboxGeocoder;

  /**
   * * When autocomplete is enabled, each user keystroke counts as one request to the Geocoding API.
   * * For example, a search for "coff" would be reflected as four separate Geocoding API requests.
   */
  constructor() {
    // Initialize the geocoder
    this.geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken, // Set the access token
      mapboxgl: mapboxgl, // Set the mapbox-gl instance
      limit: 7,
      minLength: 4, // only autocomplete after at least 4 characters have been entered (optimization as autocomplete on every keystroke counts as one geocoding operation to the free limit)
      zoom: initialZoomLevel, // Set the zoom level for geocoding results
      placeholder: "Suchen ...", // This placeholder text will display in the search bar
      language: "de-DE", // set UI language to german
      countries: "de", // limit results to Germany
      //bbox: [-105.116, 39.679, -104.898, 39.837], // Set a bounding box
      collapsed: true,
      types: "poi",
      //proximity: initialPosition
    });

    this.setupGeocoding();
  }

  get geocoderControl(): Control {
    return this.geocoder;
  }

  setupGeocoding(): void {
    const marker = new mapboxgl.Marker({ color: "#008000" }); // Create a new green marker

    // Fired when the geocoder returns a result
    this.geocoder.on("result", async (data: any) => {
      const point = data.result.center; // capture the result coordinates
      console.log(data);

      //TODO
      // geocoder.setProximity(lng, lat) on every camera move so the poi types around this point are preferred!

      //TODO data hat:
      //properties.category -> name des poi types
      // properties.maki -> name des icons

      //TODO
      //Filter results to only include points of interest near a specific point

      // curl "https://api.mapbox.com/geocoding/v5/mapbox.places/-73.989,40.733.json?types=poi&access_token=YOUR_MAPBOX_ACCESS_TOKEN"

      marker.setLngLat(point).addTo(map); // Add the marker to the map at the result coordinates

      map.addSource("tilequery", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "tilequery-points",
        type: "circle",
        source: "tilequery", // Set the layer source
        paint: {
          "circle-stroke-color": "white",
          "circle-stroke-width": {
            // Set the stroke width of each circle: https://docs.mapbox.com/mapbox-gl-js/style-spec/#paint-circle-circle-stroke-width
            stops: [
              [0, 0.1],
              [18, 3],
            ],
            base: 5,
          },
          "circle-radius": {
            // Set the radius of each circle, as well as its size at each zoom level: https://docs.mapbox.com/mapbox-gl-js/style-spec/#paint-circle-circle-radius
            stops: [
              [12, 5],
              [22, 180],
            ],
            base: 5,
          },
          "circle-color": [
            // Specify the color each circle should be
            "match", // Use the 'match' expression: https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-match
            ["get", "STORE_TYPE"], // Use the result 'STORE_TYPE' property
            "Convenience Store",
            "#FF8C00",
            "Convenience Store With Gas",
            "#FF8C00",
            "Pharmacy",
            "#FF8C00",
            "Specialty Food Store",
            "#9ACD32",
            "Small Grocery Store",
            "#008000",
            "Supercenter",
            "#008000",
            "Superette",
            "#008000",
            "Supermarket",
            "#008000",
            "Warehouse Club Store",
            "#008000",
            "#FF0000", // any other store type
          ],
        },
      });

      const results = await queryAllTiles(point);

      const source = map.getSource("tilequery");
      (source as GeoJSONSource).setData(results);

      const popup = new mapboxgl.Popup(); // Initialize a new popup

      map.on("mouseenter", "tilequery-points", function (e) {
        if (!e.features || !e.features[0].properties) {
          return;
        }

        map.getCanvas().style.cursor = "pointer"; // When the cursor enters a feature, set it to a pointer

        const title = "<h3>" + e.features[0].properties.STORE_NAME + "</h3>"; // Set the store name
        const storeType = "<h4>" + e.features[0].properties.STORE_TYPE + "</h4>"; // Set the store type
        const storeAddress = "<p>" + e.features[0].properties.ADDRESS_LINE1 + "</p>"; // Set the store address
        const obj = JSON.parse(e.features[0].properties.tilequery); // Get the feature's tilequery object (https://docs.mapbox.com/api/maps/#response-retrieve-features-from-vector-tiles)
        const distance = "<p>" + (obj.distance / 1609.344).toFixed(2) + " mi. from location</p>"; // Take the distance property, convert it to miles, and truncate it at 2 decimal places

        const lon = e.features[0].properties.longitude;
        const lat = e.features[0].properties.latitude;
        const coordinates = new mapboxgl.LngLat(lon, lat); // Create a new LngLat object (https://docs.mapbox.com/mapbox-gl-js/api/#lnglatlike)
        const content = title + storeType + storeAddress + distance; // All the HTML elements

        popup
          .setLngLat(coordinates) // Set the popup at the given coordinates
          .setHTML(content) // Set the popup contents equal to the HTML elements you created
          .addTo(map); // Add the popup to the map
      });

      map.on("mouseleave", "tilequery-points", function () {
        map.getCanvas().style.cursor = ""; // Reset the cursor when it leaves the point
        popup.remove(); // Remove the popup when the cursor leaves the point
      });
    });

    // Fired when the geocoder returns a response
    this.geocoder.on("results", (data: any) => {
      //console.log("all results from geocoder: ", data);
    });

    // Emitted when the geocoder is looking up a query
    this.geocoder.on("loading", (data: any) => {
      //console.log("loading results");
    });

    this.geocoder.on("loading", (error: any) => {
      if (error.message === "Query too long") {
        //TODO show user?
        console.log("Your query was too long!");
      }
    });
  }
}
export default new Geocoder();

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
