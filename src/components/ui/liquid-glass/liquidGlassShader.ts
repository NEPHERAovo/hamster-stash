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
  uniform float uColorTrigger;

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

    // 1. Geometry Distance Fields
    float dDock = sdRoundBox(p - uDockRect.xy, uDockRect.zw, uDockRect.w);
    float dDrop = sdRoundBox(p - uDropletRect.xy, uDropletRect.zw, uDropletRect.w);

    float dockMask = 1.0 - smoothstep(-0.75, 0.75, dDock);
    float dropMask = 1.0 - smoothstep(-0.75, 0.75, dDrop);
    float distInward = max(0.0, -dDrop);

    // 2. Dock Capsule Surface & Hairline
    float dockBorder = smoothstep(1.0, 0.0, abs(dDock)) * (uDark > 0.5 ? 0.14 : 0.07);
    vec3 dockSurface = uDark > 0.5 ? vec3(0.094, 0.098, 0.118) : vec3(1.0, 1.0, 1.0);
    dockSurface = mix(dockSurface, uDark > 0.5 ? vec3(1.0) : vec3(0.0), dockBorder);

    // Directional top-edge subtle sheen for dock capsule
    vec2 dockRel = p - uDockRect.xy;
    vec2 dockB = uDockRect.zw - uDockRect.w;
    vec2 dockQ = abs(dockRel) - dockB;
    vec2 dockNorm = normalize(sign(dockRel) * max(dockQ, 0.0) + vec2(1e-5));
    if (max(dockQ.x, dockQ.y) < 0.0) {
      dockNorm = abs(dockQ.x) > abs(dockQ.y) ? vec2(sign(dockRel.x), 0.0) : vec2(0.0, sign(dockRel.y));
    }
    float dockTopSheen = max(-dockNorm.y, 0.0) * smoothstep(3.0, 0.5, max(0.0, -dDock)) * (uDark > 0.5 ? 0.15 : 0.06);
    dockSurface += vec3(dockTopSheen);

    // 3. Ambient Dock Elevation Diffusion (Soft & subtle, no dark halo)
    float dockShadowAlpha = smoothstep(12.0, 0.0, dDock) * (uDark > 0.5 ? 0.20 : 0.045);
    vec3 dockShadowCol = uDark > 0.5 ? vec3(0.0) : vec3(0.08, 0.10, 0.16);

    // 4. Lifted Droplet Elevation Shadow (only when lifted, subtle & soft)
    vec2 shadowOffset = vec2(0.0, 3.5 * uTrigger);
    float dDropShadow = sdRoundBox(p - uDropletRect.xy - shadowOffset, uDropletRect.zw, uDropletRect.w);
    float dropShadowAlpha = smoothstep(14.0, 0.0, dDropShadow) * (uDark > 0.5 ? 0.25 : 0.09) * uTrigger;
    vec3 dropShadowCol = uDark > 0.5 ? vec3(0.0) : vec3(0.08, 0.10, 0.16);

    // Composite droplet shadow onto dock surface (outside droplet only)
    vec3 dockWithShadow = mix(dockSurface, dropShadowCol, dropShadowAlpha * (1.0 - dropMask));

    // Sample inactive glyphs across dock
    vec4 inactiveSample = texture2D(uInactiveTex, baseUV);
    vec3 dockFinal = mix(dockWithShadow, inactiveSample.rgb, inactiveSample.a);

    // 5. Droplet Lens Normal & Meniscus Optics
    vec2 rel = p - uDropletRect.xy;
    vec2 b = uDropletRect.zw - uDropletRect.w;
    vec2 q = abs(rel) - b;
    vec2 outNormal = normalize(sign(rel) * max(q, 0.0) + vec2(1e-5));
    if (max(q.x, q.y) < 0.0) {
      outNormal = abs(q.x) > abs(q.y) ? vec2(sign(rel.x), 0.0) : vec2(0.0, sign(rel.y));
    }

    float rimWidth = 14.0;
    float rimNorm = clamp(distInward / rimWidth, 0.0, 1.0);
    float meniscus = pow(1.0 - rimNorm, 1.6);

    // Physical refraction & multi-channel chromatic dispersion
    vec2 refractOffset = -outNormal * (meniscus * 0.026 * uTrigger) - (rel / uDropletRect.zw) * (0.008 * uTrigger);
    vec2 dispDir = -outNormal * (meniscus * 0.016 * uTrigger);

    vec4 sR = sampleGlyphs(baseUV + refractOffset - dispDir);
    vec4 sG = sampleGlyphs(baseUV + refractOffset);
    vec4 sB = sampleGlyphs(baseUV + refractOffset + dispDir);

    vec3 dispersedGlyphRgb = vec3(sR.r, sG.g, sB.b);
    vec3 glyphAlphaChannels = vec3(sR.a, sG.a, sB.a);

    // 6. Fresnel Specular Catch-light & Caustic Sheen
    float topKey = max(-outNormal.y, 0.0);
    float botBounce = max(outNormal.y, 0.0);
    float topHighlight = smoothstep(3.5, 0.6, distInward) * smoothstep(0.0, 0.6, distInward) * (topKey * 0.40 + botBounce * 0.16) * uTrigger;

    float angle = atan(outNormal.y, outNormal.x);
    float spectralPhase = rimNorm * 6.283 + angle * 0.5;
    vec3 spectralCol = vec3(
      0.5 + 0.5 * cos(spectralPhase),
      0.5 + 0.5 * cos(spectralPhase + 2.094),
      0.5 + 0.5 * cos(spectralPhase + 4.188)
    );
    float rimEnvelope = smoothstep(12.0, 2.5, distInward) * smoothstep(0.5, 2.5, distInward);
    float spectralSheen = rimEnvelope * 0.22 * uTrigger;

    float dropEdgeHairline = smoothstep(1.0, 0.0, abs(dDrop)) * (uDark > 0.5 ? 0.18 : 0.08) * uTrigger;

    // 7. Droplet Material: Resting Cool-Gray Pill -> Crystal Liquid Glass
    float pillAlpha = 1.0 - uColorTrigger;
    vec3 restingPill = uDark > 0.5 ? vec3(0.160, 0.165, 0.190) : vec3(0.910, 0.918, 0.933);
    vec3 glassBody = uDark > 0.5 ? vec3(0.130, 0.135, 0.155) : vec3(1.0, 1.0, 1.0);
    vec3 underLensSurface = mix(glassBody, dockSurface, dockMask);

    vec3 dropletBase = mix(underLensSurface, restingPill, pillAlpha);
    dropletBase = mix(dropletBase, spectralCol, spectralSheen);
    dropletBase = clamp(dropletBase + vec3(topHighlight), 0.0, 1.0);
    dropletBase = mix(dropletBase, uDark > 0.5 ? vec3(1.0) : vec3(0.0), dropEdgeHairline);

    // Composite dispersed active glyphs onto droplet
    vec3 dropletFinal = mix(dropletBase, dispersedGlyphRgb, glyphAlphaChannels);

    // 8. Final Scene Composition
    vec3 baseRgb = mix(dockShadowCol, dockFinal, dockMask);
    float baseAlpha = max(dockMask * (uDark > 0.5 ? 0.90 : 0.94), dockShadowAlpha);

    float dropletAlpha = mix(0.40 + 0.35 * uTrigger, 1.0, dockMask);

    vec3 finalRgb = mix(baseRgb, dropletFinal, dropMask);
    float finalAlpha = max(baseAlpha, dropMask * dropletAlpha);

    if (finalAlpha <= 0.001) discard;
    gl_FragColor = vec4(finalRgb * finalAlpha, finalAlpha);
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
