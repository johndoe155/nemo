#ifdef MOBILE_QUALITY
#define ITERATIONS 160
#else
#define ITERATIONS 200
#endif
#define TEMPORAL_AA


const vec3 MainColor = vec3(1.0);

//noise code by iq
float noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
    vec2 rg = textureLod( iChannel0, (uv+ 0.5)/256.0, 0.0 ).yx;
    return -1.0+2.0*mix( rg.x, rg.y, f.z );
}

float saturate(float x)
{
    return clamp(x, 0.0, 1.0);
}

vec3 saturate(vec3 x)
{
    return clamp(x, vec3(0.0), vec3(1.0));
}

float rand(vec2 coord)
{
    return saturate(fract(sin(dot(coord, vec2(12.9898, 78.223))) * 43758.5453));
}

float pcurve( float x, float a, float b )
{
    float k = pow(a+b,a+b) / (pow(a,a)*pow(b,b));
    return k * pow( x, a ) * pow( 1.0-x, b );
}

const float pi = 3.14159265;

// Orbit pitch clamp: just short of +/-90 deg so the view never reaches a pole
// where yaw/roll would tangle. Initial yaw/pitch (reproducing the original
// look angle) live in gargantuaRenderer.ts.
const float ORBIT_PITCH_LIMIT = 1.427996660722633; // pi/2.2, ~81.82 deg

// Framing. FOCAL_LENGTH fixes the vertical FOV (half-angle atan(1/FOCAL));
// the horizontal FOV scales with aspect, so portrait crops the wide disc.
// Portrait (aspect < FIT_MAX_ASPECT) zooms out until the disc + glow
// (DISC_FIT_RADIUS) fits; desktop (aspect >= 1) zooms out by DESKTOP_FIT.
const float FOCAL_LENGTH = 6.0;
const float DISC_FIT_RADIUS = 6.75; // disc outer radius (~5.85) + glow margin
const float FIT_MAX_ASPECT = 1.0;
const float FIT_MIN_ASPECT = 0.5;
const float DESKTOP_FIT = 1.15;      // desktop zoom-out factor
const float DESKTOP_FIT_START = 1.0; // ramp start (square)
const float DESKTOP_FIT_END = 1.4;   // full zoom-out by ~1.4:1

float atan2(float y, float x)
{
    if (x > 0.0)
    {
        return atan(y / x);
    }
    else if (x == 0.0)
    {
        if (y > 0.0)
        {
            return pi / 2.0;
        }
        else if (y < 0.0)
        {
            return -(pi / 2.0);
        }
        else
        {
            return 0.0;
        }
    }
    else //(x < 0.0)
    {
        if (y >= 0.0)
        {
            return atan(y / x) + pi;
        }
        else
        {
            return atan(y / x) - pi;
        }
    }
}

float sdTorus(vec3 p, vec2 t)
{
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q)-t.y;
}

float sdSphere(vec3 p, float r)
{
  return length(p)-r;
}

void Haze(inout vec3 color, vec3 pos, float alpha)
{
    vec2 t = vec2(1.0, 0.01);

    float torusDist = length(sdTorus(pos + vec3(0.0, -0.05, 0.0), t));

    float bloomDisc = 1.0 / (pow(torusDist, 2.0) + 0.001);
    vec3 col = MainColor;
    bloomDisc *= length(pos) < 0.5 ? 0.0 : 1.0;

    color += col * bloomDisc * (2.9 / float(ITERATIONS)) * (1.0 - alpha * 1.0);
}

