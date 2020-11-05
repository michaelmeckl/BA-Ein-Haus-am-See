/**
 * * in WebGL 2: (see https://webgl2fundamentals.org/webgl/lessons/webgl1-to-webgl2.html for more information)
 * * varying becomes out in fragment shader and in in vertexShader
 * * attribute is replaced by in
 * * gl_Fragcolor is not set anymore, instead use out for color in fragment shader
 * * uniforms can now be set in vao and therefore it is not needed at rendertime time to get them -> performance boost over webgl1
 */

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

export function gaussianVertexShaderCanvas(): string {
  return `
  precision mediump float;

  attribute vec3 coordinate;
  attribute vec2 textureCoordinate;

  varying vec2 v_texCoord;

  void main(void) {
    gl_Position = vec4(coordinate, 1.0);

    v_texCoord = textureCoordinate;
  }
  `;
}

//blur für canvas
export function blurFragmentShaderCanvas(): string {
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
      }
    `;
}

//* Dilate Fragment Shader: (only for reference, not used)
// see. http://pieper.github.io/sites/glimp/dilate.html
export function getDilateFS(): string {
  return `
  precision highp float;

  uniform sampler2D sourceTextureSampler;
  uniform vec2 sourceTextureSize;
  uniform vec2 sourceTexelSize;

  varying vec2 varyingTextureCoordinate;

  void main(void) {
    vec4 c = texture2D(sourceTextureSampler, varyingTextureCoordinate);
    vec4 dc = c;

    vec3 cc;
    //read out the texels
    for (int i=-1; i <= 1; ++i)
    {
      for (int j=-1; j <= 1; ++j)
      {
        
        // color at pixel in the neighborhood
        vec2 coord = varyingTextureCoordinate.xy + vec2(float(i), float(j)) * sourceTexelSize.xy;
        cc = texture2D(sourceTextureSampler, coord).rgb;

        // dilate = max, erode = min
        dc.rgb = max(cc.rgb, dc.rgb);
      }
    }

    gl_FragColor = dc;
  }
  `;
}

export function gaussianBlurVertexShader(): string {
  return `#version 300 es

  precision mediump float;

  in vec3 coordinate;
  in vec2 textureCoordinate;

  out vec2 texCoord;

  void main(void) {
    gl_Position = vec4(coordinate, 1.0);

    texCoord = textureCoordinate;
  }
  `;
}

//* needs webgl 2 or the textureLOD extension for webgl 1 (https://developer.mozilla.org/en-US/docs/Web/API/EXT_shader_texture_lod)
// see https://www.shadertoy.com/view/ltScRG
export function gaussianBlurFragmentShader(): string {
  return `#version 300 es

  precision mediump float;

  uniform sampler2D sourceTextureSampler;
  uniform vec2 textureResolution;
  uniform vec2 canvasResolution;
  
  in vec2 texCoord;

  out vec4 fragColor;

  const int samples = 35,
          LOD = 2,         // gaussian done on MIPmap at scale LOD
          sLOD = 1 << LOD; // tile size = 2^LOD
  const float sigma = float(samples) * 0.25;

  float gaussian(vec2 i) {
      return exp( -0.5* dot(i/=sigma,i) ) / ( 6.28 * sigma*sigma );
  }

  vec4 blur(sampler2D samplerTexture, vec2 uvCoord, vec2 scale) {
      vec4 outputColor = vec4(0.0);  
      int s = samples/sLOD;
      
      for ( int i = 0; i < s*s; i++ ) {
          vec2 d = vec2(i%s, i/s)*float(sLOD) - float(samples)/2.0;
          outputColor += gaussian(d) * textureLod( samplerTexture, uvCoord + scale * d , float(LOD) );
      }
      
      return outputColor ;
  }

  void main(void) {
      fragColor = blur(sourceTextureSampler, texCoord.xy/canvasResolution.xy, 1.0/textureResolution.xy );
  }
  `;
}

//! IMPORTANT: j in the shader below is the distance value!! -> set j to size of the buffer around the polygons!
//* 2D gaussian blur fs:
// see. http://pieper.github.io/sites/glimp/gaussian.html
export function getGaussianBlurFS(): string {
  return `
  precision mediump float;

  // Gaussian filter.  Based on https://www.shadertoy.com/view/4dfGDH#
  #define SIGMA 10.0
  #define MSIZE 30  // Blur strength overall
  
  
  // gaussian distribution (the blur effect decreases fast the more we get away from the center)
  float normpdf(in float x, in float sigma)
  {
    return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;
  }
  
  uniform sampler2D sourceTextureSampler;
  uniform vec2 sourceTextureSize;
  uniform vec2 sourceTexelSize;
  
  varying vec2 varyingTextureCoordinate;
  
  void main(void) {
    vec4 c = texture2D(sourceTextureSampler, varyingTextureCoordinate);
    vec4 gc = c;
    vec4 bc = c;

    
    //declare stuff
    const int kSize = (MSIZE-1)/2;  // kernel size
    float kernel[MSIZE];
    vec3 gfinal_colour = vec3(0.0);

    float gZ = 0.0;

    //create the 1-D kernel (convolution kernel, looks like [0.0, 0.3, 0.5, 1.0, 0.5, 0.3, 0.0])
    // in the middle (which is where the current pixel is) the blur has the highest effect and rapidly decreases to the edges
    for (int j = 0; j <= kSize; ++j) {
      kernel[kSize+j] = kernel[kSize-j] = normpdf(float(j), SIGMA);
    }

    // to improve the performance the kernel could also be precomputed:
    //const float kernel[MSIZE] = float[MSIZE]( 0.031225216, 0.033322271, 0.035206333, 0.036826804, 0.038138565, 0.039104044, 0.039695028, 0.039894000, 0.039695028, 0.039104044, 0.038138565, 0.036826804, 0.035206333, 0.033322271, 0.031225216);

    vec3 cc;
    float gfactor;
    //read out the texels
    for (int i=-kSize; i <= kSize; ++i) // from the most left element of the kernel to the one on the right
    {
      for (int j=-kSize; j <= kSize; ++j)
      {
        // varyingTextureCoordinate.xy is the current pixel + the distance i,j from this pixel * pixelSize 
        // (to work with different resolutions, e.g. when zooming in)

        // color at pixel in the neighborhood
        vec2 coord = varyingTextureCoordinate.xy + vec2(float(i), float(j)) * sourceTexelSize.xy;
        cc = texture2D(sourceTextureSampler, coord).rgb;

        // compute the gaussian smoothed (multiply both so the blur effect decreases faster, see x*x 
        // in the gaussian distribution equation above)
        gfactor = kernel[kSize+j]*kernel[kSize+i];

        // add up all weight factors so we can normalize at the end!
        gZ += gfactor;

        // the final color is the current texel cc * the blur weight
        gfinal_colour += gfactor*cc;
      }
    }

    // normalize the final rgb color by dividing by the overall weight
    gc = vec4(gfinal_colour/gZ, 1.0);

    c = gc;
      
    gl_FragColor = c;
  }
  `;
}

//* shared vs for the both filters above
export function getVSForDilateAndGaussBlur(): string {
  return `
  precision highp float;

  attribute vec3 coordinate;
  attribute vec2 textureCoordinate;

  varying vec2 varyingTextureCoordinate;

  void main(void) {
    gl_Position = vec4(coordinate, 1.0);

    varyingTextureCoordinate = textureCoordinate;
  }
  `;
}

/**
 * * Example of an unrolled blur filter (for better performance):
 *  see https://github.com/GoogleChromeLabs/snapshot/blob/master/src/filters/filter-fragment-shader.glsl
 */
function unrolledBlur(): string {
  return `
  precision highp float;

  varying vec2 texCoords;

  uniform sampler2D textureSampler;
  uniform vec2 sourceSize;
  uniform float blur;

  varying vec2 texCoords;

  void main() {
    vec2 off = sourceSize * blur;
    vec2 off2 = off * 2.0;
  
    // Why isn't this a loop? Some graphics chips can get be very slow if they
    // can't tell at compile time which texture reads are needed
    vec4 tex00 = texture2D(textureSampler, texCoords + vec2(-off2.x, -off2.y));
    vec4 tex10 = texture2D(textureSampler, texCoords + vec2(-off.x, -off2.y));
    vec4 tex20 = texture2D(textureSampler, texCoords + vec2(0.0, -off2.y));
    vec4 tex30 = texture2D(textureSampler, texCoords + vec2(off.x, -off2.y));
    vec4 tex40 = texture2D(textureSampler, texCoords + vec2(off2.x, -off2.y));
  
    vec4 tex01 = texture2D(textureSampler, texCoords + vec2(-off2.x, -off.y));
    vec4 tex11 = texture2D(textureSampler, texCoords + vec2(-off.x, -off.y));
    vec4 tex21 = texture2D(textureSampler, texCoords + vec2(0.0, -off.y));
    vec4 tex31 = texture2D(textureSampler, texCoords + vec2(off.x, -off.y));
    vec4 tex41 = texture2D(textureSampler, texCoords + vec2(off2.x, -off.y));
  
    vec4 tex02 = texture2D(textureSampler, texCoords + vec2(-off2.x, 0.0));
    vec4 tex12 = texture2D(textureSampler, texCoords + vec2(-off.x, 0.0));
    vec4 tex22 = texture2D(textureSampler, texCoords + vec2(0.0, 0.0));
    vec4 tex32 = texture2D(textureSampler, texCoords + vec2(off.x, 0.0));
    vec4 tex42 = texture2D(textureSampler, texCoords + vec2(off2.x, 0.0));
  
    vec4 tex03 = texture2D(textureSampler, texCoords + vec2(-off2.x, off.y));
    vec4 tex13 = texture2D(textureSampler, texCoords + vec2(-off.x, off.y));
    vec4 tex23 = texture2D(textureSampler, texCoords + vec2(0.0, off.y));
    vec4 tex33 = texture2D(textureSampler, texCoords + vec2(off.x, off.y));
    vec4 tex43 = texture2D(textureSampler, texCoords + vec2(off2.x, off.y));
  
    vec4 tex04 = texture2D(textureSampler, texCoords + vec2(-off2.x, off2.y));
    vec4 tex14 = texture2D(textureSampler, texCoords + vec2(-off.x, off2.y));
    vec4 tex24 = texture2D(textureSampler, texCoords + vec2(0.0, off2.y));
    vec4 tex34 = texture2D(textureSampler, texCoords + vec2(off.x, off2.y));
    vec4 tex44 = texture2D(textureSampler, texCoords + vec2(off2.x, off2.y));
  
    vec4 tex = tex22;
  
    // Blur
    vec4 blurred = 1.0 * tex00 + 4.0 * tex10 + 6.0 * tex20 + 4.0 * tex30 + 1.0 * tex40
                 + 4.0 * tex01 + 16.0 * tex11 + 24.0 * tex21 + 16.0 * tex31 + 4.0 * tex41
                 + 6.0 * tex02 + 24.0 * tex12 + 36.0 * tex22 + 24.0 * tex32 + 6.0 * tex42
                 + 4.0 * tex03 + 16.0 * tex13 + 24.0 * tex23 + 16.0 * tex33 + 4.0 * tex43
                 + 1.0 * tex04 + 4.0 * tex14 + 6.0 * tex24 + 4.0 * tex34 + 1.0 * tex44;
    blurred /= 256.0;
  
    tex += (tex - blurred);

    gl_FragColor = tex;
  `;
}
