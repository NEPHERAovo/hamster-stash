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

    // 1. Dock Capsule Geometry & Clean Surface
    float dDock = sdRoundBox(p - uDockRect.xy, uDockRect.zw, uDockRect.w);
    float dDrop = sdRoundBox(p - uDropletRect.xy, uDropletRect.zw, uDropletRect.w);

    float dockMask = 1.0 - smoothstep(-0.75, 0.75, dDock);
    float dropMask = 1.0 - smoothstep(-0.75, 0.75, dDrop);

    // Subtle 1px structural hairline around outer dock (zero dark box-shadow)
    float dockBorder = smoothstep(1.0, 0.0, abs(dDock)) * (uDark > 0.5 ? 0.12 : 0.06);
    vec3 dockSurface = uDark > 0.5 ? vec3(0.110, 0.114, 0.133) : vec3(1.0, 1.0, 1.0);
    dockSurface = mix(dockSurface, vec3(0.0), dockBorder);

    // 2. Soft Drop Shadow cast only by the lifted droplet lens (uTrigger > 0)
    vec2 shadowOffset = vec2(0.0, 3.0 * uTrigger);
    float dDropShadow = sdRoundBox(p - uDropletRect.xy - shadowOffset, uDropletRect.zw, uDropletRect.w);
    float dropShadowAlpha = smoothstep(16.0, 0.0, dDropShadow) * (uDark > 0.5 ? 0.32 : 0.12) * uTrigger;
    vec3 shadowCol = uDark > 0.5 ? vec3(0.0, 0.0, 0.0) : vec3(0.08, 0.10, 0.16);

    // 3. Droplet Capsule Outward Normal
    float distInward = max(0.0, -dDrop);
    vec2 rel = p - uDropletRect.xy;
    vec2 b = uDropletRect.zw - uDropletRect.w;
    vec2 q = abs(rel) - b;
    vec2 outNormal = normalize(sign(rel) * max(q, 0.0) + vec2(1e-5));
    if (max(q.x, q.y) < 0.0) {
      outNormal = abs(q.x) > abs(q.y) ? vec2(sign(rel.x), 0.0) : vec2(0.0, sign(rel.y));
    }

    // 4. Optical Refraction & Meniscus Curve
    float rimWidth = 14.0;
    float meniscus = pow(clamp(1.0 - distInward / rimWidth, 0.0, 1.0), 1.6);

    // Lens bending + chromatic dispersion displacement
    vec2 refractOffset = -outNormal * (meniscus * 0.032 * uTrigger) - (rel / uDropletRect.zw) * (0.010 * uTrigger);
    vec2 dispR = outNormal * (meniscus * 0.024 * uTrigger);
    vec2 dispB = -outNormal * (meniscus * 0.024 * uTrigger);

    // 5. Independent Multi-Channel Chromatic Separation of Glyphs
    vec4 sR = sampleGlyphs(baseUV + refractOffset + dispR);
    vec4 sG = sampleGlyphs(baseUV + refractOffset);
    vec4 sB = sampleGlyphs(baseUV + refractOffset + dispB);

    vec3 dispersedGlyphRgb = vec3(sR.r, sG.g, sB.b);
    vec3 glyphAlphaChannels = vec3(sR.a, sG.a, sB.a);

    // 6. Prismatic Spectral Caustic Rim along the Meniscus
    float rimNorm = clamp(distInward / rimWidth, 0.0, 1.0);
    float angle = atan(outNormal.y, outNormal.x);
    float spectralPhase = rimNorm * 6.283 + angle * 0.5;
    vec3 spectralCol = vec3(
      0.5 + 0.5 * cos(spectralPhase),
      0.5 + 0.5 * cos(spectralPhase + 2.094),
      0.5 + 0.5 * cos(spectralPhase + 4.188)
    );
    float rimEnvelope = smoothstep(12.0, 3.0, distInward) * smoothstep(0.5, 3.0, distInward);
    float spectralSheen = rimEnvelope * 0.48 * uTrigger;

    // Delicate top-edge Fresnel catch-light (no thick white border)
    float topKey = max(-outNormal.y, 0.0);
    float topHighlight = smoothstep(3.0, 0.8, distInward) * smoothstep(0.0, 0.8, distInward) * topKey * 0.40 * uTrigger;

    // 7. Resting Gray Pill vs. Lifted Crystal Glass Droplet
    // Resting pill fades out slower via uColorTrigger
    float pillAlpha = 1.0 - uColorTrigger;
    vec3 canvasBg = uDark > 0.5 ? vec3(0.035, 0.039, 0.051) : vec3(0.953, 0.957, 0.965);
    vec3 underLensBg = mix(canvasBg, dockSurface, dockMask);

    vec3 restingPill = uDark > 0.5 ? vec3(0.173, 0.176, 0.208) : vec3(0.898, 0.898, 0.918);
    vec3 dropletBase = mix(underLensBg, restingPill, pillAlpha);

    // Apply spectral prismatic sheen and delicate Fresnel highlight
    dropletBase = mix(dropletBase, spectralCol, spectralSheen);
    dropletBase = clamp(dropletBase + vec3(topHighlight), 0.0, 1.0);

    // Blend dispersed glyph channels
    vec3 dropletFinal = mix(dropletBase, dispersedGlyphRgb, glyphAlphaChannels);

    // 8. Dock Layer with Inactive Glyphs
    vec4 inactiveSample = texture2D(uInactiveTex, baseUV);
    vec3 dockWithInactive = mix(dockSurface, inactiveSample.rgb, inactiveSample.a);

    // 9. Composite Scene
    vec3 sceneRgb = dockWithInactive;
    float sceneAlpha = dockMask;

    // Composite lifted droplet shadow
    if (dropShadowAlpha > 0.001) {
      sceneRgb = mix(sceneRgb, shadowCol, dropShadowAlpha * (1.0 - dropMask));
      sceneAlpha = max(sceneAlpha, dropShadowAlpha);
    }

    // Composite droplet lens
    vec3 outRgb = mix(sceneRgb, dropletFinal, dropMask);
    float outAlpha = max(sceneAlpha, dropMask);

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
