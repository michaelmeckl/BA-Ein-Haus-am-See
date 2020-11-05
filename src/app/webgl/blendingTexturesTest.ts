// see https://webgl2fundamentals.org/webgl/lessons/webgl-2-textures.html

//* vgl shadertoy 

// Convert to normalized pixel coordinates (from 0 to 1)
vec2 toUV(vec2 coords) {
    return coords.xy / iResolution.xy;
}

vec3 blur1(vec2 uv, vec2 res) {
    //offset to use (don't use the source pixel itself)
    float i = 5.0;
    
    // get color from texture
    vec3 col = texture( iChannel1, uv + vec2( i, i ) / res ).rgb;
    col += texture( iChannel1, uv + vec2( i, -i ) / res ).rgb;
    col += texture( iChannel1, uv + vec2( -i, i ) / res ).rgb;
    col += texture( iChannel1, uv + vec2( -i, -i ) / res ).rgb;
    col /= 4.0;
    
    return col;
}

vec3 blur2(vec2 uv, vec2 res) {
    //offset to use (don't use the source pixel itself)
    float i = 5.0;
    
    // get color from texture
    vec3 col = texture( iChannel2, uv + vec2( i, i ) / res ).rgb;
    col += texture( iChannel2, uv + vec2( i, -i ) / res ).rgb;
    col += texture( iChannel2, uv + vec2( -i, i ) / res ).rgb;
    col += texture( iChannel2, uv + vec2( -i, -i ) / res ).rgb;
    col /= 4.0;
    
    return col;
}

//TODO: vorher müssten alle Polygone in Webgl erstmal separat in versch. Texturen 
// gerendert werden (vllt am besten unabhängig vom CustomLayer?)
// also alle Parks, alle Supermärkte, etc.
// diese Texturen wären dann die Eingaben für diesen Shader!

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = toUV(fragCoord);
    vec2 res = iChannelResolution[0].xy;

    vec3 col1 = blur1(uv, res);
    vec3 col2 = blur2(uv, res);
    
    /*
	// multiply
    vec4 texel = texture(iChannel0, uv);
    texel *= texture(iChannel3, uv);
	*/
    
    vec4 texel0 = texture(iChannel2, uv);
    vec4 texel1 = texture(iChannel3, uv);
    vec4 texel2 = texture(iChannel1, uv);
    
    // mix both overlays with 50% each:
    vec4 mixRes1 = mix(texel0, texel2, 0.5);
    // take 60% of the map and 40% of the maskResult
    vec4 mask = mix(texel1, mixRes1, 0.4);
    
    // add the blur for both overlays; TODO doesnt work right now!
    //mask += vec4(col1, 1.0);
    //mask += vec4(col2, 1.0);
    
    //TODO die intersections sollten noch gehighlighted werden! vllt in einem 
    // einzigen Frag Shader gar nicht möglich? stattdessen mehrere Iterationen und Blending?

    fragColor = mask;
}

