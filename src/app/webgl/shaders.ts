/**
 * * in WebGL 2: (see https://webgl2fundamentals.org/webgl/lessons/webgl1-to-webgl2.html for more information)
 * * varying becomes out in fragment shader and in in vertexShader
 * * attribute is replaced by in
 * * gl_Fragcolor is not set anymore, instead use out for color in fragment shader
 * * uniforms can now be set in vao and therefore it is not needed at rendertime time to get them -> performance boost over webgl1
 */

// Source: https://webgl2fundamentals.org/webgl/lessons/webgl-fundamentals.html
// The source was slightly modified to be able to work for images.
export function defaultVertexShader(): string {
  return `
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

      // flip the clip space y coordinate by multiplying with (1, -1) so the point (0, 0) is the top-left corner
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

      // pass the texCoord to the fragment shader
      // The GPU will interpolate this value between points.
      v_texCoord = a_texCoord;
  }
`;
}

export function combineOverlayFragmentShader(): string {
  //* this shader has to be written in webgl 1 because webgl 2 doesn't allow dynamic access in a for loop!
  return `
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

      //if(gl_FragColor.a == 0.0) discard;    // discard pixels with 100% transparency
  }
`;
}

export function getVSForGaussBlur(): string {
  return `
  precision mediump float;

  attribute vec3 coordinate;
  attribute vec2 textureCoordinate;

  varying vec2 varyingTextureCoordinate;

  void main(void) {
    gl_Position = vec4(coordinate, 1.0);

    varyingTextureCoordinate = textureCoordinate;
  }
  `;
}

//* 2D gaussian blur fragment shader:
//* original code taken from  http://pieper.github.io/sites/glimp/gaussian.html
//! The for loop should be unrolled for better performance!
export function getGaussianBlurFS(): string {
  return `
  precision mediump float;

  // Gaussian filter.  Based on https://www.shadertoy.com/view/4dfGDH#
  #define SIGMA 10.0
  
  
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

/*
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
//! not used at the moment
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
*/

/*
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
*/
