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
    // Integration change (Nemoverse): octaves 6..8 removed — the veil. At
    // 64x..256x downsample these three are frame-wide: they deposit the disc's
    // average HDR brightness on every pixel of the canvas (a uniform blanket
    // that, after the x200 gain and pow(0.7/2.2) lift, reads as a faint box
    // the size of the canvas). Octaves 1..5 carry the black hole's actual
    // glow; the object's render is unchanged (the removed term was a
    // near-constant additive worth <1% post-tonemap on bright pixels).
    // Donor lines retained below, commented, for exact provenance:
    // bloom += Grab(coord, 6.0, vec2(CalcOffset(5.0))) * 1.0;
    // bloom += Grab(coord, 7.0, vec2(CalcOffset(6.0))) * 1.0;
    // bloom += Grab(coord, 8.0, vec2(CalcOffset(7.0))) * 1.0;

	return bloom;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    vec2 uv = fragCoord.xy / iResolution.xy;
    
    vec3 color = ColorFetch(uv);
    
    
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

    // Integration change (Nemoverse): key the canvas's empty space to
    // transparent so the site backdrop (void + starfield) shows through. With
    // the frame-wide veil octaves removed above, empty space in this pass is
    // exactly (0,0,0) — the base raymarch has no sky term and octaves 1..5 are
    // local to the glow — so a soft knee on the final display-referred color
    // is an exact separation: pure black -> alpha 0, every rendered pixel of
    // the black hole above the knee (disc, lensed ring, glow) -> alpha 1.0,
    // byte-identical color. The key is taken AFTER the entrance ramp so the
    // frame also fades in from transparent rather than from a black flash.
    float canvasAlpha = smoothstep(0.0, 0.04, max(color.r, max(color.g, color.b)));

    fragColor = vec4(color, canvasAlpha);

}
