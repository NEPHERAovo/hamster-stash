export const VERTEX_SHADER_SOURCE = `
  attribute vec2 aPos;
  void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

export const FRAGMENT_SHADER_SOURCE = `
  precision highp float;

  uniform vec2 uResolution;
  uniform vec2 uCanvasSize;
  uniform float uDpr;
  uniform float uDark;

  uniform vec4 uDockRect;
  uniform vec4 uDropletRect;
  uniform float uTrigger;

  uniform float uRefraction;
  uniform float uDispersion;
  uniform float uRimStrength;

  uniform sampler2D uInactiveTex;
  uniform sampler2D uActiveTex;

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  vec3 sampleScene(vec2 uv) {
    vec2 clampedUV = clamp(uv, 0.002, 0.998);
    vec2 pSample = clampedUV * uCanvasSize;
    float dSample = sdRoundBox(pSample - uDropletRect.xy, uDropletRect.zw, uDropletRect.w);
    float insideDrop = 1.0 - smoothstep(-0.75, 0.75, dSample);

    vec3 inactiveCol = texture2D(uInactiveTex, clampedUV).rgb;
    vec3 activeCol = texture2D(uActiveTex, clampedUV).rgb;
    return mix(inactiveCol, activeCol, insideDrop);
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uDpr;
    vec2 baseUV = p / uCanvasSize;

    float dDock = sdRoundBox(p - uDockRect.xy, uDockRect.zw, uDockRect.w);
    float dDrop = sdRoundBox(p - uDropletRect.xy, uDropletRect.zw, uDropletRect.w);

    float dockMask = 1.0 - smoothstep(-0.75, 0.75, dDock);
    float dropMask = 1.0 - smoothstep(-0.75, 0.75, dDrop);

    float shadowRadius = mix(6.0, 16.0, uTrigger);
    float shadowStrength = mix(uDark > 0.5 ? 0.14 : 0.02, uDark > 0.5 ? 0.40 : 0.08, uTrigger);
    float shadowAlpha = smoothstep(shadowRadius, 0.0, dDrop - 1.0) * shadowStrength;
    vec3 shadowCol = uDark > 0.5 ? vec3(0.01, 0.02, 0.04) : vec3(0.25, 0.30, 0.42);

    if (dropMask <= 0.001) {
      vec3 inactiveRgb = texture2D(uInactiveTex, baseUV).rgb;
      float dockAlpha = dockMask * 0.92;
      vec3 outRgb = mix(shadowCol, inactiveRgb, dockAlpha);
      float outAlpha = max(dockAlpha, shadowAlpha);
      if (outAlpha <= 0.001) discard;
      gl_FragColor = vec4(outRgb * outAlpha, outAlpha);
      return;
    }

    float distInward = max(0.0, -dDrop);

    // Rim meniscus strictly confined to outer 3.5px perimeter
    float rimWidth = 3.5;
    float rimNorm = clamp(1.0 - distInward / rimWidth, 0.0, 1.0);
    float meniscusCurve = pow(rimNorm, 1.8);

    vec2 rel = p - uDropletRect.xy;
    vec2 b = uDropletRect.zw - uDropletRect.w;
    vec2 q = abs(rel) - b;
    vec2 outNormal = normalize(sign(rel) * max(q, 0.0) + vec2(1e-5));
    if (max(q.x, q.y) < 0.0) {
      outNormal = abs(q.x) > abs(q.y) ? vec2(sign(rel.x), 0.0) : vec2(0.0, sign(rel.y));
    }

    float activeRefract = uRefraction * uTrigger;
    float activeDisp = uDispersion * uTrigger;

    vec2 refractOffset = outNormal * (meniscusCurve * 0.048 * activeRefract);
    vec2 dispShift = outNormal * (meniscusCurve * 0.036 * activeDisp);

    float r = sampleScene(baseUV + refractOffset + dispShift).r;
    float g = sampleScene(baseUV + refractOffset).g;
    float bCol = sampleScene(baseUV + refractOffset - dispShift).b;
    vec3 crystalColor = vec3(r, g, bCol);

    // Directional physical rim optics using outNormal:
    // 1. Left & Right Curved End-Caps: delicate smoky/cool-slate internal refraction shadow
    float xFactor = pow(max(abs(outNormal.x), 0.0), 1.8);
    float flankBand = smoothstep(3.5, 0.5, distInward) * smoothstep(0.0, 0.6, distInward);
    float flankShade = flankBand * xFactor * (uDark > 0.5 ? 0.22 : 0.09) * uRimStrength * (0.35 + 0.65 * uTrigger);
    vec3 flankShadowCol = uDark > 0.5 ? vec3(0.05, 0.07, 0.12) : vec3(0.38, 0.42, 0.52);
    crystalColor = mix(crystalColor, flankShadowCol, flankShade);

    // 2. Top & Bottom Horizontal Arcs: crisp white specular highlights
    float yFactor = pow(max(abs(outNormal.y), 0.0), 1.6);
    float topKey = max(-outNormal.y, 0.0);
    float botBounce = max(outNormal.y, 0.0);
    float arcWeight = topKey * 0.85 + botBounce * 0.38;

    float highlightBand = smoothstep(2.8, 0.4, distInward) * smoothstep(0.0, 0.5, distInward);
    float spec = highlightBand * yFactor * arcWeight * (0.38 + 0.62 * uTrigger);
    vec3 specColor = uDark > 0.5 ? vec3(0.92, 0.95, 1.0) : vec3(1.0, 1.0, 1.0);
    crystalColor = clamp(crystalColor + specColor * spec, 0.0, 1.0);

    // 3. Crisp hairline outer boundary definition (outermost 1.2px)
    float hairBorder = smoothstep(1.2, 0.2, distInward);
    vec3 edgeLineCol = uDark > 0.5 ? vec3(0.50, 0.58, 0.72) : vec3(0.80, 0.84, 0.90);
    float edgeWeight = hairBorder * (yFactor * 0.40 + xFactor * 0.25) * uRimStrength * 0.35;
    crystalColor = mix(crystalColor, edgeLineCol, edgeWeight);

    vec3 bgRgb = mix(shadowCol, texture2D(uInactiveTex, baseUV).rgb, dockMask * 0.92);
    float bgAlpha = max(dockMask * 0.92, shadowAlpha);

    vec3 outRgb = mix(bgRgb, crystalColor, dropMask);
    float outAlpha = max(bgAlpha, dropMask);

    if (outAlpha <= 0.001) discard;
    gl_FragColor = vec4(outRgb * outAlpha, outAlpha);
  }
`;

export function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create WebGL shader');
  }
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown error';
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

export function createLiquidProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const prog = gl.createProgram();
  if (!prog) {
    throw new Error('Failed to create WebGL program');
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) || 'Unknown link error';
    gl.deleteProgram(prog);
    throw new Error(`Program link error: ${info}`);
  }

  gl.deleteShader(vs);
  gl.deleteShader(fs);

  return prog;
}
