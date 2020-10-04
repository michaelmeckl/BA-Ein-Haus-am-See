import { instrumentGLContext } from "@luma.gl/gltools";
import { Buffer } from "@luma.gl/webgl";
import { Model } from "@luma.gl/engine";
import type { CustomLayerInterface, MercatorCoordinate } from "mapbox-gl";
import { map } from "../map/mapboxConfig";

// Create a Mapbox custom layer
// https://docs.mapbox.com/mapbox-gl-js/example/custom-style-layer/
class CustomLayer {
  id: string;
  type: string;
  renderingMode: string;
  coordinates: mapboxgl.MercatorCoordinate[];

  //needed for webgl and luma
  positionBuffer!: Buffer;
  colorBuffer!: Buffer;
  model!: Model;

  constructor(coordinates: MercatorCoordinate[]) {
    this.id = "lumagl-layer";
    this.type = "custom";
    this.renderingMode = "2d";
    this.coordinates = coordinates;
  }

  onAdd(m: mapboxgl.Map, gl: WebGLRenderingContext): void {
    //für separaten canvas, die 2 methoden nehmen:
    //const gl = instrumentGLContext(canvas.getContext('webgl'));
    //gl.clearColor(0, 0, 0, 1);

    instrumentGLContext(gl);

    const vertexSource = `
        attribute vec2 positions;
        attribute vec3 colors;

        uniform mat4 uPMatrix;

        varying vec3 vColor;

        void main() {
            vColor = colors;
            gl_Position = uPMatrix * vec4(positions, 0, 1.0);
        }
    `;

    const fragmentSource = `
        varying vec3 vColor;

        void main() {
            gl_FragColor = vec4(vColor, 0.35);      /* 0.35 is the alpha value */
        }
    `;

    //flatten the coordinates
    const positions = new Float32Array(this.coordinates.length * 2);
    this.coordinates.forEach((coords, i) => {
      positions[i * 2] = coords.x;
      positions[i * 2 + 1] = coords.y;
    });

    this.positionBuffer = new Buffer(gl, new Float32Array(positions));
    // prettier-ignore
    this.colorBuffer = new Buffer(gl, new Float32Array([
        //use red, green and blue as colors
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 0.0, 1.0,
    ]));

    // Model to draw a triangle on the map
    this.model = new Model(gl, {
      id: "lumaModel",
      vs: vertexSource,
      fs: fragmentSource,
      attributes: {
        positions: this.positionBuffer,
        colors: this.colorBuffer,
      },
      vertexCount: this.coordinates.length,
    });
  }

  render(gl: WebGLRenderingContext, matrix: number[]): void {
    // Mapbox passes us a projection matrix
    this.model
      .setUniforms({
        uPMatrix: matrix,
      })
      .draw();
  }

  onRemove(): void {
    // Cleanup
    this.positionBuffer.delete();
    this.colorBuffer.delete();
    this.model.delete();
  }
}

export default class LumaLayer {
  constructor(geoData: mapboxgl.MercatorCoordinate[]) {
    const custLayer = new CustomLayer(geoData) as CustomLayerInterface;
    map.addLayer(custLayer, "waterway-label");
  }

  //animate the luma layer
  /*
  start(): void {
    let loopHandle: number | null = null;
    let bearing = 0.1;
    let pitch = 10;

    const loop = () => {
      bearing += vb;
      pitch += vp;

      if (Math.abs(bearing) > 90) {
        vb *= -1;
      }

      if (pitch > 50 || pitch < 30) {
        vp *= -1;
      }

      this.map.setBearing(bearing);
      this.map.setPitch(pitch);
      loopHandle = window.requestAnimationFrame(loop);
    };

    loopHandle = window.requestAnimationFrame(loop);

    this.map.on("mousedown", () => {
      window.cancelAnimationFrame(loopHandle);
    });
  }
  */

  //oder so:
  /*
    requestAnimationFrame(function draw() {
        requestAnimationFrame(draw);

        clear(gl, {
            color: [0, 0, 0, 1]
        });
        model.draw();
    });
    */
}