void GasDisc(inout vec3 color, inout float alpha, vec3 pos)
{
    float discRadius = 3.2;
    float discWidth = 5.3;
    float discInner = discRadius - discWidth * 0.5;
    float discOuter = discRadius + discWidth * 0.5;
    
    vec3 origin = vec3(0.0, 0.0, 0.0);
    float mouseZ = iMouse.y / iResolution.y;
    vec3 discNormal = normalize(vec3(0.0, 1.0, 0.0));
    float discThickness = 0.1;

    float distFromCenter = distance(pos, origin);
    float distFromDisc = dot(discNormal, pos - origin);
    
    float radialGradient = 1.0 - saturate((distFromCenter - discInner) / discWidth * 0.5);

    float coverage = pcurve(radialGradient, 4.0, 0.9);

    discThickness *= radialGradient;
    coverage *= saturate(1.0 - abs(distFromDisc) / discThickness);

    vec3 dustColorLit = MainColor;
    vec3 dustColorDark = vec3(0.0, 0.0, 0.0);

    float dustGlow = 1.0 / (pow(1.0 - radialGradient, 2.0) * 290.0 + 0.002);
    vec3 dustColor = dustColorLit * dustGlow * 8.2;

    coverage = saturate(coverage * 0.7);


    float fade = pow((abs(distFromCenter - discInner) + 0.4), 4.0) * 0.04;
    float bloomFactor = 1.0 / (pow(distFromDisc, 2.0) * 40.0 + fade + 0.00002);
    vec3 b = dustColorLit * pow(bloomFactor, 1.5);
    
    b *= mix(vec3(1.7, 1.1, 1.0), vec3(0.5, 0.6, 1.0), vec3(pow(radialGradient, 2.0)));
    b *= mix(vec3(1.7, 0.5, 0.1), vec3(1.0), vec3(pow(radialGradient, 0.5)));

    dustColor = mix(dustColor, b * 150.0, saturate(1.0 - coverage * 1.0));
    coverage = saturate(coverage + bloomFactor * bloomFactor * 0.1);
    
    if (coverage < 0.01)
    {
        return;   
    }
    
    
    vec3 radialCoords;
    radialCoords.x = distFromCenter * 1.5 + 0.55;
    radialCoords.y = atan2(-pos.x, -pos.z) * 1.5;
    radialCoords.z = distFromDisc * 1.5;

    radialCoords *= 0.95;
    
    float speed = 0.06;
    
    float noise1 = 1.0;
    vec3 rc = radialCoords + 0.0;               rc.y += iTime * speed;
    noise1 *= noise(rc * 3.0) * 0.5 + 0.5;      rc.y -= iTime * speed;
    noise1 *= noise(rc * 6.0) * 0.5 + 0.5;      rc.y += iTime * speed;
    noise1 *= noise(rc * 12.0) * 0.5 + 0.5;     rc.y -= iTime * speed;
    noise1 *= noise(rc * 24.0) * 0.5 + 0.5;     rc.y += iTime * speed;

    float noise2 = 2.0;
    rc = radialCoords + 30.0;
    noise2 *= noise(rc * 3.0) * 0.5 + 0.5;      rc.y += iTime * speed;
    noise2 *= noise(rc * 6.0) * 0.5 + 0.5;      rc.y -= iTime * speed;
    noise2 *= noise(rc * 12.0) * 0.5 + 0.5;     rc.y += iTime * speed;
    noise2 *= noise(rc * 24.0) * 0.5 + 0.5;     rc.y -= iTime * speed;
    noise2 *= noise(rc * 48.0) * 0.5 + 0.5;     rc.y += iTime * speed;
    noise2 *= noise(rc * 92.0) * 0.5 + 0.5;     rc.y -= iTime * speed;

    dustColor *= noise1 * 0.998 + 0.002;
    coverage *= noise2;
    
    radialCoords.y += iTime * speed * 0.5;
    
    dustColor *= pow(texture(iChannel1, radialCoords.yx * vec2(0.15, 0.27)).rgb, vec3(2.0)) * 4.0;

    coverage = saturate(coverage * 1200.0 / float(ITERATIONS));
    dustColor = max(vec3(0.0), dustColor);

    coverage *= pcurve(radialGradient, 4.0, 0.9);

    color = (1.0 - alpha) * dustColor * coverage + color;

    alpha = (1.0 - alpha) * coverage + alpha;
}



// The original rotate() (three fixed-order Euler matrices) is removed: composing
// absolute Euler angles tangles yaw/roll near the poles. OrbitCamera builds the
// basis directly from yaw/pitch instead — singularity-free within the clamp.
void OrbitCamera(inout vec3 eyevec, inout vec3 eyepos)
{
    // uCamera = (yaw, pitch, radius); yaw wraps continuously, pitch is clamped.
    float yaw = uCamera.x;
    float pitch = clamp(uCamera.y, -ORBIT_PITCH_LIMIT, ORBIT_PITCH_LIMIT);
    float radius = uCamera.z;

    float cy = cos(yaw);
    float sy = sin(yaw);
    float cp = cos(pitch);
    float sp = sin(pitch);

    // Position on the orbit sphere (pitch > 0 = eye above the equatorial plane).
    eyepos = vec3(radius * sy * cp,
                  radius * sp,
                  -radius * cy * cp);

    // Roll-free basis: "up" is constrained to the plane of +Y and the orbit
    // radial, so the horizon never rolls as yaw wraps.
    vec3 right   = vec3(cy, 0.0, sy);
    vec3 up      = vec3(-sy * sp, cp, cy * sp);
    vec3 forward = vec3(-sy * cp, -sp, cy * cp);

    eyevec = eyevec.x * right + eyevec.y * up + eyevec.z * forward;
}

