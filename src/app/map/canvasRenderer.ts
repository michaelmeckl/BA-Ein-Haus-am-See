import { map } from "./mapboxConfig";
import Benchmark from "../../shared/benchmarking";
import { addCanvasOverlay, invertCanvas, makeAlphaMask } from "./canvasUtils";
import * as webglUtils from "../webgl/webglUtils";
import { metersInPixel } from "./mapboxUtils";
import * as twgl from "twgl.js";
//import FastGaussBlur from "../vendors/fast-gauss-blur";

import "../vendors/StackBlur";
import { applyGaussianBlur, createGaussianBlurFilter } from "../webgl/gaussianBlurFilter";
import type { FilterLayer } from "../mapData/filterLayer";
import mapLayerManager from "./mapLayerManager";

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
    uniform float u_weights[NUM_TEXTURES];

    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;

    void main() {
        vec4 overlayColor = vec4(0.0);
        float weight;

        for (int i = 0; i < NUM_TEXTURES; ++i) {
            weight = u_weights[i];
            overlayColor += texture2D(u_textures[i], v_texCoord) * weight;
        }

        //float invertedAlpha = 1.0 - overlayColor.g;

        // switch to premultiplied alpha to blend transparent images correctly
        overlayColor.rgb *= overlayColor.a;

        gl_FragColor = vec4(overlayColor.rgb, overlayColor.a);

        //if(gl_FragColor.r > 0.5 || gl_FragColor.g > 0.5 || gl_FragColor.b > 0.5) discard;
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

  //TODO diese variablen hier müssten gecleared werden immer am Ende oder Anfang!
  private weights: number[] = [];

  constructor() {
    // create an in-memory canvas and set width and height to fill the whole map on screen
    //const canvas = document.createElement("canvas");  //* das funktioniert bei 2D api nicht!
    const canvas = document.querySelector("#texture_canvas") as HTMLCanvasElement;
    canvas.width = map.getCanvas().clientWidth;
    canvas.height = map.getCanvas().clientHeight;
    //console.log("Width:", canvas.width);
    //console.log("Height:", canvas.height);

    this.overlayCanvas = canvas;

    const context = canvas.getContext("2d" /*, { alpha: false }*/); //TODO use {alpha: false} to make background dark!
    if (!context) {
      // eslint-disable-next-line no-alert
      throw new Error("No 2d context from canvasRenderer");
    }
    this.ctx = context;
  }

  //TODO only clear a specific part (not the whole canvas)
  //! save coordinates of the old overlay and if no zoom update only the rest ??? ->  is this better?

  //TODO test
  rescaleCanvas(newWidth: number, newHeight: number): void {
    this.overlayCanvas.width = newWidth;
    this.overlayCanvas.height = newHeight;

    //this.ctx.scale(newWidth, newHeight);
    // draw()
    // reset scale: this.ctx.scale(-newWidth, -newHeight);
  }

  async renderPolygons(mapLayer: FilterLayer): Promise<any> {
    this.mapLayer = mapLayer; // TODO im moment unnötig aber vermtl nötig um ständiz zu updaten!
    //console.log("this.mapLayer: ", this.mapLayer);

    //* if holes must be rendered both both polygons (outside and hole) have to be in opposite clockwise order

    const ctx = this.ctx;

    // clear the canvas
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    //fill black
    ctx.fillStyle = "rgba(0.0, 0.0, 0.0, 1.0)";
    ctx.fillRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    this.weights.push(mapLayer.Relevance);

    console.log(
      "Meter in pixel: ",
      metersInPixel(mapLayer.Distance, map.getCenter().lat, map.getZoom())
    );

    //ctx.globalCompositeOperation = "source-over";
    // apply a "feather"/blur - effect to everything that is drawn on the canvas

    //ctx.filter = "blur(25px)";

    //ctx.globalAlpha = 0.5;

    //const promises: any[] = [];

    Benchmark.startMeasure("render and blur all polygons of one layer");
    console.log("before render and blur all polygons of one layer");

    createGaussianBlurFilter();

    //const promises = this.mapLayer.Points.map(async (polygon: { x: any; y: any }[]) => {
    for (const polygon of this.mapLayer.Points) {
      //console.log("polygon", polygon);
      const vertices = polygon.flatMap((el: { x: any; y: any }) => [el.x, el.y]);
      //console.log("vertices: ", vertices);
      if (vertices.length % 2 !== 0) {
        console.warn("Not even number of vertices for ", polygon);
      }

      ctx.beginPath();
      ctx.moveTo(vertices[0], vertices[1]); //TODO für multipolygone bräuchte man in der schleife noch ein moveTo (oder eine 2te schleife) ?

      for (let index = 2; index < vertices.length - 1; index += 2) {
        //console.log("vertices-idx: ", index);
        ctx.lineTo(vertices[index], vertices[index + 1]);
      }
      ctx.closePath();

      //* Beispiel für mehrere STrokes übereinander (und nur die stroke geblurred)
      /*
      ctx.filter = "blur(15px)";

      ctx.strokeStyle = "#aaaaaa";
      ctx.lineWidth = 40;
      ctx.stroke();

      ctx.save();

      ctx.globalCompositeOperation = "destination-over";

      ctx.scale(2, 2);
      ctx.strokeStyle = "#bbbbbb";
      ctx.lineWidth = 60;
      ctx.stroke();

      ctx.restore();

      ctx.save();

      ctx.globalCompositeOperation = "destination-over";

      ctx.scale(2, 2);
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 80;
      ctx.stroke();

      ctx.restore();

      ctx.filter = "none";
      */

      //TODO entweder hier den alpha wert pro layer ändern für gewichtung oder später als zusätzliches array an opengl übergeben pro textur
      // TODO hier macht keinen sinn oder? dann würden sich die ja nur aufaddieren!

      // draw polygons white
      ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
      ctx.fill("evenodd");

      //ctx.stroke();

      //promises.push(this.blurPolygon());
      await this.blurPolygon();
      // await this.anotherBlur();
      //await this.fastGaußBlur();

      //break;
    }
    console.log("after render and blur all polygons of one layer");

    //const allBlurredPolys = await Promise.all(promises);

    Benchmark.stopMeasure("render and blur all polygons of one layer");

    //ctx.globalCompositeOperation = "destination-over";
    //ctx.filter = "none";

    await this.saveAsImage();
  }

  updateOverlay(newData: any): void {
    //TODO bei jeder Bewegung aufrufen und das oben neu machen
  }

  blurPolygon(): Promise<void> {
    //TODO
    /*
    return new Promise((resolve, reject) => {
      this.fastGaußBlur();
      resolve();
    });
    */

    let img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = (): void => {
        //use clientWidth and Height so the image fits the current screen size
        img.width = this.overlayCanvas.clientWidth;
        img.height = this.overlayCanvas.clientHeight;

        //TODO:
        //if(shouldShowAreas) { do blur ]
        Benchmark.startMeasure("blur Image with Webgl");
        const overlayCanvas = applyGaussianBlur([img]);
        //const canvas = renderAndBlur(img);
        Benchmark.stopMeasure("blur Image with Webgl");

        this.ctx.drawImage(overlayCanvas, 0, 0);

        //* draw original image over the blurred one to create an outline effect?
        //this.ctx.drawImage(img, 0, 0);

        img.onload = null;
        //@ts-expect-error
        img = null;
        resolve();
      };
      img.onerror = (): void => reject();

      //* setting the source should ALWAYS be done after setting the event listener!
      img.src = this.overlayCanvas.toDataURL();
    });
  }

  saveAsImage(): Promise<void> {
    let img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = (): void => {
        console.log("in onload");

        //use clientWidth and Height so the image fits the current screen size
        img.width = this.overlayCanvas.clientWidth;
        img.height = this.overlayCanvas.clientHeight;

        this.allTextures.push(img);

        //TODO:
        //if(shouldShowAreas) { do blur ]
        Benchmark.startMeasure("blur Image with Webgl");
        //const overlayCanvas = createGaussianBlurFilter([img]);
        //const canvas = renderAndBlur(img);
        Benchmark.stopMeasure("blur Image with Webgl");

        //this.ctx.drawImage(overlayCanvas, 0, 0);

        //* draw original image over the blurred one to create an outline effect?
        //this.ctx.drawImage(img, 0, 0);

        /*
        if (canvas) {
          this.allCanvases.push(canvas);
          resolve();
        } else {
          reject();
        }
        */

        img.onload = null;
        //@ts-expect-error
        img = null;
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
    const weightsLoc = gl.getUniformLocation(program, "u_weights[0]");
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

    webglUtils.setupCanvasForDrawing(gl, [0.0, 0.0, 0.0, 0.0]);

    gl.useProgram(program);

    //gl.disable(gl.DEPTH_TEST);

    // Turn on the position attribute
    webglUtils.bindAttribute(gl, positionBuffer, positionLocation);
    // Turn on the texcoord attribute
    webglUtils.bindAttribute(gl, texcoordBuffer, texcoordLocation);

    // set the resolution
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
    // set the weights
    const ws: number[] = [];
    textureLayers.forEach(() => {
      ws.push(1 / textureLayers.length);
    });
    gl.uniform1fv(weightsLoc, ws);

    // Tell the shader to use texture units 0 to textureCount - 1
    gl.uniform1iv(textureLoc, Array.from(Array(textureCount).keys())); //uniform variable location and texture Index (or array of indices)

    //TODO Blending hier oder doch mit custom layer??
    //TODO verschiedene Blend Functions Testen!!
    // see https://stackoverflow.com/questions/39341564/webgl-how-to-correctly-blend-alpha-channel-png/
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); //* this is the correct one for pre-multiplied alpha
    //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); //* this is the correct one for un-premultiplied alpha
    //gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    /**
     * * BlendModes:
      //Blend SrcAlpha OneMinusSrcAlpha // Normal
			//Blend One One // Additive
			//Blend One OneMinusDstColor // Soft Additive
			//Blend DstColor Zero // Multiplicative
			//Blend DstColor SrcColor // 2x Multiplicative
     */

    const vertexCount = 6; // 2 triangles for a rectangle
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

    gl.disable(gl.BLEND);

    //TODO render this above in an offscreen canvas and just copy result to main canvas
    this.ctx.drawImage(canvas, 0, 0);
    //return canvas;
  }

  createOverlay(textures: HTMLImageElement[]): HTMLCanvasElement {
    this.combineOverlays(textures);
    //cleanup and delete webgl resources
    //TODO this.cleanupResources();

    return this.overlayCanvas;
  }

  deleteImages(): void {
    // clear array by setting its length to 0
    this.allTextures.length = 0;
  }

  //TODO oder das custom layer hierfür nehmen??
  blendOnMap(): void {
    //console.log("onload map canvas: ", originalMapImage?.src);

    /*
    const activeLayers = mapLayerManager.currentActiveLayers;
    console.log("active Layers: ", activeLayers);

    //TODO klappt so auch nicht so wirklich und ist wahrscheinlich auch nicht gut für performance und ux
    activeLayers.forEach((layer) => {
      mapLayerManager.hideLayer(layer.id);
    });
    */

    const mapCanvas = map.getCanvas();

    //* clears to black but flickers for a moment
    /*
    const mapContext = mapCanvas.getContext("webgl");
    if (!mapContext) {
      console.error("No context from map available!");
      return;
    }

    mapContext.viewport(0, 0, mapContext.drawingBufferWidth, mapContext.drawingBufferHeight);
    mapContext.clearColor(0.0, 0.0, 0.0, 1.0);
    mapContext.clear(mapContext.COLOR_BUFFER_BIT);
    */

    const image = new Image();
    image.onload = () => {
      image.width = mapCanvas.clientWidth; //use clientWidth and Height so the image fits the current screen size
      image.height = mapCanvas.clientHeight;

      //makeAlphaMask(this.overlayCanvas);

      //TODO damit sich die nicht verändert, sollte ich die am anfang global speichern?
      //! bringt nichts weil das ja nur der start kartenausschnitt dann immer ist, ich beweg mich ja!!
      // console.log("map canvas without custom layers: ", image.src);
    };
    image.src = mapCanvas.toDataURL();
  }
}

export default async function createCanvasOverlay(data: any): Promise<void> {
  console.log("Creating canvas overlay now...");

  Benchmark.startMeasure("creating canvas overlay");
  const renderer = new CanvasRenderer();

  console.log("before");
  Benchmark.startMeasure("render all Polygons");
  const allRenderProcesses = data.map((layer: FilterLayer) => renderer.renderPolygons(layer));
  await Promise.all(allRenderProcesses);
  Benchmark.startMeasure("render all Polygons");
  console.log("after");

  console.log("Current number of saved textures in canvasRenderer: ", renderer.allTextures.length);

  const resultCanvas = renderer.createOverlay(renderer.allTextures);

  Benchmark.stopMeasure("creating canvas overlay");

  //invertCanvas(resultCanvas);

  makeAlphaMask(resultCanvas);
  //renderer.blendOnMap();

  const img = new Image();
  img.onload = (): void => {
    //console.log("in onload: ", img.src);
    //addCanvasOverlay(resultCanvas, 1.0);
  };
  img.src = resultCanvas.toDataURL();

  //delete all created images in the overlay class
  renderer.deleteImages();

  console.log("test aljflafjljal fskj");
}
