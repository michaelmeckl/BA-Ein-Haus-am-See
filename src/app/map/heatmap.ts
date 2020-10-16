import type { Point } from "geojson";
import mapboxgl, { Layer, LngLatLike } from "mapbox-gl";
import { map } from "./mapboxConfig";
import mapLayerManager from "./mapLayerManager";

export default class Heatmap {
  private sourceName: string;

  constructor(data?: string) {
    this.sourceName = "heatmap-source";

    // Heatmap layers work with a vector tile source as well as geojson.
    map.addSource(this.sourceName, {
      type: "geojson",
      data: "../assets/data.geojson", //TODO use the real data given as param
    });
  }

  show(): void {
    const heatLayer: Layer = {
      id: `${this.sourceName}-heat`,
      type: "heatmap",
      source: this.sourceName,
      maxzoom: 15,
      paint: {
        // Increase the heatmap weight based on frequency and property magnitude
        // heatmap-weight is a measure of how much an individual point contributes to the heatmap
        //! both do not work with text values
        /*
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "type"],
              "point",
              0,
              "way",
              0.5,
              "polygon",
              1,
            ],
            */
        /*
            "heatmap-weight": {
              property: "type",
              type: "exponential",
              stops: [
                [0, 0.2],
                [62, 1],
              ],
            },*/
        // Increase the heatmap color weight weight by zoom level
        // heatmap-intensity is a multiplier on top of heatmap-weight
        //"heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
        "heatmap-intensity": {
          stops: [
            [11, 1],
            [15, 3],
          ],
        },
        // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
        // Begin color ramp at 0-stop with a 0-transparancy color
        // to create a blur-like effect.
        // prettier-ignore
        "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(33,102,172,0)",
              0.2, "rgb(103,169,207)",
              0.4, "rgb(209,229,240)",
              0.6, "rgb(253,219,199)",
              0.8, "rgb(239,138,98)",
              1, "rgb(178,24,43)",
            ],
        /*
            // Adjust the heatmap radius by zoom level
            // prettier-ignore
            "heatmap-radius": [
              "interpolate", ["linear"], ["zoom"],
              0, 2,
              9, 20,
              15, 50, 
              18, 70,
            ],
            */
        // increase radius as zoom increases
        "heatmap-radius": {
          //default radius is 30 (pixel)
          stops: [
            [11, 15],
            [15, 20],
          ],
        },
        // Transition from heatmap to circle layer by zoom level
        //"heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 9, 0],
        // decrease opacity to transition into the circle layer
        "heatmap-opacity": {
          default: 1,
          stops: [
            [14, 1],
            [15, 0],
          ],
        },
      },
    };

    const pointLayer: Layer = {
      id: `${this.sourceName}-point`,
      type: "circle",
      source: this.sourceName,
      minzoom: 14,
      paint: {
        "circle-radius": {
          property: "type",
          type: "exponential",
          stops: [
            [{ zoom: 15, value: 1 }, 5],
            [{ zoom: 15, value: 62 }, 10],
            [{ zoom: 22, value: 1 }, 20],
            [{ zoom: 22, value: 62 }, 50],
          ],
        },
        "circle-color": {
          property: "type",
          type: "exponential",
          stops: [
            [0, "rgba(236,222,239,0)"],
            [10, "rgb(236,222,239)"],
            [20, "rgb(208,209,230)"],
            [30, "rgb(166,189,219)"],
            [40, "rgb(103,169,207)"],
            [50, "rgb(28,144,153)"],
            [60, "rgb(1,108,89)"],
          ],
        },
        "circle-stroke-color": "white",
        "circle-stroke-width": 1,
        // Transition from heatmap to circle layer by zoom level
        //"circle-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 16, 1],
        "circle-opacity": {
          stops: [
            [14, 0],
            [15, 1],
          ],
        },
      },
    };

    // use the mapLayerManagers add-Method to make sure this layers are added to the local activeLayers.
    mapLayerManager.addNewLayer(heatLayer, true);
    mapLayerManager.addNewLayer(pointLayer, true);

    map.on("mouseover", `${this.sourceName}-point`, (e) => {
      // change the cursor style to show the user this is clickable
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("click", `${this.sourceName}-point`, this.handleHeatmapClick.bind(this));
  }

  handleHeatmapClick(
    e: mapboxgl.MapMouseEvent & {
      features?: mapboxgl.MapboxGeoJSONFeature[] | undefined;
    } & mapboxgl.EventData
  ): void {
    if (!e.features) {
      return;
    }
    const clickedPoint = e.features[0];

    //* nested geojson properties need to be parsed because Mapbox doesn't support nested objects or arrays
    // see https://stackoverflow.com/questions/52859961/display-properties-of-nested-geojson-in-mapbox
    const props = clickedPoint.properties;
    if (props === null) {
      return;
    }
    Object.keys(props).forEach(function (key) {
      //only parse the tags key as the other properties are no obejcts and would only result in an error!
      if (key === "tags") {
        props[key] = JSON.parse(props[key]);
      }
    });

    new mapboxgl.Popup()
      // cast to point so coordinates is safe to access
      .setLngLat((clickedPoint.geometry as Point).coordinates as LngLatLike)
      //TODO oder einfacher: setLngLat(map.unproject(e.point))
      .setHTML(
        "<h3>Name: </h3> " +
          clickedPoint.properties?.tags.name +
          "<p>Amenity: " +
          clickedPoint.properties?.tags.amenity +
          "</p>"
      )
      .addTo(map);
  }
}
