import { FRAGMENT_SHADER, VERTEX_SHADER } from "@luma.gl/constants";
import { type } from "os";

/**
 * Create a GLSL source for the vertex shader.
 */
export function createVertexShaderSource(): string {
  const vertexSource = `
      uniform mat4 u_matrix;
      attribute vec2 a_pos;

      void main() {
          gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
      }
      `;

  return vertexSource;
}

/**
 * Create a GLSL source for the fragment shader.
 */
export function createFragmentShaderSource(): string {
  const fragmentSource = `
      precision highp float;

      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 0.5);
      }
      `;

  return fragmentSource;
}

export function defaultLumaShaders(): any {
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

  return { vertexSource, fragmentSource };
}

// see https://www.shadertoy.com/view/MdyBzG
export function applyKawaseBlurFilter() {
  //TODO hier wird webgl 2 verwendet -> umschreiben
  const source = `
  void mainImage( out vec4 fragColor, in vec2 fragCoord )
  {
      vec2 uv = fragCoord / iResolution.xy;
      vec2 res = iChannelResolution[0].xy;
    
      float i = 5.5;
      
      vec3 col = texture( iChannel0, uv + vec2( i, i ) / res ).rgb;
      col += texture( iChannel0, uv + vec2( i, -i ) / res ).rgb;
      col += texture( iChannel0, uv + vec2( -i, i ) / res ).rgb;
      col += texture( iChannel0, uv + vec2( -i, -i ) / res ).rgb;
      col /= 4.0;
  
      fragColor = vec4( col, 1.0 );
  }`;

  return source;
}

/**
 * * This multiplies two canvases:
 * call this like:
   function updateTextureFromCanvas(tex, canvas, textureUnit) {
      gl.activeTexture(gl.TEXTURE0 + textureUnit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    }

    var tex1 = setupTexture(canvas1, 0, program, "u_canvas1");
    var tex2 = setupTexture(canvas2, 1, program, "u_canvas2");
 */
export function multiplyCanvasFragmentShader() {
  return `
  precision mediump float;

  // our 2 canvases
  uniform sampler2D u_canvas1;
  uniform sampler2D u_canvas2;

  // the texCoords passed in from the vertex shader.
  // note: we're only using 1 set of texCoords which means
  //   we're assuming the canvases are the same size.
  varying vec2 v_texCoord;

  void main() {
      // Look up a pixel from first canvas
      vec4 color1 = texture2D(u_canvas1, v_texCoord);

      // Look up a pixel from second canvas
      vec4 color2 = texture2D(u_canvas2, v_texCoord);

      // return the 2 colors multiplied
      gl_FragColor = color1 * color2;
  }
  `;
}

export function vertexShaderCanvas(): string {
  return `
    // an attribute will receive data from a buffer
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
 
    uniform vec2 u_resolution;

    varying vec2 v_texCoord;
  
    void main() {
      // convert the position from pixels to 0.0 to 1.0
      vec2 zeroToOne = a_position / u_resolution;
  
      // convert from 0->1 to 0->2
      vec2 zeroToTwo = zeroToOne * 2.0;
  
      // convert from 0->2 to -1->+1 (clip space)
      vec2 clipSpace = zeroToTwo - 1.0;
    
      // sets the top left corner to (0, 0)
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

      // pass the texCoord to the fragment shader
      // The GPU will interpolate this value between points
      v_texCoord = a_texCoord;
    }
  `;
}

//blur für canvas
export function fragmentShaderCanvas(): string {
  return `
    precision mediump float;
 
    // our texture
    uniform sampler2D u_image;
    uniform vec2 u_textureSize;
    uniform float u_kernel[9];
    uniform float u_kernelWeight;
    
    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;
    
    void main() {
      // compute 1 pixel in texture coordinates.
      vec2 onePixel = vec2(1.0, 1.0) / u_textureSize;

      // sum up all 8 neigboring pixel values
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

      gl_FragColor = vec4((colorSum / u_kernelWeight).rgb, 1);
      //gl_FragColor = vec4(1,0,0,1);
    }
  `;
}

