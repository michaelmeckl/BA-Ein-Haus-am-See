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
}