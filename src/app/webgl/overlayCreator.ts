import Benchmark from "../../shared/benchmarking";
import * as webglUtils from "./webglUtils";
import * as twgl from "twgl.js";
import Reset from "gl-reset";
import { addBlurredImage, addCanvasOverlay, addImageOverlay } from "../map/canvasUtils";
import { map } from "../map/mapboxConfig";
import { renderAndBlur } from "./blurFilter";

//* working example:
/*

    const positions = [data.length * 2];
    data.forEach((coords, i) => {
      positions[i * 2] = coords.x;
      positions[i * 2 + 1] = coords.y;
    });
    this.mapData = positions;

    this.setupProgram();
    this.positionLocation = this.gl.getAttribLocation(this.program, "a_position");
    this.positionBuffer = this.gl.createBuffer();
    // bind buffer (think of it as ARRAY_BUFFER = positionBuffer)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.mapData), this.gl.STATIC_DRAW);

    // Tell WebGL how to convert from clip space to pixels
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    // Clear the canvas
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.useProgram(this.program);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.enableVertexAttribArray(this.positionLocation);
    const numComponents = 2;
    const type = this.gl.FLOAT;
    const normalize = false;
    const stride = 0;
    this.gl.vertexAttribPointer(this.positionLocation, numComponents, type, normalize, stride, 0);

    const offset = 0;
    const vertexCount = this.mapData.length / 2;
    this.gl.drawArrays(this.gl.TRIANGLES, offset, 3);

    return this.overlayCanvas;
*/

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

  public allTextures: HTMLImageElement[] = [];
  allCanvases: HTMLCanvasElement[] = [];

  // webgl resources
  program!: WebGLProgram;
  positionBuffer: WebGLBuffer | null = null;
  positionLocation!: number;
  resolutionLocation: WebGLUniformLocation | null = null;

  vao: WebGLVertexArrayObject | null = null;

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
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.program = this.setupProgram(vs2, fs2);

    //TODO not really necessary and as i dont use requestAnimationFrame for constantly rendering, probably redundant?
    if (this.gl instanceof WebGL2RenderingContext) {
      // Create a vertex array object (attribute state)
      this.vao = this.gl.createVertexArray();
      // and make it the one we're currently working with
      this.gl.bindVertexArray(this.vao);
    }

    this.setupAttributesAndUniforms();

    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

    // Turn on the attribute
    this.gl.enableVertexAttribArray(this.positionLocation);

    const numComponents = 2;
    const type = this.gl.FLOAT;
    const normalize = false;
    const stride = 0;
    this.gl.vertexAttribPointer(this.positionLocation, numComponents, type, normalize, stride, 0);

    if (this.gl instanceof WebGL2RenderingContext) {
      this.gl.bindVertexArray(null);
    }

    //for (const polyData of this.mapLayer) {
    for (const polyData of this.mapLayer) {
      console.log("polyData: ", polyData);
      const vertices = polyData.flatMap((el: { x: any; y: any }) => [el.x, el.y]);
      //console.log("vertices: ", vertices);

      //this.initPositionBuffer(this.mapLayer);

      this.drawCanvas(vertices);

      console.log("before await saveAsImage");
      //await this.saveAsImage();
      console.log("after await saveAsImage");
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

    // Tell WebGL how to convert from clip space to pixels
    //this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

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

  saveAsImage(): Promise<void> {
    const img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = (): void => {
        console.log("in onload");

        img.width = this.overlayCanvas.clientWidth; //use clientWidth and Height so the image fits the current screen size
        img.height = this.overlayCanvas.clientHeight;

        //TODO
        this.allTextures.push(img);

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

      // setting the source should ALWAYS be done after setting the event listener!
      img.src = this.overlayCanvas.toDataURL();
    });
  }

  setupAttributesAndUniforms(): void {
    // lookup attributes
    this.positionLocation = this.gl.getAttribLocation(this.program, "a_position");

    // lookup uniforms
    this.resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution");

    /*
    const texcoordLocation = this.gl.getAttribLocation(this.program, "a_texCoord");

    const textureSizeLocation = this.gl.getUniformLocation(this.program, "u_textureSize");
    const kernelLocation = this.gl.getUniformLocation(this.program, "u_kernel[0]");
    const kernelWeightLocation = this.gl.getUniformLocation(this.program, "u_kernelWeight");
    */
  }

  private textureCount = 2;

  //* von Shadertoy:
  /*
 Shader Inputs
 uniform vec3      iResolution;           // viewport resolution (in pixels)
 uniform vec3      iChannelResolution[4]; // channel resolution (in pixels)
 uniform samplerXX iChannel0..3;          // input channel. XX = 2D/Cube
 */

  private vs_old = `

 attribute vec2 a_position;
 
 uniform vec2 u_res;

 varying vec2 fragCoord;
 
 void main() {
     vec2 zeroToOne = a_position / u_res;
     
     // convert from 0->1 to 0->2
     vec2 zeroToTwo = zeroToOne * 2.0;
 
     // convert from 0->2 to -1->+1 (clip space)
     vec2 clipSpace = zeroToTwo - 1.0;
     
     // sets the top left corner to (0, 0)
     gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

     fragCoord = zeroToOne;
 }
 `;

  private vs = `
  
  attribute vec2 a_position;

  attribute vec2 a_texCoord;

  uniform vec2 u_resolution;
  //in float a_textureIndex;
  //out float v_textureIndex;

  varying vec2 fragCoord;

  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0, 1.0);
    //v_textureIndex = a_textureIndex;

    fragCoord = a_position;

    // pass the texCoord to the fragment shader
   // The GPU will interpolate this value between points
   v_texCoord = a_texCoord;
  }
 `;

  //TODO geht so nicht
  //uniform sampler2D textures[` + this.textureCount + `];

  //prettier-ignore
  private fs = `
  precision mediump float;
 
  #define NUM_TEXTURES ${textureCount}

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

  private fs1 = `
    precision mediump float;

    // our textures
    uniform sampler2D u_image0;
    uniform sampler2D u_image1;

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

  //TODO needs to be called with a separate fs and all the textures
  //TODO blurring could be done in the first step already, not in this
  combineOverlays(textureLayers: HTMLImageElement[]): HTMLCanvasElement {
    console.log("in combine overlays at the start");
    console.log(textureLayers);

    const canvas = document.createElement("canvas"); // create an in-memory canvas
    canvas.width = map.getCanvas().clientWidth;
    canvas.height = map.getCanvas().clientHeight;

    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("Couldn't get a webgl context for creating the overlay!");
    }

    const program = twgl.createProgramFromSources(gl, [this.vs1, this.fs1]);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    //const fragCoordLocation = gl.getAttribLocation(program, "fragCoord");
    const texcoordLocation = gl.getAttribLocation(program, "a_texCoord");

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    //* this works only because all images have the same size!
    webglUtils.setRectangle(gl, 0, 0, textureLayers[0].width, textureLayers[0].height);

    // provide texture coordinates for the rectangle.
    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0]),
      gl.STATIC_DRAW
    );

    /*
    // Turn on the attribute
    gl.enableVertexAttribArray(positionLocation);
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    gl.vertexAttribPointer(positionLocation, numComponents, type, normalize, stride, 0);

    const positions = [1, 1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    */

    const textures = [];
    for (let ii = 0; ii < 2; ++ii) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);

      // Set the parameters so we can render any size image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      // Upload the image into the texture.
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureLayers[ii]);

      // add the texture to the array of textures.
      textures.push(texture);
    }

    // lookup uniforms
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    // lookup the sampler locations.
    const uImage0Location = gl.getUniformLocation(program, "u_image0");
    const uImage1Location = gl.getUniformLocation(program, "u_image1");

    //? webglUtils.resizeCanvas(canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    //TODO enable Blending??? hier oder doch mit custom layer??

    gl.useProgram(program);

    // Turn on the position attribute
    gl.enableVertexAttribArray(positionLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    const size = 2; // 2 components per iteration
    const type = gl.FLOAT; // the data is 32bit floats
    const normalize = false; // don't normalize the data
    const stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
    const offset = 0; // start at the beginning of the buffer
    gl.vertexAttribPointer(positionLocation, size, type, normalize, stride, offset);

    // Turn on the texcoord attribute
    gl.enableVertexAttribArray(texcoordLocation);

    // bind the texcoord buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

    gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

    // set the resolution
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

    // set which texture units to render with.
    gl.uniform1i(uImage0Location, 0); // texture unit 0
    gl.uniform1i(uImage1Location, 1); // texture unit 1

    // Set each texture unit to use a particular texture.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures[1]);

    /*
    const textureLoc = gl.getUniformLocation(program, "textures[0]");
    // Tell the shader to use texture units 0 to 3
    //gl.uniform1iv(textureLoc, [0, 1, 2, 3]); //uniform variable location and texture Index (or array of indices)
    gl.uniform1iv(textureLoc, [0, 1]);

    // set the resolution (needs to be set after useProgram !!)
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

    for (let index = 0; index < textureLayers.length; index++) {
      const texture = textureLayers[index];

      gl.activeTexture(gl.TEXTURE0 + index);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);

      // Set the parameters so we can render any size image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      // use canvas to get the pixel data array of the image
      const canvas = document.createElement("canvas");
      canvas.width = texture.width;
      canvas.height = texture.width;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(texture, 0, 0);
      const imageData = ctx?.getImageData(0, 0, texture.width, texture.height);
      if (!imageData) {
        throw new Error("Error");
      }
      const pixels = new Uint8Array(imageData.data.buffer);

      //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    
      // Upload the image into the texture.
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        //1, //width
        //1, //height
        //0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        texture
        //new Uint8Array(color)
      );
    }
    */

    gl.drawArrays(gl.TRIANGLES, 0, 6 /*positions.length / 2*/);

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
  }

  overlay.allTextures.forEach((image) => {
    //console.log(image.src); //!im moment gehts
    //addImageOverlay(image);
    /*
    const bounds = map.getBounds();
    const viewportBounds = [
      bounds.getNorthWest().toArray(),
      bounds.getNorthEast().toArray(),
      bounds.getSouthEast().toArray(),
      bounds.getSouthWest().toArray(),
    ];

    map.addSource("canvasSource", {
      type: "image",
      coordinates: viewportBounds,
      url: image.src,
    });
    //TODO save this source in the class and only use updateImage(options: ImageSourceOptions): this;
    // to update the image instead of rerendering the whole source

    map.addLayer({
      id: "overlay",
      source: "canvasSource",
      type: "raster",
      paint: {
        "raster-opacity": 0.85,
        //"raster-resampling": "linear",
      },
    });
    */
  });

  /*
  // init data and setup a webgl program
  Benchmark.startMeasure("init webgl");
  const canvas = await overlay.initWebgl(data);
  Benchmark.stopMeasure("init webgl");

  //addCanvasOverlay(canvas);
  //allCanvases.push(canvas);

  for (const c of overlay.allCanvases) {
    console.log(c);
    const img = new Image();
    img.src = c.toDataURL();
    await new Promise((resolve, reject) => {
      img.onload = () => {
        console.log("in onload");
        allTextures.push(img);
        resolve();
      };
      img.onerror = () => reject();
    });
  }

  allTextures.forEach((image) => {
    console.log(image.src);
  });
  */

  //TODO call drawTexture for every layer
  /*
  for (let index = 0; index < allTextures.length; index++) {
      const texture = allTextures[index];
      
  }*/

  /*
  // create a texture and render it to a hidden canvas
  Benchmark.startMeasure("create texture");
  const textureCanvas = overlay.createOverlayLayer();
  Benchmark.stopMeasure("create texture");

  const img = new Image();
  img.src = textureCanvas.toDataURL();
  console.log(img.src); // um bild anzuschauen copy paste in adress bar in browser

  img.onload = (): void => {
    img.width = textureCanvas.clientWidth; //use clientWidth and Height so the image fits the current screen size
    img.height = textureCanvas.clientHeight;
    console.log(img.src);
  };
  */

  const resultCanvas = overlay.combineOverlays(overlay.allTextures);
  console.log("ResultCanvas: ", resultCanvas);
  const img = new Image();
  img.onload = () => {
    console.log("in onload: ", img.src);
    addCanvasOverlay(resultCanvas);
  };
  img.src = resultCanvas.toDataURL();

  Benchmark.stopMeasure("creating overlay");
  return overlay;
}
