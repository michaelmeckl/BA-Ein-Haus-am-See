import mapboxgl from "mapbox-gl";
import { map } from "./mapboxConfig";

// colors to use for the categories
const colors = ["#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c"];

//TODO
export default class ClusterManager {
  // objects for caching and keeping track of HTML marker objects (for performance)
  private markers: any = {};
  private markersOnScreen: any = {};

  private sourceName: string;

  constructor(name: string) {
    this.sourceName = name;
  }

  //* this is the only method here that is useful right now:

  addClusterLayer(): void {
    map.addLayer({
      id: `clusters-${this.sourceName}`,
      type: "circle",
      source: this.sourceName,
      filter: ["has", "point_count"], // check that clustering is enabled
      paint: {
        // Use step expressions:
        //   * Blue, 20px circles when point count is less than 100
        //   * Yellow, 30px circles when point count is between 100 and 750
        //   * Pink, 40px circles when point count is greater than or equal to 750
        "circle-color": ["step", ["get", "point_count"], "#51bbd6", 100, "#f1f075", 750, "#f28cb1"],
        "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
      },
    });

    // show number of points per cluster
    map.addLayer({
      id: `cluster-${this.sourceName}-count`,
      type: "symbol",
      source: this.sourceName,
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
    });

    // ease to a cluster on click
    /*
    map.on("click", `clusters-${sourceName}`, function (e) {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [`clusters-${sourceName}`],
      });

      const clusterId = features[0].properties?.cluster_id;

      const source = map.getSource(sourceName) as GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, function (err, zoom) {
        if (err) {
          return;
        }

        map.easeTo({
          center: (features[0].geometry as Point).coordinates as LngLatLike,
          zoom: zoom,
        });
      });
    });

    map.on("mouseenter", `clusters-${sourceName}`, function () {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", `clusters-${sourceName}`, function () {
      map.getCanvas().style.cursor = "";
    });
    */
  }

  //? Alternative implementation of cluster
  addOtherClusterLayer(): void {
    const layerName = `cluster-${this.sourceName}`;

    map.addLayer({
      id: layerName,
      type: "circle",
      source: this.sourceName,
      filter: ["==", ["get", "cluster"], true],
      paint: {
        "circle-color": "rgba(0, 0, 0, 0.6)",
        "circle-radius": ["step", ["get", "zoom"], 4, 100, 10, 18, 40],
        "circle-stroke-color": "#8dd3c7",
        "circle-stroke-width": 5,
      },
    });

    map.addLayer({
      id: `${layerName}-label`,
      type: "symbol",
      source: this.sourceName,
      filter: ["==", ["get", "cluster"], true],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Montserrat Bold", "Arial Unicode MS Bold"],
        "text-size": 13,
      },
      paint: {
        "text-color": "#8dd3c7",
      },
    });
  }

  updateMarkers(): void {
    const newMarkers: any = {};
    const features = map.querySourceFeatures(this.sourceName);

    // for every cluster on the screen, create an HTML marker for it (if we didn't yet),
    // and add it to the map if it's not there already
    for (let i = 0; i < features.length; i++) {
      const coords = features[i].geometry.coordinates;
      const props = features[i].properties; //TODO these are not the correct properties for the donut chart below
      console.log(props);

      if (!props.cluster) {
        continue;
      }
      const id = props.cluster_id;

      let marker = this.markers[id];
      if (!marker) {
        const el = this.createDonutChart(props);
        marker = this.markers[id] = new mapboxgl.Marker({
          element: el,
        }).setLngLat(coords);
      }
      newMarkers[id] = marker;

      if (!this.markersOnScreen[id]) {
        marker.addTo(map);
      }
    }
    // for every marker we've added previously, remove those that are no longer visible
    for (const id in this.markersOnScreen) {
      if (!newMarkers[id]) {
        this.markersOnScreen[id].remove();
      }
    }
    this.markersOnScreen = newMarkers;

    // after the GeoJSON data is loaded, update markers on the screen and do so on every map move/moveend
    map.on("data", (e) => {
      if (e.sourceId !== this.sourceName || !e.isSourceLoaded) {
        return;
      }

      map.on("move", this.updateMarkers);
      map.on("moveend", this.updateMarkers);
      this.updateMarkers();
    });
  }

  //TODO maybe use d3 instead of this custom donut chart? (not working btw)
  // code for creating an SVG donut chart from feature properties, see https://docs.mapbox.com/mapbox-gl-js/example/cluster-html/
  createDonutChart(props: any): ChildNode | null {
    const offsets = [];
    const counts = [props.bar, props.supermarket, props.cafe, props.restaurant, props.other];
    let total = 0;
    for (let i = 0; i < counts.length; i++) {
      offsets.push(total);
      total += counts[i];
    }
    const fontSize = total >= 1000 ? 22 : total >= 100 ? 20 : total >= 10 ? 18 : 16;
    const r = total >= 1000 ? 50 : total >= 100 ? 32 : total >= 10 ? 24 : 18;
    const r0 = Math.round(r * 0.6);
    const w = r * 2;

    let html =
      '<div><svg width="' +
      w +
      '" height="' +
      w +
      '" viewbox="0 0 ' +
      w +
      " " +
      w +
      '" text-anchor="middle" style="font: ' +
      fontSize +
      'px sans-serif; display: block">';

    for (let i = 0; i < counts.length; i++) {
      html += this.donutSegment(
        offsets[i] / total,
        (offsets[i] + counts[i]) / total,
        r,
        r0,
        colors[i]
      );
    }
    html +=
      '<circle cx="' +
      r +
      '" cy="' +
      r +
      '" r="' +
      r0 +
      '" fill="white" /><text dominant-baseline="central" transform="translate(' +
      r +
      ", " +
      r +
      ')">' +
      total.toLocaleString() +
      "</text></svg></div>";

    const el = document.createElement("div");
    el.innerHTML = html;
    return el.firstChild;
  }

  donutSegment(start: number, end: number, r: number, r0: number, color: string): any {
    if (end - start === 1) {
      // eslint-disable-next-line no-param-reassign
      end -= 0.00001;
    }
    const a0 = 2 * Math.PI * (start - 0.25);
    const a1 = 2 * Math.PI * (end - 0.25);
    const x0 = Math.cos(a0),
      y0 = Math.sin(a0);
    const x1 = Math.cos(a1),
      y1 = Math.sin(a1);
    const largeArc = end - start > 0.5 ? 1 : 0;

    return [
      '<path d="M',
      r + r0 * x0,
      r + r0 * y0,
      "L",
      r + r * x0,
      r + r * y0,
      "A",
      r,
      r,
      0,
      largeArc,
      1,
      r + r * x1,
      r + r * y1,
      "L",
      r + r0 * x1,
      r + r0 * y1,
      "A",
      r0,
      r0,
      0,
      largeArc,
      0,
      r + r0 * x0,
      r + r0 * y0,
      '" fill="' + color + '" />',
    ].join(" ");
  }
}
