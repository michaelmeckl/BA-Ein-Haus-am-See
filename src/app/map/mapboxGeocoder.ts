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
