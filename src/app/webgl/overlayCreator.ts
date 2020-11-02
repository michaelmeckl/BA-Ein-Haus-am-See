//import Reset from "gl-reset";
import Benchmark from "../../shared/benchmarking";
import * as webglUtils from "./webglUtils";
import * as twgl from "twgl.js";
import { addBlurredImage, addCanvasOverlay, addImageOverlay } from "../map/canvasUtils";
import { map } from "../map/mapboxConfig";
import { renderAndBlur } from "./blurFilter";
import { getDilateFS, getGaussianBlurFS, getVSForDilateAndGaussBlur } from "./shaders";
import { createDilateFilter } from "./dilateFilter";
import { createGaussianBlurFilter } from "./gaussianBlurFilter";

// ####### Webgl1 Shader ############

const vs = `
//uniform mat4 u_matrix;
attribute vec2 a_position;

uniform vec2 u_resolution;

void main() {
    vec2 zeroToOne = a_position / u_resolution;
    
    // convert from 0->1 to 0->2
    vec2 zeroToTwo = zeroToOne * 2.0;

    // convert from 0->2 to -1->+1 (clip space)
    vec2 clipSpace = zeroToTwo - 1.0;
    
    // sets the top left corner to (0, 0)
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

    //gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
}
`;

const fs = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

void main() {
  gl_FragColor = vec4(0.7, 0.7, 0.7, 1.0);
}
`;

// ####### Webgl2 Version ############

const vs2 = `#version 300 es

in vec2 a_position;

uniform vec2 u_resolution;
//uniform mat4 u_matrix;

