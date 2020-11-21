import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import mapboxgl, { Control } from "mapbox-gl";
import { initialZoomLevel } from "./mapboxConfig";

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
      limit: 7, //max. number of results
      minLength: 4, // only autocomplete after at least 4 characters have been entered (optimization as autocomplete on every keystroke counts as one geocoding operation to the free limit)
      zoom: initialZoomLevel, // Set the zoom level for geocoding results
      placeholder: "Ort suchen ...", // This placeholder text will display in the search bar
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
      // marker.setLngLat(point).addTo(map); // Add the marker to the map at the result coordinates
    });

    /*
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
        console.log("Your query was too long!");
      }
    });
    */
  }
}
export default new Geocoder();
