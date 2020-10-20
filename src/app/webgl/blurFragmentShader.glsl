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
    
    // randomize the lookup values to hide the fixed number of samples
    float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);
    
    for (float t = -30.0; t <= 30.0; t++) {
        float percent = (t + offset - 0.5) / 30.0;
        float weight = 1.0 - abs(percent);
        vec4 sample = texture2D(u_texture, v_tpos + delta * percent);
        
        // switch to pre-multiplied alpha to correctly blur transparent images
        sample.rgb *= sample.a;
        
        color += sample * weight;
        total += weight;
    }
    
    gl_FragColor = color / total;
    
    // switch back from pre-multiplied alpha
    gl_FragColor.rgb /= gl_FragColor.a + 0.00001;
}

// TODO use this? should be quite fast
// automatically generated by GenerateGaussFunctionCode in GaussianBlur.h   
// see https://software.intel.com/content/www/us/en/develop/blogs/an-investigation-of-fast-real-time-gpu-based-image-blur-algorithms.html                                                                                         
vec3 GaussianBlur( sampler2D tex0, vec2 centreUV, vec2 halfPixelOffset, vec2 pixelOffset )                                                                           
{                                                                                                                                                                    
    vec3 colOut = vec3( 0, 0, 0 );                                                                                                                                   
                                                                                                                                                                     
    ////////////////////////////////////////////////;
    // Kernel width 7 x 7
    //
    const int stepCount = 2;
    //
    const float gWeights[stepCount] ={
       0.44908,
       0.05092
    };
    const float gOffsets[stepCount] ={
       0.53805,
       2.06278
    };
    ////////////////////////////////////////////////;

    for( int i = 0; i < stepCount; i++ )                                                                                                                             
    {                                                                                                                                                                
        vec2 texCoordOffset = gOffsets[i] * pixelOffset;                                                                                                           
        vec3 col = texture( tex0, centreUV + texCoordOffset ).xyz + 
                   texture( tex0, centreUV – texCoordOffset ).xyz;                                                
        colOut += gWeights[i] * col;                                                                                                                               
    }                                                                                                                                                                

    return colOut;
}  

//TODO oder den? vertical blurren 
//TODO hardcoded image resolution should be changed!!
uniform sampler2D image;

out vec4 FragmentColor;

uniform float offset[3] = float[]( 0.0, 1.3846153846, 3.2307692308 );
uniform float weight[3] = float[]( 0.2270270270, 0.3162162162, 0.0702702703 );

void main(void)
{
	FragmentColor = texture2D( image, vec2(gl_FragCoord)/1024.0 ) * weight[0];
	for (int i=1; i<3; i++) {
		FragmentColor += texture2D( image, ( vec2(gl_FragCoord)+vec2(0.0, offset[i]) )/1024.0 ) * weight[i];
		FragmentColor += texture2D( image, ( vec2(gl_FragCoord)-vec2(0.0, offset[i]) )/1024.0 ) * weight[i];
	}
}