void main() {
    vec2 zeroToOne = a_position / u_resolution;
    
    // convert from 0->1 to 0->2
    vec2 zeroToTwo = zeroToOne * 2.0;

    // convert from 0->2 to -1->+1 (clip space)
    vec2 clipSpace = zeroToTwo - 1.0;
    
    // sets the top left corner to (0, 0)
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

    gl_PointSize = 25.0;
    
    //gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fs2 = `#version 300 es
precision mediump float;

uniform vec4 u_fragColor;

out vec4 color;

void main() {
  //color = vec4(0.6, 0.6, 0.6, 0.8);
  color = u_fragColor;
}
`;

// ####### Shaders for combining the overlays: ############

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

        for (int i = 0; i < NUM_TEXTURES; ++i)
        {
            float weight = 1.0 / float(NUM_TEXTURES);  // jedes Layer erhält im Moment die gleiche Gewichtung!
            overlayColor += texture2D(u_textures[i], v_texCoord) * weight;
        }

        // switch to premultiplied alpha to blend transparent images correctly
        overlayColor.rgb *= overlayColor.a;

        gl_FragColor = overlayColor;
        
        //if(gl_FragColor.a == 0.0) discard;    // discard pixels with 100% transparency
    }
    `;

// ############## Blur Fragment Shader: #####################

const blurShader = `
precision mediump float;
 
// our texture
uniform sampler2D u_image;
uniform vec2 u_textureSize;
uniform float u_kernel[9];
uniform float u_kernelWeight;
 
// the texCoords passed in from the vertex shader.
varying vec2 v_texCoord;
 
void main() {
   vec2 onePixel = vec2(1.0, 1.0) / u_textureSize;

   // sum up all 8 surrounding pixels and the middle
   vec4 colorSum =
     texture2D(u_image, v_texCoord + onePixel * vec2(-1, -1)) * u_kernel[0] +
     texture2D(u_image, v_texCoord + onePixel * vec2( 0, -1)) * u_kernel[1] +
     texture2D(u_image, v_texCoord + onePixel * vec2( 1, -1)) * u_kernel[2] +
     texture2D(u_image, v_texCoord + onePixel * vec2(-1,  0)) * u_kernel[3] +
     texture2D(u_image, v_texCoord + onePixel * vec2( 0,  0)) * u_kernel[4] +
     texture2D(u_image, v_texCoord + onePixel * vec2( 1,  0)) * u_kernel[5] +
     texture2D(u_image, v_texCoord + onePixel * vec2(-1,  1)) * u_kernel[6] +
     texture2D(u_image, v_texCoord + onePixel * vec2( 0,  1)) * u_kernel[7] +
     texture2D(u_image, v_texCoord + onePixel * vec2( 1,  1)) * u_kernel[8] ;
 
   // Divide the sum by the weight but just use rgb
   // we'll set alpha to 1.0
   gl_FragColor = vec4((colorSum / u_kernelWeight).rgb, 1.0);
}
`;

//##########################################

//let reset: () => void;

/**
 * Class to create and combine the textures that are used as an overlay.
 */
class Overlay {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private overlayCanvas: HTMLCanvasElement;

  private mapLayer!: any;

  // webgl resources
  private program!: WebGLProgram;
  private positionLocation!: number;
  private positionBuffer: WebGLBuffer | null = null;
  private resolutionLocation: WebGLUniformLocation | null = null;
  private colorLocation: WebGLUniformLocation | null = null;
  private vao: WebGLVertexArrayObject | null = null;

  allTextures: HTMLImageElement[] = [];
  allCanvases: HTMLCanvasElement[] = [];

  //TODO den canvas etwas größer machen, damit nicht bei jeder kleinen bewegung nachgeladen werden muss??
  // bräuchte ich dann eine view matrix?
  constructor() {
    const canvas = document.querySelector("#texture_canvas") as HTMLCanvasElement;
    //const canvas = document.createElement("canvas"); // create an in-memory canvas
    canvas.width = map.getCanvas().clientWidth;
    canvas.height = map.getCanvas().clientHeight;
    this.overlayCanvas = canvas;

    const glContext = this.overlayCanvas.getContext("webgl2");
    if (!glContext) {
      throw new Error("Couldn't get a webgl context for creating the overlay!");
    }

    this.gl = glContext;

    //reset = Reset(this.gl);
  }

  //TODO die gewichtung sollte pro layer erfolgen und dann als attribute oder direkt als uniform and die shader übergeben werden!
  //! besser wäre es fast einfach den alpha wert pro textur als gewichtung zu nehmen!
  // oder einfach unten in combineLayers als 2tes array nur mit floats (alpha werten) übergeben

  async initWebgl(data: any[]): Promise<any> {
    this.mapLayer = data; //TODO not necessary right now

    // Clear the canvas
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    // setup webgl program with the given shaders
    this.program = twgl.createProgramFromSources(this.gl, [vs2, fs2]);

    //TODO not really necessary and as i dont use requestAnimationFrame for constantly rendering, probably redundant?
    if (this.gl instanceof WebGL2RenderingContext) {
      // Create a vertex array object (attribute state)
      this.vao = this.gl.createVertexArray();
      // and make it the one we're currently working with
      this.gl.bindVertexArray(this.vao);
    }

    this.positionLocation = this.gl.getAttribLocation(this.program, "a_position");

    this.resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution");

    this.colorLocation = this.gl.getUniformLocation(this.program, "u_fragColor");

    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

    webglUtils.bindAttribute(this.gl, this.positionBuffer, this.positionLocation);

    if (this.gl instanceof WebGL2RenderingContext) {
      this.gl.bindVertexArray(null);
    }

    for (const polyData of this.mapLayer) {
      const vertices = polyData.flatMap((el: { x: any; y: any }) => [el.x, el.y]);
      //console.log("vertices: ", vertices);

      this.drawCanvas(vertices);

      //break; //! for testing!

      /*
      console.log("before await saveAsImage");
      await this.saveAsImage();
      console.log("after await saveAsImage");
      */
    }

    //this.allCanvases.push(this.overlayCanvas);

    await this.saveAsImage();
  }

  drawCanvas(vertices: any): void {
    //* gl.bufferData will affect whatever buffer is bound to the `ARRAY_BUFFER` bind point.
    //* If we had more than one buffer we'd want to bind that buffer to `ARRAY_BUFFER` first
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);

    this.gl.useProgram(this.program);

    //! this does apply the wanted effect but only for the last polygon (the others are cleared here!!)
    // -> but the wanted prop is set per layer so is there any other way ??
    /*
    const wanted = true;
    if (wanted) {
      this.gl.clearColor(0.0, 0.0, 0.0, 1.0); // background is black, fully opaque
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      this.gl.uniform4f(this.colorLocation, 0.7, 0.7, 0.7, 0.8); //wanted polys are light grey
    } else {
      this.gl.clearColor(1.0, 1.0, 1.0, 0.0); // background is white, fully transparent
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      this.gl.uniform4f(this.colorLocation, 0.2, 0.2, 0.2, 0.8); // not wanted polys are dark grey
    }
    */

    // set the resolution (needs to be set after useProgram !!)
    this.gl.uniform2f(this.resolutionLocation, this.gl.canvas.width, this.gl.canvas.height);

    this.gl.uniform4f(this.colorLocation, 0.6, 0.6, 0.6, 0.8);

    //this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

    //Bind the attribute/buffer set we want.
    if (this.gl instanceof WebGL2RenderingContext) {
      this.gl.bindVertexArray(this.vao);
    }

    //TODO dont always use two??
    /**
     * const primitiveSize = {
            [gl.LINES]: 2,
            [gl.TRIANGLES]: 3,
            [gl.LINE_STRIP]: 1
        }[drawMode];
     */
    const vertexCount = vertices.length / 2;
    this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, vertexCount);
  }

  //TODO clean this up (and not everything is necessary here)
  saveAsImage(): Promise<void> {
    const img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = (): void => {
        console.log("in onload");

        //use clientWidth and Height so the image fits the current screen size
        img.width = this.overlayCanvas.clientWidth;
        img.height = this.overlayCanvas.clientHeight;

        this.allTextures.push(img);

        //! blur is too late here!! needs to be in the render for each polygon!!

        // perf-results: 101,6 ; 101,2 ; 82,6 ; 62,7 ; 45,9 (ms) -> avg: 78,8 ms (vllt lieber median?)
        Benchmark.startMeasure("blur Image with Webgl");
        const overlayCanvas = createGaussianBlurFilter([img]);
        //const canvas = renderAndBlur(img);
        Benchmark.stopMeasure("blur Image with Webgl");

        if (overlayCanvas) {
          this.allCanvases.push(overlayCanvas);
          resolve();
        } else {
          reject();
        }
        //resolve();
      };
      img.onerror = (): void => reject();

      //* setting the source should ALWAYS be done after setting the event listener!
      img.src = this.overlayCanvas.toDataURL();
    });
  }

  // ###### Methods for combining the overlays: ######

  //TODO blurring could be done in the first step already, not in this
  combineOverlays(textureLayers: HTMLImageElement[]): HTMLCanvasElement {
    //console.log(textureLayers);

    // set the number of texture to use
    textureCount = textureLayers.length;
    //* Add the textureCount to the top of the fragment shader so it can dynamically use the
    //* correct number of textures. The shader MUST be created (or updated) AFTER the textureCount
    //* variable has been set as js/ts won't update the string itself when textureCount changes later.
    const fragmentSource = `#define NUM_TEXTURES ${textureCount}\n` + fsCombine;

    //TODO reusing the canvas or gl ctx from the methods above would be nice but doesn't seem to work :(

    // create an in-memory canvas and set width and height to fill the whole map on screen
    const canvas = document.createElement("canvas");
    canvas.width = map.getCanvas().clientWidth;
    canvas.height = map.getCanvas().clientHeight;
    //TODO etwas davon aktivieren?
    //const gl = canvas.getContext("webgl2", {stencil: true, antialias: true, premultipliedAlpha: false, alpha: false});
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

    webglUtils.setupCanvasForDrawing(gl, [0, 0, 0, 0]);

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

    return canvas;
  }

  createOverlay(textures: HTMLImageElement[]): HTMLCanvasElement {
    const overlayCanvas = this.combineOverlays(textures);
    //const overlayCanvas = createGaussianBlurFilter(textures); //TODO
    //cleanup and delete webgl resources
    this.cleanupResources();

    return overlayCanvas;
  }

  // see https://stackoverflow.com/questions/23598471/how-do-i-clean-up-and-unload-a-webgl-canvas-context-from-gpu-after-use
  cleanupResources(): void {
    // desallocate memory and free resources to avoid memory leak issues
    const numTextureUnits = this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS);
    for (let unit = 0; unit < numTextureUnits; ++unit) {
      this.gl.activeTexture(this.gl.TEXTURE0 + unit);
      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
      this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, null);
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    // Delete all your resources
    this.gl.deleteProgram(this.program);
    this.gl.deleteBuffer(this.positionBuffer);
    //TODO ein paar fehlen noch hier!

    //this.gl.canvas.width = 1;
    //this.gl.canvas.height = 1;

    //this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    //this.gl.getExtension("WEBGL_lose_context")?.restoreContext();
  }

  deleteImages(): void {
    // clear array by setting its length to 0
    this.allTextures.length = 0;
  }
}

