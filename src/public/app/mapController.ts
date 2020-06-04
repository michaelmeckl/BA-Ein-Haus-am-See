/* eslint-env browser */
import mapboxgl from "mapbox-gl";

export default class Map {
  private readonly map: mapboxgl.Map;
  private defaultCoordinates: [number, number];

  constructor(accessToken: string, containerId: string) {
    this.checkGLSupport();
    // provide Mapbox accessToken
    mapboxgl.accessToken = accessToken;

    const lat = 49.008;
    const lon = 12.1;
    this.defaultCoordinates = [lon, lat];
    //const mapStyle = "mapbox://styles/michaelmeckl/ckajo8dpn22r41imzu1my2ekh";
    const mapStyle = "mapbox://styles/mapbox/streets-v11";
    const defaultZoom = 12;

    console.time("load map");
    this.map = new mapboxgl.Map({
      container: containerId,
      style: mapStyle, // stylesheet location
      center: this.defaultCoordinates, // starting position [lon, lat]
      zoom: defaultZoom, // starting zoom
    });

    this.setupMap();
  }

  checkGLSupport(): void {
    if (!mapboxgl.supported()) {
      throw new Error("Your browser does not support Mapbox GL!");
    }
  }

  setupMap(): void {
    //set cursor style to mouse pointer
    this.map.getCanvas().style.cursor = "default";

    // Add map controls
    this.map.addControl(new mapboxgl.NavigationControl());

    //TODO: await map load instead of callback?
    this.map.on("load", async () => {
      console.timeEnd("load map");

      console.log("Map is fully loaded!");
      const marker = new mapboxgl.Marker()
        .setLngLat(this.defaultCoordinates)
        .addTo(this.map);
    });

    this.map.on("click", function (e) {
      console.log("Click:", e);

      /*
      //show a popup window with custom text
      const popup = new mapboxgl.Popup({
        offset: [0, -30],
        closeOnMove: true,
        maxWidth: "none",
      })
        .setLngLat(coordinates)
        .setHTML(
          "<h1>Universität Regensburg</h1><p>Beschreibungstext für Uni</p>"
        )
        .addTo(map);
        */
    });
  }

  removeLayerSource(map: mapboxgl.Map, id: string): boolean {
    const mapLayer = map.getLayer(id);

    console.log("maplayer:" + mapLayer);

    if (typeof mapLayer !== "undefined") {
      // Remove map layer & source.
      map.removeLayer(id).removeSource(id);
      return true;
    }

    return false;
  }

  /**
   * Get the current bounding box, in order:
   * southern-most latitude, western-most longitude, northern-most latitude, eastern-most longitude.
   * @return string representation of the bounds in the above order
   */
  getCurrentBounds(): string {
    const currBounds = this.map.getBounds();
    const southLat = currBounds.getSouth();
    const westLon = currBounds.getWest();
    const northLat = currBounds.getNorth();
    const eastLon = currBounds.getEast();

    return `${southLat},${westLon},${northLat},${eastLon}`;
  }

  showData(data: string, sourceName: string): void {
    console.log("now adding to map...");

    //TODO: maybe ask user and don't remove if its the same?
    this.removeLayerSource(this.map, sourceName);

    if (this.map.getSource(sourceName)) {
      console.log(`Source ${sourceName} is already used! Can't use it again`);
      return;
    }

    // add source
    // see https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
    this.map.addSource(sourceName, {
      type: "geojson",
      //maxzoom: 13, // default: 18
      //cluster: true, // cluster near points (default: false)
      buffer: 70, // higher means fewer rendering artifacts near tile edges and decreased performance (max: 512)
      tolerance: 0.45, // higher means simpler geometries and increased performance
      data: data, // url or inline geojson
    });

    //visualize source
    this.map.addLayer({
      id: sourceName,
      type: "symbol",
      source: sourceName,
      layout: {
        //"icon-image": ["concat", ["get", "icon"], "-15"],
        "text-field": ["get", "name", ["get", "tags"]],
        //"text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        //"text-offset": [0, 0.6],
        //"text-anchor": "top",
      },
      //interactive: true,
      /*
      paint: {
        "circle-radius": 3,
        "circle-color": "#ff0000",
      },
      */
    });

    /*
    // Add a circle layer with a vector source
    this.map.addLayer({
    id: "points-of-interest",
    source: {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8",
    },
    "source-layer": "poi_label",
    type: "circle",
    paint: {
        // Mapbox Style Specification paint properties
    },
    layout: {
        // Mapbox Style Specification layout properties
    },
    });
    */
  }
}
