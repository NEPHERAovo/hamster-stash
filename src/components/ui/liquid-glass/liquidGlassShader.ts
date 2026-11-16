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

  vec4 sampleGlyphs(vec2 uv) {
    vec2 clampedUV = clamp(uv, 0.002, 0.998);
    vec2 pSample = clampedUV * uCanvasSize;
    float dSample = sdRoundBox(pSample - uDropletRect.xy, uDropletRect.zw, uDropletRect.w);
    float insideDrop = 1.0 - smoothstep(-1.5, 1.5, dSample);

    vec4 inactiveGlyph = texture2D(uInactiveTex, clampedUV);
    vec4 activeGlyph = texture2D(uActiveTex, clampedUV);
    return mix(inactiveGlyph, activeGlyph, insideDrop);
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uDpr;
    vec2 baseUV = p / uCanvasSize;

    // 1. Whole-Dock Expansion (+3.5px swell when pressed/lifted)
    vec2 dockHalfSize = uDockRect.zw + vec2(3.5, 3.5) * uTrigger;
    float dDock = sdRoundBox(p - uDockRect.xy, dockHalfSize, dockHalfSize.y);
    float dDrop = sdRoundBox(p - uDropletRect.xy, uDropletRect.zw, uDropletRect.w);

    float dockMask = 1.0 - smoothstep(-0.75, 0.75, dDock);
    float dropMask = 1.0 - smoothstep(-0.75, 0.75, dDrop);

    // 2. Ultra-Light Ambient Elevation Diffusion (No dark halo or black ring)
    vec3 shadowCol = vec3(0.059, 0.090, 0.165);
    float dockShadowRadius = 14.0;
    float dockShadowAlpha = smoothstep(dockShadowRadius, 0.0, dDock) * mix(uDark > 0.5 ? 0.16 : 0.05, uDark > 0.5 ? 0.30 : 0.09, uTrigger);

    float dropShadowRadius = mix(4.0, 16.0, uTrigger);
    float dropShadowAlpha = smoothstep(dropShadowRadius, 0.0, dDrop) * mix(0.0, uDark > 0.5 ? 0.32 : 0.10, uTrigger);

    // 3. Outer Dock Capsule: 4-Sided Directional Glass Lighting
    float dockInward = max(0.0, -dDock);
    vec2 dockRel = p - uDockRect.xy;
    vec2 dockB = dockHalfSize - dockHalfSize.y;
    vec2 dockQ = abs(dockRel) - dockB;
    vec2 dockOutNormal = normalize(sign(dockRel) * max(dockQ, 0.0) + vec2(1e-5));
    if (max(dockQ.x, dockQ.y) < 0.0) {
      dockOutNormal = abs(dockQ.x) > abs(dockQ.y) ? vec2(sign(dockRel.x), 0.0) : vec2(0.0, sign(dockRel.y));
    }

    float dockTopWeight = pow(max(-dockOutNormal.y, 0.0), 1.5);
    float dockBotWeight = pow(max(dockOutNormal.y, 0.0), 1.5);
    float dockSideWeight = pow(max(abs(dockOutNormal.x), 0.0), 1.6);

    // Top & bottom long edges: crisp luminous white specular edge highlights along outer 4px rim (+0.85 top, +0.48 bottom)
    float dockSpecBand = smoothstep(4.0, 0.0, dockInward) * smoothstep(0.0, 0.3, dockInward);
    float dockSpecIntensity = dockSpecBand * (1.0 - dockSideWeight) * (dockTopWeight * 0.85 + dockBotWeight * 0.48) * (0.50 + 0.50 * uTrigger);
    vec3 dockSpecCol = uDark > 0.5 ? vec3(0.92, 0.95, 1.0) : vec3(1.0, 1.0, 1.0);

    // Left & right semicircular caps: sculpted cool dark-gray bevel shading
    float dockRimBand = smoothstep(5.0, 0.0, dockInward) * smoothstep(0.0, 0.4, dockInward);
    vec3 dockFlankCol = uDark > 0.5 ? vec3(0.05, 0.06, 0.09) : vec3(0.56, 0.59, 0.66);
    float dockFlankShade = dockSideWeight * dockRimBand * 0.28;

    // Whole-Dock Surface: Resting cool-gray (#ECEEF3 / #18191F) -> Swelled Pure White Luminous Sheen
    vec3 dockBgRest = uDark > 0.5 ? vec3(0.094, 0.098, 0.122) : vec3(0.925, 0.933, 0.953);
    vec3 dockBgTriggered = uDark > 0.5 ? vec3(0.145, 0.153, 0.184) : vec3(1.0, 1.0, 1.0);
    vec3 dockBase = mix(dockBgRest, dockBgTriggered, uTrigger * 0.90);

    vec3 dockSurface = dockBase;
    dockSurface = mix(dockSurface, dockFlankCol, dockFlankShade);
    dockSurface = clamp(dockSurface + dockSpecCol * dockSpecIntensity, 0.0, 1.0);

    // 4. Inner Active Tab Pill: Flat un-beveled at rest -> crystal white glass lens on trigger
    float distInward = max(0.0, -dDrop);
    vec2 rel = p - uDropletRect.xy;
    vec2 b = uDropletRect.zw - uDropletRect.w;
    vec2 q = abs(rel) - b;
    vec2 outNormal = normalize(sign(rel) * max(q, 0.0) + vec2(1e-5));
    if (max(q.x, q.y) < 0.0) {
      outNormal = abs(q.x) > abs(q.y) ? vec2(sign(rel.x), 0.0) : vec2(0.0, sign(rel.y));
    }

    vec3 restingPillCol = uDark > 0.5 ? vec3(0.173, 0.176, 0.208) : vec3(0.902, 0.906, 0.925);
    vec3 liftedLensCol = uDark > 0.5 ? vec3(0.149, 0.157, 0.204) : vec3(1.0, 1.0, 1.0);
    vec3 dropletSurface = mix(restingPillCol, liftedLensCol, uTrigger);

    // Clean, subtle rim highlight only when lifted (uTrigger > 0)
    float dropRimBand = smoothstep(3.5, 0.0, distInward) * smoothstep(0.0, 0.3, distInward);
    float dropTopKey = max(-outNormal.y, 0.0);
    float dropRimHighlight = dropRimBand * (dropTopKey * 0.45 + 0.25) * uTrigger;
    vec3 dropRimCol = uDark > 0.5 ? vec3(0.90, 0.93, 1.0) : vec3(1.0, 1.0, 1.0);
    dropletSurface = clamp(dropletSurface + dropRimCol * dropRimHighlight, 0.0, 1.0);

    // 5. Smooth, Continuous Convex Lens Refraction (Eliminate Thin Sliver Tearing)
    float rimWidth = 16.0;
    float meniscusCurve = pow(clamp(1.0 - distInward / rimWidth, 0.0, 1.0), 1.5);

    vec2 refractOffset = outNormal * (meniscusCurve * 0.022 * uTrigger) - (rel / uDropletRect.zw) * (0.016 * uTrigger);
    vec2 dispShift = outNormal * (meniscusCurve * 0.013 * uTrigger);

    // 6. Glyph Sampling (Inactive / Active) with smooth dispersion
    float glyphR = sampleGlyphs(baseUV + refractOffset + dispShift).r;
    vec4 glyphCenter = sampleGlyphs(baseUV + refractOffset);
    float glyphG = glyphCenter.g;
    float glyphB = sampleGlyphs(baseUV + refractOffset - dispShift).b;
    float glyphAlpha = glyphCenter.a;
    vec3 glyphRgb = vec3(glyphR, glyphG, glyphB);

    // 7. Blend active tab glyph on droplet surface (100% pure saturation inside)
    vec3 dropletWithGlyph = mix(dropletSurface, glyphRgb, glyphAlpha);

    // 8. Dock Layer with Inactive Glyphs
    vec4 inactiveSample = texture2D(uInactiveTex, baseUV);
    vec3 dockWithInactive = mix(dockSurface, inactiveSample.rgb, inactiveSample.a);

    // 9. Composite Dock over Ambient Shadow
    vec3 bgRgb = mix(shadowCol, dockWithInactive, dockMask);
    float bgAlpha = max(dockMask * 0.98, dockShadowAlpha);

    // 10. Composite Lifted Droplet Elevation Shadow
    if (dropShadowAlpha > 0.001) {
      bgRgb = mix(bgRgb, shadowCol, dropShadowAlpha * (1.0 - dropMask));
      bgAlpha = max(bgAlpha, dropShadowAlpha);
    }

    // 11. Composite Droplet over Dock with Premultiplied Alpha
    vec3 outRgb = mix(bgRgb, dropletWithGlyph, dropMask);
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
