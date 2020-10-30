import { map } from "./mapboxConfig";
import Benchmark from "../../shared/benchmarking";
import { addCanvasOverlay } from "./canvasUtils";
import * as webglUtils from "../webgl/webglUtils";
import * as twgl from "twgl.js";

// the number of textures to combine
let textureCount;

const vsCombine = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;

    uniform vec2 u_resolution;

    varying vec2 v_texCoord;

    void main() {
        // convert the rectangle from pixels to 0.0 to 1.0
        vec2 zeroToOne = a_position / u_resolution;

        // convert from 0->1 to 0->2
        vec2 zeroToTwo = zeroToOne * 2.0;

        // convert from 0->2 to -1->+1 (clipspace)
        vec2 clipSpace = zeroToTwo - 1.0;

        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

        // pass the texCoord to the fragment shader
        // The GPU will interpolate this value between points.
        v_texCoord = a_texCoord;
    }
  `;

//* hier muss Webgl 1 verwendet werden, sonst gehen keine dynamischen Variablen in der for-Schleife!
const fsCombine = `
    precision mediump float;    // mediump should be enough and highp isn't supported on all devices

    // array of textures
    uniform sampler2D u_textures[NUM_TEXTURES];

    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;

    void main() {
        vec4 overlayColor = vec4(0.0);

        /*
        if (NUM_TEXTURES < 2) {
            overlayColor += texture2D(u_textures[0], v_texCoord);
        } else {
            for (int i = 0; i < NUM_TEXTURES; ++i) {
                float weight = 1.0 / float(NUM_TEXTURES);  // jedes Layer erhält im Moment die gleiche Gewichtung!
                overlayColor += texture2D(u_textures[i], v_texCoord) * weight;
            }
        }*/ 

        for (int i = 0; i < NUM_TEXTURES; ++i) {
            float weight = 1.0 / float(NUM_TEXTURES);  // jedes Layer erhält im Moment die gleiche Gewichtung!
            overlayColor += texture2D(u_textures[i], v_texCoord) * weight;
        }

        // switch to premultiplied alpha to blend transparent images correctly
        overlayColor.rgb *= overlayColor.a;

        gl_FragColor = overlayColor;
        
        //if(gl_FragColor.a == 0.0) discard;    // discard pixels with 100% transparency
    }
    `;

//* to improve performance everything that doesn't change can be rendered to an offscreen canvas and on next
//* render simply blitted onto the main canvas with c.getContext('2d').drawImage(offScreenCanvas, 0, 0);

class CanvasRenderer {
  private overlayCanvas: HTMLCanvasElement;
  private mapLayer!: any;

  private ctx!: CanvasRenderingContext2D;

  allTextures: HTMLImageElement[] = [];

  constructor() {
    // create an in-memory canvas and set width and height to fill the whole map on screen
    //const canvas = document.createElement("canvas");  //! das funktioniert bei 2D api nicht !!?!?!!?!!?!!
    const canvas = document.querySelector("#texture_canvas") as HTMLCanvasElement;
    canvas.width = map.getCanvas().clientWidth;
    canvas.height = map.getCanvas().clientHeight;
    this.overlayCanvas = canvas;

    const context = canvas.getContext("2d" /*, { alpha: false }*/); //TODO use {alpha: false} to make background dark!
    if (!context) {
      // eslint-disable-next-line no-alert
      throw new Error("No 2d context from canvasRenderer");
    }
    this.ctx = context;
  }

  //TODO only clear a specific part (not the whole canvas)
  clearCanvasPart(px: number, py: number, width: number, height: number): void {
    this.ctx.clearRect(px, py, width, height);
  }

  //TODO test
  rescaleCanvas(newWidth: number, newHeight: number): void {
    this.overlayCanvas.width = newWidth;
    this.overlayCanvas.height = newHeight;

    //this.ctx.scale(newWidth, newHeight);
    // draw()
    // reset scale: this.ctx.scale(-newWidth, -newHeight);
  }

  async renderPolygons(data: any[]): Promise<any> {
    this.mapLayer = data; // im moment unnötig!
    //console.log("this.mapLayer: ", this.mapLayer);

    //* if holes must be rendered both both polygons (outside and hole) have to be in opposite clockwise order

    const ctx = this.ctx;

    // clear the canvas
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    for (const polygons of this.mapLayer) {
      const vertices = polygons.flatMap((el: { x: any; y: any }) => [el.x, el.y]);
      //console.log("vertices: ", vertices);
      if (vertices.length % 2 !== 0) {
        console.warn("Not even number of vertices for ", polygons);
      }

      //! Test this blur / feather effect
      //ctx.globalCompositeOperation = "destination-out";

      //ctx.filter = "blur(12px)"; // "feather"

      //ctx.globalCompositeOperation = "destination-over";

      ctx.beginPath();
      ctx.moveTo(vertices[0], vertices[1]); //TODO für multipolygone bräuchte man in der schleife noch ein moveTo (oder eine 2te schleife) ?
      //? nur bis -1 ??
      for (let index = 2; index < vertices.length; index += 2) {
        //console.log("vertices-idx: ", index);
        ctx.lineTo(vertices[index], vertices[index + 1]);
      }
      ctx.closePath();

      ctx.fillStyle = "rgba(180, 180, 180, 1.0)";
      ctx.fill();
      //ctx.stroke();
      //ctx.globalCompositeOperation = "destination-atop";

      //TODO gehört zum feather effect oben:
      // reset comp. mode and filter
      //ctx.globalCompositeOperation = "destination-out";
      //ctx.filter = "none";

      //TODO klappts damit ???
      /*
      ctx.strokeStyle = "#ffff00";
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.save();

      ctx.fillStyle = "rgba(201, 11, 201, 0.8)";
      ctx.fill();
      //ctx.fill("evenodd");
      ctx.restore();
      */
    }

    await this.saveAsImage();
  }

  saveAsImage(): Promise<void> {
    const img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = (): void => {
        console.log("in onload");

        //use clientWidth and Height so the image fits the current screen size
        img.width = this.overlayCanvas.clientWidth;
        img.height = this.overlayCanvas.clientHeight;

        this.allTextures.push(img);

        //TODO dont use this !!
        /*
        // perf-results: 101,6 ; 101,2 ; 82,6 ; 62,7 ; 45,9 (ms) -> avg: 78,8 ms (vllt lieber median?)
        Benchmark.startMeasure("blur Image with Webgl");
        const canvas = renderAndBlur(img);
        Benchmark.stopMeasure("blur Image with Webgl");

        if (canvas) {
          this.allCanvases.push(canvas);
          resolve();
        } else {
          reject();
        }*/
        resolve();
      };
      img.onerror = (): void => reject();

      //* setting the source should ALWAYS be done after setting the event listener!
      img.src = this.overlayCanvas.toDataURL();
    });
  }

  combineOverlays(textureLayers: HTMLImageElement[]): any {
    console.log("ii", textureLayers);
    //console.log("image", textureLayers[0]);

    // set the number of texture to use
    textureCount = textureLayers.length;
    //* Add the textureCount to the top of the fragment shader so it can dynamically use the
    //* correct number of textures. The shader MUST be created (or updated) AFTER the textureCount
    //* variable has been set as js/ts won't update the string itself when textureCount changes later.
    const fragmentSource = `#define NUM_TEXTURES ${textureCount}\n` + fsCombine;
    //console.log(fragmentSource);

    // create an in-memory canvas and set width and height to fill the whole map on screen
    const canvas = document.createElement("canvas");
    canvas.width = map.getCanvas().clientWidth;
    canvas.height = map.getCanvas().clientHeight;
    //TODO etwas davon aktivieren?
    //{stencil: true, antialias: true, premultipliedAlpha: false, alpha: false, preserveDrawingBuffer: false});
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("Couldn't get a webgl context for combining the overlays!");
    }

    // create and link program
    const program = twgl.createProgramFromSources(gl, [vsCombine, fragmentSource]);

    // lookup attributes
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const texcoordLocation = gl.getAttribLocation(program, "a_texCoord");

    // lookup uniforms
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    // lookup the location for the textures
    const textureLoc = gl.getUniformLocation(program, "u_textures[0]");

    // setup buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    //* this works only because all images have the same size!
    webglUtils.setRectangle(gl, 0, 0, textureLayers[0].width, textureLayers[0].height);

    // texture coordinates are always in the space between 0.0 and 1.0
    const texcoordBuffer = webglUtils.createBuffer(
      gl,
      new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0])
    );

    // setup textures
    const textures = [];
    for (let ii = 0; ii < textureLayers.length; ++ii) {
      const texture = webglUtils.createTexture(gl, textureLayers[ii], ii, gl.NEAREST);
      textures.push(texture);
    }

    // ##### drawing code: #####

    webglUtils.setupCanvasForDrawing(gl, [0, 0, 0, 0.85]);

    gl.useProgram(program);

    //gl.disable(gl.DEPTH_TEST);

    // Turn on the position attribute
    webglUtils.bindAttribute(gl, positionBuffer, positionLocation);
    // Turn on the texcoord attribute
    webglUtils.bindAttribute(gl, texcoordBuffer, texcoordLocation);

    // set the resolution
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

    // Tell the shader to use texture units 0 to textureCount - 1
    gl.uniform1iv(textureLoc, Array.from(Array(textureCount).keys())); //uniform variable location and texture Index (or array of indices)

    //TODO Blending hier oder doch mit custom layer??
    //TODO verschiedene Blend Functions Testen!!
    // see https://stackoverflow.com/questions/39341564/webgl-how-to-correctly-blend-alpha-channel-png/
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); //* this is the correct one for pre-multiplied alpha
    //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); //* this is the correct one for un-premultiplied alpha
    //gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const vertexCount = 6; // 2 triangles for a rectangle
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

    gl.disable(gl.BLEND);

    //TODO render this above in an offscreen canvas and just copy result to main canvas
    this.ctx.drawImage(canvas, 0, 0);
    //return canvas;
  }

  createOverlay(textures: HTMLImageElement[]): HTMLCanvasElement {
    const overlayCanvas = this.combineOverlays(textures);
    //cleanup and delete webgl resources
    //TODO this.cleanupResources();

    return this.overlayCanvas;
    //return overlayCanvas;
  }

  deleteImages(): void {
    // clear array by setting its length to 0
    this.allTextures.length = 0;
  }
}

export default async function createCanvasOverlay(data: any): Promise<void> {
  console.log("Creating canvas overlay now...");

  Benchmark.startMeasure("creating canvas overlay");
  const renderer = new CanvasRenderer();

  Benchmark.startMeasure("render all Polygons");
  for (const layer of data) {
    console.log("layer: ", layer);

    Benchmark.startMeasure("render layer");
    await renderer.renderPolygons(layer.Points);
    Benchmark.stopMeasure("render layer");
  }
  Benchmark.stopMeasure("render all Polygons");

  console.log("Current number of saved textures in canvasRenderer: ", renderer.allTextures.length);
  //TODO for debugging only:
  renderer.allTextures.forEach((image: any) => {
    //console.log(image.src);
    //addImageOverlay(image);
  });

  const resultCanvas = renderer.createOverlay(renderer.allTextures);

  const img = new Image();
  img.onload = (): void => {
    console.log("in onload: ", img.src);
    addCanvasOverlay(resultCanvas);

    //delete all created images in the overlay class
    renderer.deleteImages();
  };
  img.src = resultCanvas.toDataURL();

  Benchmark.stopMeasure("creating canvas overlay");
}
