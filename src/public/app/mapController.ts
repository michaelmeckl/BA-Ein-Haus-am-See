/* eslint-env browser */
import mapboxgl, { CustomLayerInterface } from "mapbox-gl";

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
      antialias: false, // set to true for antialiasing custom layers but has a negative impact on performance
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

  removeLayerSource(map: mapboxgl.Map, id: string): boolean {
    const mapLayer = map.getLayer(id);

    console.log("maplayer:" + mapLayer);

    //TODO: improve this! there can be more than one layer (and they don't have the same id name as the source but only start with it)
    if (typeof mapLayer !== "undefined") {
      // Remove map layer & source.
      map.removeLayer(id).removeSource(id);
      return true;
    }

    return false;
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
      id: sourceName + "-l1",
      type: "circle",
      source: sourceName,
      //interactive: true,
      paint: {
        //increase circle radius when zooming in
        "circle-radius": {
          base: 1,
          stops: [
            [8, 2],
            [16, 10],
          ],
        },
        // style color based on wheelchair access
        "circle-color": [
          "match",
          ["get", "wheelchair", ["get", "tags"]],
          "yes",
          "#fbb03b",
          "limited",
          "#223b53",
          "no",
          "#3bb2d0",
          /* other */ "#ff0000",
        ],
      },
    });

    this.map.addLayer({
      id: sourceName + "-l2",
      type: "symbol",
      source: sourceName,
      layout: {
        // see https://docs.mapbox.com/help/tutorials/mapbox-gl-js-expressions/
        "text-field": ["get", "name", ["get", "tags"]],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-offset": [0, 0.6],
        "text-anchor": "top",
      },
    });

    this.map.on("mouseenter", "points-l1", () => {
      // Change the cursor style as a UI indicator.
      this.map.getCanvas().style.cursor = "pointer";
    });

    this.map.on("mouseleave", "points-l1", () => {
      this.map.getCanvas().style.cursor = "default";
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

  //TODO: richtig machen und austesten!
  addWebGlLayer(): void {
    console.log("adding webgl data...");

    let program: WebGLProgram;
    let aPos: number;
    let buffer: WebGLBuffer | null;

    const highlightLayer: CustomLayerInterface = {
      id: "highlight",
      type: "custom",

      // method called when the layer is added to the map
      // https://docs.mapbox.com/mapbox-gl-js/api/#styleimageinterface#onadd
      onAdd: function (map: mapboxgl.Map, gl: WebGLRenderingContext): void {
        // create GLSL source for vertex shader
        const vertexSource =
          "" +
          "uniform mat4 u_matrix;" +
          "attribute vec2 a_pos;" +
          "void main() {" +
          "    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);" +
          "}";

        // create GLSL source for fragment shader
        const fragmentSource =
          "" +
          "void main() {" +
          "    gl_FragColor = vec4(1.0, 0.0, 0.0, 0.5);" +
          "}";

        // create a vertex shader
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (!vertexShader) {
          return;
        }
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);

        // create a fragment shader
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (!fragmentShader) {
          return;
        }
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        // link the two shaders into a WebGL program
        const pgrm = gl.createProgram();
        if (pgrm) {
          program = pgrm;
        } else {
          return;
        }
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        aPos = gl.getAttribLocation(program, "a_pos");

        // define vertices to be rendered in the custom style layer
        const uniSouthWest = mapboxgl.MercatorCoordinate.fromLngLat({
          lng: 12.089283,
          lat: 48.9920256,
        });
        const uniSouthEast = mapboxgl.MercatorCoordinate.fromLngLat({
          lng: 12.1025303,
          lat: 48.9941069,
        });
        const uniNorthWest = mapboxgl.MercatorCoordinate.fromLngLat({
          lng: 12.0909411,
          lat: 49.0012031,
        });
        const uniNorthEast = mapboxgl.MercatorCoordinate.fromLngLat({
          lng: 12.0989967,
          lat: 49.0016276,
        });

        // create and initialize a WebGLBuffer to store vertex and color data
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([
            uniSouthWest.x,
            uniSouthWest.y,
            uniSouthEast.x,
            uniSouthEast.y,
            uniNorthWest.x,
            uniNorthWest.y,
            uniNorthEast.x,
            uniNorthEast.y,
          ]),
          gl.STATIC_DRAW
        );
      },

      // method fired on each animation frame
      // https://docs.mapbox.com/mapbox-gl-js/api/#map.event:render
      render: function (gl: WebGLRenderingContext, matrix: number[]): void {
        gl.useProgram(program);
        gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "u_matrix"),
          false,
          matrix
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    };

    const layers = this.map.getStyle().layers;
    // Find the index of the first symbol layer in the map style
    let firstSymbolId;
    if (layers) {
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === "symbol") {
          firstSymbolId = layers[i].id;
          break;
        }
      }
    }

    // Insert the layer beneath the first symbol layer in the layer stack.
    this.map.addLayer(highlightLayer, firstSymbolId);

    console.log("Finished adding webgl data!");
  }
}