void RotateCamera(inout vec3 eyevec, inout vec3 eyepos)
{
    // Original horizontal mouse tracking, replaced with the original default
    // look angle (0.35) so nothing moves on its own; the live view is driven
    // entirely by OrbitCamera. Intentionally a no-op.
    float mousePosY = 0.0;
    float mousePosX = 0.35;

    vec3 angle = vec3(mousePosY * 0.05 + 0.05, 1.0 + mousePosX * 1.0, -0.45);
}

void WarpSpace(inout vec3 eyevec, inout vec3 raypos)
{
    vec3 origin = vec3(0.0, 0.0, 0.0);

    float singularityDist = distance(raypos, origin);
    float warpFactor = 1.0 / (pow(singularityDist, 2.0) + 0.000001);

    vec3 singularityVector = normalize(origin - raypos);
    
    float warpAmount = 5.0;

    eyevec = normalize(eyevec + singularityVector * warpFactor * warpAmount / float(ITERATIONS));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    vec2 uv = fragCoord.xy / iResolution.xy;
    
    float aspect = iResolution.x / iResolution.y;

    vec2 uveye = uv;
    
    #ifdef TEMPORAL_AA
    uveye.x += (rand(uv + sin(iTime * 1.0)) / iResolution.x) * (iMouse.z > 1.0 ? 0.0 : 1.0);
    uveye.y += (rand(uv + 1.0 + sin(iTime * 1.0)) / iResolution.y) * (iMouse.z > 1.0 ? 0.0 : 1.0);
    #endif
    
    // Zoom-out framing (widens the FOV) so the disc + glow fit; orbit radius
    // lives in uCamera.z.
    float fit = 1.0;
    if (aspect < FIT_MAX_ASPECT)
    {
        float t = clamp((FIT_MAX_ASPECT - aspect) / (FIT_MAX_ASPECT - FIT_MIN_ASPECT), 0.0, 1.0);
        float need = FOCAL_LENGTH * (DISC_FIT_RADIUS / max(uCamera.z, 0.001)) / max(aspect, 0.001);
        fit = mix(1.0, need, t);
    }
    else
    {
        float u = clamp((aspect - DESKTOP_FIT_START) / (DESKTOP_FIT_END - DESKTOP_FIT_START), 0.0, 1.0);
        fit = mix(1.0, DESKTOP_FIT, u);
    }
    
    vec3 eyevec = normalize(vec3((uveye * 2.0 - 1.0) * vec2(aspect, 1.0) * fit, FOCAL_LENGTH));
    vec3 eyepos = vec3(0.0, -0.0, -10.0);
    
    vec2 mousepos = iMouse.xy / iResolution.xy;
    mousepos.x = 0.35; // fixed at the shader's original default look angle
    eyepos.x += mousepos.x * 3.0 - 1.5; // = 0.0: the lateral dolly is neutralized
    
    const float far = 15.0;

    OrbitCamera(eyevec, eyepos);

    vec3 color = vec3(0.0, 0.0, 0.0);
    
    float dither = rand(uv 
                        #ifdef TEMPORAL_AA
                        + sin(iTime * 1.0) * (iMouse.z > 1.0 ? 0.0 : 1.0)
                        #endif
                       ) * 2.0;


    float alpha = 0.0;
    vec3 raypos = eyepos + eyevec * dither * far / float(ITERATIONS);
    for (int i = 0; i < ITERATIONS; i++)
    {        
        WarpSpace(eyevec, raypos);
        raypos += eyevec * far / float(ITERATIONS);
        GasDisc(color, alpha, raypos);
        Haze(color, raypos, alpha);
    }
    
    color *= 0.0001;

    
    #ifdef TEMPORAL_AA
    const float p = 1.0;
    vec3 previous = pow(texture(iChannel2, uv).rgb, vec3(1.0 / p));
    
    color = pow(color, vec3(1.0 / p));
    
    // Temporal blend; off while dragging (ghosting) and one frame after a
    // render-target realloc (feedback is black — blending would dim the image).
    float blendWeight = 0.9
        * (iMouse.z > 1.0 ? 0.0 : 1.0)
        * (uFeedbackReset > 0.5 ? 0.0 : 1.0);
    
    color = mix(color, previous, blendWeight);
    
    color = pow(color, vec3(p));
    #endif
    
    fragColor = vec4(saturate(color), 1.0);

}
