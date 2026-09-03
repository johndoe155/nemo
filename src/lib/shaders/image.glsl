// Composite + tonemap. Applies a one-time entrance ramp (uEntrance, 0 -> 1)
// to the final composite; locked at 1.0 afterwards so brightness never loops.

vec3 saturate(vec3 x)
{
    return clamp(x, vec3(0.0), vec3(1.0));
}

vec4 cubic(float x)
{
    float x2 = x * x;
    float x3 = x2 * x;
    vec4 w;
    w.x =   -x3 + 3.0*x2 - 3.0*x + 1.0;
    w.y =  3.0*x3 - 6.0*x2       + 4.0;
    w.z = -3.0*x3 + 3.0*x2 + 3.0*x + 1.0;
    w.w =  x3;
    return w / 6.0;
}

vec4 BicubicTexture(in sampler2D tex, in vec2 coord)
{
	vec2 resolution = iResolution.xy;

	coord *= resolution;

	float fx = fract(coord.x);
    float fy = fract(coord.y);
    coord.x -= fx;
    coord.y -= fy;

    fx -= 0.5;
    fy -= 0.5;

    vec4 xcubic = cubic(fx);
    vec4 ycubic = cubic(fy);

    vec4 c = vec4(coord.x - 0.5, coord.x + 1.5, coord.y - 0.5, coord.y + 1.5);
    vec4 s = vec4(xcubic.x + xcubic.y, xcubic.z + xcubic.w, ycubic.x + ycubic.y, ycubic.z + ycubic.w);
    vec4 offset = c + vec4(xcubic.y, xcubic.w, ycubic.y, ycubic.w) / s;

    vec4 sample0 = texture(tex, vec2(offset.x, offset.z) / resolution);
    vec4 sample1 = texture(tex, vec2(offset.y, offset.z) / resolution);
    vec4 sample2 = texture(tex, vec2(offset.x, offset.w) / resolution);
    vec4 sample3 = texture(tex, vec2(offset.y, offset.w) / resolution);

    float sx = s.x / (s.x + s.y);
    float sy = s.z / (s.z + s.w);

    return mix( mix(sample3, sample2, sx), mix(sample1, sample0, sx), sy);
}

vec3 ColorFetch(vec2 coord)
{
 	return texture(iChannel0, coord).rgb;   
}

vec3 BloomFetch(vec2 coord)
{
 	return BicubicTexture(iChannel3, coord).rgb;   
}

vec3 Grab(vec2 coord, const float octave, const vec2 offset)
{
 	float scale = exp2(octave);
    
    coord /= scale;
    coord -= offset;

    return BloomFetch(coord);
}

vec2 CalcOffset(float octave)
{
    vec2 offset = vec2(0.0);
    
    vec2 padding = vec2(10.0) / iResolution.xy;
    
    offset.x = -min(1.0, floor(octave / 3.0)) * (0.25 + padding.x);
    
    offset.y = -(1.0 - (1.0 / exp2(octave))) - padding.y * octave;

	offset.y += min(1.0, floor(octave / 3.0)) * 0.35;
    
 	return offset;   
}

vec3 GetBloom(vec2 coord)
{
 	vec3 bloom = vec3(0.0);
    
    //Reconstruct bloom from multiple blurred images
    bloom += Grab(coord, 1.0, vec2(CalcOffset(0.0))) * 1.0;
    bloom += Grab(coord, 2.0, vec2(CalcOffset(1.0))) * 1.5;
	bloom += Grab(coord, 3.0, vec2(CalcOffset(2.0))) * 1.0;
    bloom += Grab(coord, 4.0, vec2(CalcOffset(3.0))) * 1.5;
    bloom += Grab(coord, 5.0, vec2(CalcOffset(4.0))) * 1.8;
    bloom += Grab(coord, 6.0, vec2(CalcOffset(5.0))) * 1.0;
    bloom += Grab(coord, 7.0, vec2(CalcOffset(6.0))) * 1.0;
    bloom += Grab(coord, 8.0, vec2(CalcOffset(7.0))) * 1.0;

	return bloom;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    vec2 uv = fragCoord.xy / iResolution.xy;
    
    // Integration change (Nemoverse): keep the pre-bloom base accessible —
    // below, the canvas alpha is keyed to the raymarched OBJECT footprint
    // (this value), not to the post-bloom brightness.
    vec3 base = ColorFetch(uv);
    vec3 color = base;
    
    
    color += GetBloom(uv) * 0.08;
    
    color *= 200.0;
    

    //Tonemapping and color grading
    color = pow(color, vec3(1.5));
    color = color / (1.0 + color);
    color = pow(color, vec3(1.0 / 1.5));

    
    color = mix(color, color * color * (3.0 - 2.0 * color), vec3(1.0));
    color = pow(color, vec3(1.3, 1.20, 1.0));    

	color = saturate(color * 1.01);
    
    color = pow(color, vec3(0.7 / 2.2));

    // One-time entrance ramp (see gargantuaRenderer.ts): uEntrance eases 0 -> 1
    // over the first moments after load and is then locked at 1.0 forever, so
    // the composite fades in once and never dims or resets again.
    color *= uEntrance;

    // Integration change (Nemoverse): composite ONLY the black hole over the
    // site backdrop. Brightness keying was tried twice and failed — the bloom
    // veil is frame-wide render content that tracks the object's brightness,
    // so any threshold on the final color leaves a box whose opacity follows
    // the shader. Instead the alpha is GEOMETRIC, from two multiplicative
    // terms:
    //   contentMatte — keyed on `base`, the pre-bloom raymarch output. The
    //     disc, lensed ring and their immediate glow sit far above the key;
    //     the bloom veil (added only later, in `color`) and any residual dust
    //     lie inside the dead-zone below 0.012 and key to exactly zero. The
    //     matte therefore follows the object's true footprint, never the
    //     rectangle.
    //   edgeFade — a feathered falloff to the canvas borders. The donor's
    //     disc band crosses the full frame width; without this it would be
    //     guillotined by the canvas edge (a hard box side). It dissolves
    //     instead, ~10% of width / ~8% of height.
    // Both are ramped by uEntrance so the object also fades IN from
    // transparent. Color channels of rendered pixels are donor-exact.
    float contentMatte = smoothstep(0.012, 0.06, max(base.r, max(base.g, base.b)));
    vec2 edge = min(uv, 1.0 - uv);
    float edgeFade = smoothstep(0.0, 0.10, edge.x) * smoothstep(0.0, 0.08, edge.y);
    float canvasAlpha = contentMatte * edgeFade * uEntrance;

    fragColor = vec4(color, canvasAlpha);

}
