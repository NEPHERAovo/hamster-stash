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
      gl_FragColor = vec4(outRgb, outAlpha);
      return;
    }

    float distInward = max(0.0, -dDrop);

    float rimWidth = 12.0;
    float rimNorm = clamp(1.0 - distInward / rimWidth, 0.0, 1.0);
    float meniscusCurve = pow(rimNorm, 1.85);

    vec2 rel = p - uDropletRect.xy;
    vec2 b = uDropletRect.zw - uDropletRect.w;
    vec2 q = abs(rel) - b;
    vec2 outNormal = normalize(sign(rel) * max(q, 0.0) + vec2(1e-5));
    if (max(q.x, q.y) < 0.0) {
      outNormal = abs(q.x) > abs(q.y) ? vec2(sign(rel.x), 0.0) : vec2(0.0, sign(rel.y));
    }

    float activeRefract = uRefraction * uTrigger;
    float activeDisp = uDispersion * uTrigger;

    vec2 refractOffset = outNormal * (meniscusCurve * 0.048 * activeRefract)
                       - (rel / uDropletRect.zw) * (0.010 * activeRefract);

    vec2 dispShift = outNormal * (meniscusCurve * 0.036 * activeDisp);
    float r = sampleScene(baseUV + refractOffset + dispShift).r;
    float g = sampleScene(baseUV + refractOffset).g;
    float bCol = sampleScene(baseUV + refractOffset - dispShift).b;
    vec3 crystalColor = vec3(r, g, bCol);

    vec3 restTint = uDark > 0.5 ? vec3(0.26, 0.30, 0.44) : vec3(0.92, 0.94, 0.98);
    crystalColor = mix(crystalColor, restTint, (1.0 - uTrigger) * (uDark > 0.5 ? 0.32 : 0.42));

    float bevelShade = smoothstep(5.5, 0.6, distInward) * smoothstep(0.0, 0.8, distInward);
    float shadeStrength = bevelShade * (uDark > 0.5 ? 0.16 : 0.055) * uRimStrength * (0.2 + 0.8 * uTrigger);
    crystalColor *= (1.0 - shadeStrength);

    float topArc = pow(max(dot(outNormal, normalize(vec2(-0.15, -0.99))), 0.0), 2.6);
    float botArc = pow(max(dot(outNormal, normalize(vec2(0.15, 0.99))), 0.0), 3.0);
    float innerHighlightBand = smoothstep(2.4, 0.3, distInward);
    float hairBorder = smoothstep(1.1, 0.0, distInward);

    float spec = innerHighlightBand * (topArc * 0.75 + botArc * 0.45) * (0.25 + 0.75 * uTrigger);
    vec3 specColor = uDark > 0.5 ? vec3(0.85, 0.90, 1.0) : vec3(1.0, 1.0, 1.0);
    crystalColor = clamp(crystalColor + specColor * spec, 0.0, 1.0);

    vec3 edgeLineCol = uDark > 0.5 ? vec3(0.45, 0.52, 0.70) : vec3(0.76, 0.79, 0.86);
    crystalColor = mix(crystalColor, edgeLineCol, hairBorder * 0.38 * uRimStrength * (0.3 + 0.7 * uTrigger));

    vec3 bgRgb = mix(shadowCol, texture2D(uInactiveTex, baseUV).rgb, dockMask * 0.92);
    float bgAlpha = max(dockMask * 0.92, shadowAlpha);

    vec3 outRgb = mix(bgRgb, crystalColor, dropMask);
    float outAlpha = max(bgAlpha, dropMask);

    gl_FragColor = vec4(outRgb, outAlpha);
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