//TODO Blur - Filter
export function createBlurFragmentSource(): string {
  const blurSource = `
    precision highp float;
    uniform sampler2D u_texture;
    uniform vec2 delta;
    varying vec2 v_tpos;
    float random(vec3 scale, float seed) {
        /* use the fragment position for a different seed per-pixel */
        return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);
    }
    void main() {
        vec4 color = vec4(0.0);
        float total = 0.0;
        
        /* randomize the lookup values to hide the fixed number of samples */
        float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);
        
        for (float t = -30.0; t <= 30.0; t++) {
            float percent = (t + offset - 0.5) / 30.0;
            float weight = 1.0 - abs(percent);
            vec4 sample = texture2D(u_texture, v_tpos + delta * percent);
            
            /* switch to pre-multiplied alpha to correctly blur transparent images */
            sample.rgb *= sample.a;
            
            color += sample * weight;
            total += weight;
        }
        
        gl_FragColor = color / total;
        
        /* switch back from pre-multiplied alpha */
        gl_FragColor.rgb /= gl_FragColor.a + 0.00001;
    }`;

  const fragmentSourceAlternativ = `
    uniform sampler2D texUnit;
    uniform float[9] conMatrix;
    uniform float conWeight;
    uniform vec2 conPixel;

    void main(void)
    {
        vec4 color = vec4(0.0);
        vec2 texCoord = gl_TexCoord[0].st;
        vec2 offset = conPixel * 1.5;
        vec2 start = texCoord - offset;
        vec2 current = start;

        for (int i = 0; i < 9; i++)
        {
            color += texture2D( texUnit, current ) * conMatrix[i]; 

            current.x += conPixel.x;
            if (i == 2 || i == 5) {
                current.x = start.x;
                current.y += conPixel.y; 
            }
        }

        gl_FragColor = color * conWeight;
    }`;

  return blurSource;
}

export function getBlurFilterKernel(name = "gaussianBlur"): number[] {
  // prettier-ignore
  const kernels = {
    // Define several convolution kernels
    gaussianBlur: [
      0.045, 0.122, 0.045,
      0.122, 0.332, 0.122,
      0.045, 0.122, 0.045,
    ],
    gaussianBlur2: [
      1, 2, 1,
      2, 4, 2,
      1, 2, 1,
    ],
    gaussianBlur3: [
      0, 1, 0,
      1, 1, 1,
      0, 1, 0,
    ],
    boxBlur: [
        0.111, 0.111, 0.111,
        0.111, 0.111, 0.111,
        0.111, 0.111, 0.111,
    ],
    triangleBlur: [
        0.0625, 0.125, 0.0625,
        0.125, 0.25, 0.125,
        0.0625, 0.125, 0.0625,
    ],
  };

  switch (name) {
    case "gaussianBlur2":
      return kernels.gaussianBlur2;
    case "gaussianBlur3":
      return kernels.gaussianBlur3;
    case "boxBlur":
      return kernels.boxBlur;
    case "triangleBlur":
      return kernels.triangleBlur;
    case "gaussianBlur":
    default:
      return kernels.gaussianBlur;
  }
}

export function computeKernelWeight(kernel: number[]): number {
  const weight = kernel.reduce(function (prev: number, curr: number) {
    return prev + curr;
  });
  return weight <= 0 ? 1 : weight;
}

export function bindFramebufferAndSetViewport(
  gl: WebGLRenderingContext,
  fb: WebGLFramebuffer | null,
  width: number,
  height: number
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.viewport(0, 0, width, height);
}

export function createProgramInfo(
  gl: WebGLRenderingContext,
  shaderProgram: WebGLProgram,
  attribs?: any[],
  uniforms?: any[]
): any {
  //TODO extract attributes and uniforms automatically and push them to the object:
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
    },
  };

  return programInfo;
}

type shaderType = WebGLRenderingContext["VERTEX_SHADER"] | WebGLRenderingContext["FRAGMENT_SHADER"];

// see. https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
export function createShader(
  gl: WebGLRenderingContext,
  type: shaderType,
  source: string
): WebGLShader {
  // Create the shader object
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Couldn't create shader!");
  }
  // Set the shader source code.
  gl.shaderSource(shader, source);
  // Compile the shader
  gl.compileShader(shader);
  // Check if it compiled successfully
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
  }

  return shader;
}

/**
 * Initialize a shader program, so WebGL knows how to draw the data.
 * see. https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
 */
export function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Couldn't create program!");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  // check if creating the program was successfull
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
  }

  return program;
}

// see. https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
/**
 * Usage just before rendering:
 *    resize(gl.canvas);
 *    // Tell WebGL how to convert from clip space to pixels
 *    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
 */
export function resizeCanvas(canvas: HTMLCanvasElement): void {
  // Lookup the size the browser is displaying the canvas.
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  // Check if the canvas is not the same size.
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    // Make the canvas the same size
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}

function resetDepth(gl: WebGLRenderingContext): void {
  gl.clearDepth(1.0); // Clear depth
  gl.enable(gl.DEPTH_TEST); // Enable depth testing
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things
}

/**
 * Clear the canvas and reset depth.
 */
export function clearCanvas(gl: WebGLRenderingContext): void {
  gl.clearColor(0, 0, 0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

//* Kombination of the two methods above
function resetCanvas(gl: WebGLRenderingContext): void {
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
  gl.clearDepth(1.0); // Clear everything
  gl.enable(gl.DEPTH_TEST); // Enable depth testing
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things

  // Clear the canvas before we start drawing on it.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

//TODO delete me later
// simple function that sets a color to a gl context, can be usefult for troubleshooting
export function setColor(gl: WebGLRenderingContext) {
  gl.clearColor(1, 0, 1, 1); // magenta
  gl.clear(gl.COLOR_BUFFER_BIT);
}
