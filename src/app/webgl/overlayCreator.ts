import Benchmark from "../../shared/benchmarking";
import * as webglUtils from "./webglUtils";
import * as twgl from "twgl.js";
import Reset from "gl-reset";
import { addBlurredImage, addCanvasOverlay, addImageOverlay } from "../map/canvasUtils";
import { map } from "../map/mapboxConfig";
import { renderAndBlur } from "./blurFilter";

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

out vec4 color;

void main() {
  color = vec4(0.7, 0.7, 0.7, 1.0);
}
`;

// ###########################################

const textureCount = 8;

//* von Shadertoy:
/*
Shader Inputs
uniform vec3      iResolution;           // viewport resolution (in pixels)
uniform vec3      iChannelResolution[4]; // channel resolution (in pixels)
uniform samplerXX iChannel0..3;          // input channel. XX = 2D/Cube
*/

//prettier-ignore
const fsCombine = `#version 300 es
precision mediump float;

in vec2 fragCoord;

out vec4 fragColor;

uniform vec2 u_Resolution;
uniform sampler2D textures[` + textureCount + `];

void main() {
    /*
    vec2 uv =  fragCoord.xy / u_Resolution.xy;
    vec2 res = iChannelResolution[0].xy;

    // load color info from all textures
    vec4 texel0 = texture(iChannel0, uv);
    vec4 texel1 = texture(iChannel1, uv);
    vec4 texel2 = texture(iChannel2, uv);
    vec4 texel3 = texture(iChannel3, uv);

    vec4 texels[4] = vec4[4](texel0, texel1, texel2, texel3);
   
    // test for arrays and for loops in glsl
    vec4 result = vec4(1,1,1,1);

    for(int i=0;i<10;++i)
    {
        result += texel0[i];
    }
    
    const float w = 0.25;
    //const float w = 1.0 / float(blurredTexels.length());
    
    vec4 mixResult;
    for(int i=0; i < blurredTexels.length(); ++i) 
    {
        //= colBlurred0 * w + colBlurred1 * w + colBlurred2 * w + texel3 * w;
        mixResult += blurredTexels[i] * w;
    }
    mixResult += texel3 * 0.5;
    
    vec4 test = texel1 * 0.4 + texel2 * 0.2 + texel0*0.4;
    vec4 dd = mix(test, texel3, 0.2);
   
    fragColor = dd;
    */

    fragColor = vec4(0.6, 0.6, 0.6, 1.0);
}
`;

// ###########################################

//? use this
let reset: () => void;

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
  private vao: WebGLVertexArrayObject | null = null;

  allTextures: HTMLImageElement[] = [];
  allCanvases: HTMLCanvasElement[] = [];

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
  async initWebgl(data: any[]): Promise<any> {
    this.mapLayer = data;

    // Clear the canvas
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    this.program = this.setupProgram(vs2, fs2);

    //TODO not really necessary and as i dont use requestAnimationFrame for constantly rendering, probably redundant?
    if (this.gl instanceof WebGL2RenderingContext) {
      // Create a vertex array object (attribute state)
      this.vao = this.gl.createVertexArray();
      // and make it the one we're currently working with
      this.gl.bindVertexArray(this.vao);
    }

    this.positionLocation = this.gl.getAttribLocation(this.program, "a_position");

    this.resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution");

    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

    webglUtils.bindAttribute(this.gl, this.positionBuffer, this.positionLocation);

    if (this.gl instanceof WebGL2RenderingContext) {
      this.gl.bindVertexArray(null);
    }

    for (const polyData of this.mapLayer) {
      //console.log("polyData: ", polyData);
      const vertices = polyData.flatMap((el: { x: any; y: any }) => [el.x, el.y]);
      //console.log("vertices: ", vertices);

      this.drawCanvas(vertices);

      /*
      console.log("before await saveAsImage");
      await this.saveAsImage();
      console.log("after await saveAsImage");
      */
    }

    //this.allCanvases.push(this.overlayCanvas);

    await this.saveAsImage();

    //TODO does this work? is this even necessary?
    //this.clearCanvas();
    //return this.overlayCanvas;
  }

  setupProgram(vertexShaderSource: string, fragmentShaderSource: string): WebGLProgram {
    // setup webgl program with the given shaders
    return twgl.createProgramFromSources(this.gl, [vertexShaderSource, fragmentShaderSource]);
  }

  drawCanvas(vertices: any): void {
    //* gl.bufferData will affect whatever buffer is bound to the `ARRAY_BUFFER` bind point.
    //* If we had more than one buffer we'd want to bind that buffer to `ARRAY_BUFFER` first
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);

    this.gl.useProgram(this.program);

    // set the resolution (needs to be set after useProgram !!)
    this.gl.uniform2f(this.resolutionLocation, this.gl.canvas.width, this.gl.canvas.height);

    //this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

    //Bind the attribute/buffer set we want.
    if (this.gl instanceof WebGL2RenderingContext) {
      this.gl.bindVertexArray(this.vao);
    }

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

        //TODO dont use this !!
        // perf-results: 101,6 ; 101,2 ; 82,6 ; 62,7 ; 45,9 (ms) -> avg: 78,8 ms (vllt lieber median?)
        Benchmark.startMeasure("blur Image with Webgl");
        const canvas = renderAndBlur(img);
        Benchmark.stopMeasure("blur Image with Webgl");

        if (canvas) {
          this.allCanvases.push(canvas);
          resolve();
        } else {
          reject();
        }
      };
      img.onerror = (): void => reject();

      //* setting the source should ALWAYS be done after setting the event listener!
      img.src = this.overlayCanvas.toDataURL();
    });
  }

  // ###### Methods for combining the overlays: ######

  private textureCount = 2;

  /*
 * Shader Inputs von Shadertoy:
 uniform vec3      iResolution;           // viewport resolution (in pixels)
 uniform vec3      iChannelResolution[4]; // channel resolution (in pixels)
 uniform samplerXX iChannel0..3;          // input channel. XX = 2D/Cube
 */

  //prettier-ignore
  private fs = `
  precision mediump float;
 
  #define NUM_TEXTURES ${this.textureCount}

  varying vec2 fragCoord;

  // the texCoords passed in from the vertex shader.
  varying vec2 v_texCoord;
 
  //out vec4 fragColor;
 
  uniform vec2 u_Resolution;
  uniform sampler2D textures[NUM_TEXTURES];
 
  void main() {
    //vec2 uv =  fragCoord.xy / u_Resolution.xy;
    vec2 uv =  fragCoord / u_Resolution;
    //vec2 uv = fragCoord;

     /*
     
     vec2 res = iChannelResolution[0].xy;
 
     // load color info from all textures
     vec4 texel0 = texture(iChannel0, uv);
     vec4 texel1 = texture(iChannel1, uv);
     vec4 texel2 = texture(iChannel2, uv);
     vec4 texel3 = texture(iChannel3, uv);
 
     vec4 texels[4] = vec4[4](texel0, texel1, texel2, texel3);
    
     // test for arrays and for loops in glsl
     vec4 result = vec4(1,1,1,1);
 
     for(int i=0;i<10;++i)
     {
         result += texel0[i];
     }
     
     const float w = 0.25;
     //const float w = 1.0 / float(blurredTexels.length());
     
     vec4 mixResult;
     for(int i=0; i < blurredTexels.length(); ++i) 
     {
         //= colBlurred0 * w + colBlurred1 * w + colBlurred2 * w + texel3 * w;
         mixResult += blurredTexels[i] * w;
     }
     mixResult += texel3 * 0.5;
     
     vec4 test = texel1 * 0.4 + texel2 * 0.2 + texel0*0.4;
     vec4 dd = mix(test, texel3, 0.2);
    
     fragColor = dd;
     */
 
    //vec4 texel3 = texture(iChannel3, uv);
    
    vec4 combinedRes = vec4(0.0);
    
    for(int i=0;i<NUM_TEXTURES;++i)
    {
        combinedRes += texture2D(textures[i], uv) * 0.3;
    }
    //vec4 endRes = mix(combinedRes, texel3, 0.2);

     gl_FragColor = texture2D(textures[0], v_texCoord);
     //gl_FragColor = combinedRes;
     //gl_FragColor = vec4(1,0,0,1);
 }
 `;

  private vs1 = `

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

  //* hier muss Webgl1 verwendet werden, sonst gehen keine dynamischen Variablen in der for-Schleife!
  private fs1 = `
    precision mediump float;

    #define NUM_TEXTURES ${this.textureCount}

    // our textures
    uniform sampler2D u_image0;
    uniform sampler2D u_image1;

    uniform sampler2D textures[NUM_TEXTURES];

    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;

    void main() {
        vec4 color0 = texture2D(u_image0, v_texCoord);
        vec4 color1 = texture2D(u_image1, v_texCoord);

        vec4 overlayColor = color0 * 0.5 + color1 * 0.5;
        overlayColor.rgb *= overlayColor.a;

        gl_FragColor = overlayColor;
        
        //if(gl_FragColor.a == 0.0) discard;
    }
    `;

  //TODO blurring could be done in the first step already, not in this
  combineOverlays(textureLayers: HTMLImageElement[]): HTMLCanvasElement {
    console.log("in combine overlays at the start");
    console.log(textureLayers);

    // create an in-memory canvas and set width and height to fill the whole map on screen
    const canvas = document.createElement("canvas");
    canvas.width = map.getCanvas().clientWidth;
    canvas.height = map.getCanvas().clientHeight;
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("Couldn't get a webgl context for combining the overlays!");
    }

    // create and link program
    const program = twgl.createProgramFromSources(gl, [this.vs1, this.fs1]);

    // lookup attributes
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const texcoordLocation = gl.getAttribLocation(program, "a_texCoord");

    // lookup uniforms
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    // lookup the sampler locations.
    const uImage0Location = gl.getUniformLocation(program, "u_image0");
    const uImage1Location = gl.getUniformLocation(program, "u_image1");

    // setup buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    //* this works only because all images have the same size!
    webglUtils.setRectangle(gl, 0, 0, textureLayers[0].width, textureLayers[0].height);

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

    // ##### drawing code #####

    webglUtils.setupCanvasForDrawing(gl, [0, 0, 0, 0]);

    gl.useProgram(program);

    // Turn on the position attribute
    webglUtils.bindAttribute(gl, positionBuffer, positionLocation);
    // Turn on the texcoord attribute
    webglUtils.bindAttribute(gl, texcoordBuffer, texcoordLocation);

    // set the resolution
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

    // set which texture units to render with.
    gl.uniform1i(uImage0Location, 0); // texture unit 0
    gl.uniform1i(uImage1Location, 1); // texture unit 1

    /*
    // Set each texture unit to use a particular texture.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures[1]);
    */

    /*
    const textureLoc = gl.getUniformLocation(program, "textures[0]");
    // Tell the shader to use texture units 0 to 3
    //gl.uniform1iv(textureLoc, [0, 1, 2, 3]); //uniform variable location and texture Index (or array of indices)
    gl.uniform1iv(textureLoc, [0, 1]);

    */

    //TODO Blending hier oder doch mit custom layer??
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    //gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    //TODO cleanup resources and delete canvas afterwards?

    return canvas;
  }
}

export default async function createOverlay(data: any): Promise<any> {
  console.log("Creating overlay now...");

  Benchmark.startMeasure("creating overlay");
  const overlay = new Overlay();

  for (const layer of data) {
    console.log("layer: ", layer);
    Benchmark.startMeasure("init webgl");
    const canvas = await overlay.initWebgl(layer);
    Benchmark.stopMeasure("init webgl");

    //TODO call drawTexture for every layer
    /*
    for (let index = 0; index < allTextures.length; index++) {
        const texture = allTextures[index];
        
    }
    */
  }

  overlay.allTextures.forEach((image) => {
    //console.log(image.src);
    //addImageOverlay(image);
  });

  const resultCanvas = overlay.combineOverlays(overlay.allTextures);

  const img = new Image();
  img.onload = () => {
    console.log("in onload: ", img.src);
    addCanvasOverlay(resultCanvas);
  };
  img.src = resultCanvas.toDataURL();

  Benchmark.stopMeasure("creating overlay");
  return overlay;
}