export default async function createOverlay(data: any): Promise<void> {
  console.log("Creating overlay now...");

  Benchmark.startMeasure("creating overlay");
  const overlay = new Overlay();

  //TODO layer sollte ein object sein mit den properties coord array, radius und relevance
  for (const layer of data) {
    console.log("layer: ", layer);
    Benchmark.startMeasure("init webgl");
    await overlay.initWebgl(layer.Points);
    Benchmark.stopMeasure("init webgl");

    //TODO drawTexture for every layer instead of everything in initWebgl?
    /*
    for (let index = 0; index < allTextures.length; index++) {
        const texture = allTextures[index];
        
    }
    */
  }

  console.log("Current number of saved textures in overlayCreator: ", overlay.allTextures.length);
  //TODO for debugging only:
  overlay.allTextures.forEach((image) => {
    //console.log(image.src);
    //addImageOverlay(image);
  });

  const test: any[] = [];
  overlay.allCanvases.forEach((c) => {
    //console.log(image.src);
    //addImageOverlay(image);
    const img = new Image();
    img.onload = (): void => {
      console.log("Canvas:", img.src);
    };
    img.src = c.toDataURL();
    test.push(img);
  });

  console.log(test);

  //const resultCanvas = overlay.createOverlay(test);
  const resultCanvas = overlay.createOverlay(overlay.allTextures);

  const img = new Image();
  img.onload = (): void => {
    console.log("in onload: ", img.src);
    addCanvasOverlay(resultCanvas);

    //delete all created images in the overlay class
    overlay.deleteImages();
  };
  img.src = resultCanvas.toDataURL();

  Benchmark.stopMeasure("creating overlay");
}
