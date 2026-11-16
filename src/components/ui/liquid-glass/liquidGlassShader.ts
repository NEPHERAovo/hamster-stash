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
    float insideDrop = 1.0 - smoothstep(-0.75, 0.75, dSample);

    vec4 inactiveGlyph = texture2D(uInactiveTex, clampedUV);
    vec4 activeGlyph = texture2D(uActiveTex, clampedUV);
    return mix(inactiveGlyph, activeGlyph, insideDrop);
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uDpr;
    vec2 baseUV = p / uCanvasSize;

    float dDock = sdRoundBox(p - uDockRect.xy, uDockRect.zw, uDockRect.w);
    float dDrop = sdRoundBox(p - uDropletRect.xy, uDropletRect.zw, uDropletRect.w);

    float dockMask = 1.0 - smoothstep(-0.75, 0.75, dDock);
    float dropMask = 1.0 - smoothstep(-0.75, 0.75, dDrop);

    // 1. Ambient Drop Shadow around Outer Dock Capsule
    float dockShadowRadius = 14.0;
    float dockShadowAlpha = smoothstep(dockShadowRadius, 0.0, dDock) * (uDark > 0.5 ? 0.35 : 0.08);
    vec3 dockShadowCol = uDark > 0.5 ? vec3(0.01, 0.01, 0.02) : vec3(0.12, 0.15, 0.22);

    // 2. Diffused Elevation Shadow cast by Lifted Droplet Lens (uTrigger > 0)
    float dropShadowRadius = mix(6.0, 18.0, uTrigger);
    float dropShadowStrength = mix(0.0, uDark > 0.5 ? 0.45 : 0.12, uTrigger);
    float dropShadowAlpha = smoothstep(dropShadowRadius, 0.0, dDrop) * dropShadowStrength;
    vec3 dropShadowCol = uDark > 0.5 ? vec3(0.01, 0.01, 0.02) : vec3(0.0, 0.0, 0.0);

    // 3. Outer Dock Capsule: pure luminous white (#FAFAFC / #1C1D22) + subtle glass rim sheen
    vec3 dockBase = uDark > 0.5 ? vec3(0.110, 0.114, 0.133) : vec3(0.992, 0.994, 0.998);

    float dockInward = max(0.0, -dDock);
    vec2 dockRel = p - uDockRect.xy;
    vec2 dockB = uDockRect.zw - uDockRect.w;
    vec2 dockQ = abs(dockRel) - dockB;
    vec2 dockOutNormal = normalize(sign(dockRel) * max(dockQ, 0.0) + vec2(1e-5));
    float dockTopSheen = max(-dockOutNormal.y, 0.0) * smoothstep(3.5, 0.5, dockInward) * (uDark > 0.5 ? 0.09 : 0.05);
    float dockBotSheen = max(dockOutNormal.y, 0.0) * smoothstep(2.5, 0.5, dockInward) * (uDark > 0.5 ? 0.05 : 0.025);
    vec3 dockSurface = dockBase + vec3(dockTopSheen + dockBotSheen);

    // Crisp 1px structural hairline border around dock
    float dockBorderMask = 1.0 - smoothstep(0.0, 1.0, abs(dDock));
    vec3 dockBorderCol = uDark > 0.5 ? vec3(1.0, 1.0, 1.0) : vec3(0.0, 0.0, 0.0);
    float dockBorderAlpha = dockBorderMask * (uDark > 0.5 ? 0.12 : 0.08);
    dockSurface = mix(dockSurface, dockBorderCol, dockBorderAlpha);

    // 4. Droplet Capsule Outward Normal and Geometry
    float distInward = max(0.0, -dDrop);
    vec2 rel = p - uDropletRect.xy;
    vec2 b = uDropletRect.zw - uDropletRect.w;
    vec2 q = abs(rel) - b;
    vec2 outNormal = normalize(sign(rel) * max(q, 0.0) + vec2(1e-5));
    if (max(q.x, q.y) < 0.0) {
      outNormal = abs(q.x) > abs(q.y) ? vec2(sign(rel.x), 0.0) : vec2(0.0, sign(rel.y));
    }

    // 5. Gentle Optical Magnification (~1.05x UV pull) & Smooth Low-Frequency Edge Dispersion
    vec2 dropCenterUV = uDropletRect.xy / uCanvasSize;
    vec2 deltaUV = baseUV - dropCenterUV;
    vec2 magOffset = -deltaUV * (0.048 * uTrigger);

    float bevelWidth = 7.0;
    float bevelNorm = clamp(1.0 - distInward / bevelWidth, 0.0, 1.0);
    float bevelCurve = pow(bevelNorm, 1.6);

    float activeRefract = uRefraction * uTrigger;
    float activeDisp = uDispersion * uTrigger;

    vec2 refractOffset = outNormal * (bevelCurve * 0.024 * activeRefract) + magOffset;
    vec2 dispShift = outNormal * (bevelCurve * 0.008 * activeDisp);

    // 6. Glyph Sampling (Inactive / Active) with gentle dispersion
    float glyphR = sampleGlyphs(baseUV + refractOffset + dispShift).r;
    vec4 glyphCenter = sampleGlyphs(baseUV + refractOffset);
    float glyphG = glyphCenter.g;
    float glyphB = sampleGlyphs(baseUV + refractOffset - dispShift).b;
    float glyphAlpha = glyphCenter.a;
    vec3 glyphRgb = vec3(glyphR, glyphG, glyphB);

    // 7. Droplet Surface Color Morph: Flat Cool-Gray (#E6E7EC / #2C2D35) -> Crystal White Lens (#FFFFFF / #262834)
    vec3 restingPillCol = uDark > 0.5 ? vec3(0.173, 0.176, 0.208) : vec3(0.902, 0.906, 0.925);
    vec3 liftedLensCol = uDark > 0.5 ? vec3(0.149, 0.157, 0.204) : vec3(1.0, 1.0, 1.0);
    vec3 dropletSurface = mix(restingPillCol, liftedLensCol, uTrigger);

    // 8. 3D Curved Bevel Meniscus Optics along Top & Bottom Arcs (pow(abs(outNormal.y), 1.35))
    float yFactor = pow(max(abs(outNormal.y), 0.0), 1.35);
    float xFactor = pow(max(abs(outNormal.x), 0.0), 1.6);

    // A. Outer Specular Edge (0 - 1.5px)
    float topKey = max(-outNormal.y, 0.0);
    float botBounce = max(outNormal.y, 0.0);
    float arcWeight = topKey * 0.85 + botBounce * 0.35;
    float outerSpecBand = smoothstep(1.8, 0.2, distInward) * smoothstep(0.0, 0.4, distInward);
    float outerSpec = outerSpecBand * yFactor * arcWeight * (0.35 + 0.65 * uTrigger);
    vec3 outerSpecCol = uDark > 0.5 ? vec3(0.92, 0.95, 1.0) : vec3(1.0, 1.0, 1.0);

    // B. Cool-slate internal refraction trough (2 - 5.5px, soft #D4D9E2 in light mode)
    float troughBand = smoothstep(5.5, 3.2, distInward) * smoothstep(1.5, 3.2, distInward);
    vec3 troughCol = uDark > 0.5 ? vec3(0.08, 0.09, 0.12) : vec3(0.831, 0.851, 0.886);
    float troughShade = troughBand * yFactor * (uDark > 0.5 ? 0.35 : 0.16) * uTrigger;
    dropletSurface = mix(dropletSurface, troughCol, troughShade);

    // C. Delicate inner caustic rim (5.5 - 7px)
    float causticBand = smoothstep(7.0, 6.2, distInward) * smoothstep(4.8, 6.2, distInward);
    float causticIntensity = causticBand * yFactor * (uDark > 0.5 ? 0.18 : 0.10) * uTrigger;
    vec3 causticCol = uDark > 0.5 ? vec3(0.85, 0.90, 1.0) : vec3(1.0, 1.0, 1.0);
    dropletSurface = clamp(dropletSurface + causticCol * causticIntensity, 0.0, 1.0);

    // D. Silky Pastel Iridescence (Soft Cyan -> Lavender -> Peach, ~14% opacity)
    float tArc = 0.5 + 0.5 * clamp(rel.x / max(1.0, uDropletRect.z), -1.0, 1.0);
    vec3 pastelCyan = vec3(0.68, 0.88, 0.96);
    vec3 pastelLavender = vec3(0.82, 0.78, 0.95);
    vec3 pastelPeach = vec3(0.98, 0.82, 0.76);
    vec3 pastelIrid = mix(mix(pastelCyan, pastelLavender, smoothstep(0.0, 0.5, tArc)), pastelPeach, smoothstep(0.5, 1.0, tArc));
    float iridBand = smoothstep(6.0, 3.0, distInward) * smoothstep(0.8, 3.0, distInward) * yFactor;
    float iridOpacity = iridBand * 0.14 * uTrigger;
    dropletSurface = mix(dropletSurface, pastelIrid, iridOpacity);

    // Apply outer specular highlight
    dropletSurface = clamp(dropletSurface + outerSpecCol * outerSpec, 0.0, 1.0);

    // E. Left & Right Curved End-Caps internal refraction shadow
    float flankBand = smoothstep(4.5, 1.0, distInward) * smoothstep(0.0, 1.0, distInward);
    float flankShade = flankBand * xFactor * (uDark > 0.5 ? 0.24 : 0.10) * (0.35 + 0.65 * uTrigger);
    vec3 flankCol = uDark > 0.5 ? vec3(0.06, 0.08, 0.12) : vec3(0.48, 0.52, 0.60);
    dropletSurface = mix(dropletSurface, flankCol, flankShade);

    // 9. Blend active tab glyph on droplet surface
    vec3 dropletWithGlyph = mix(dropletSurface, glyphRgb, glyphAlpha);

    // 10. Crisp 1px Outer Glass Contour Hairline (dDrop = 0)
    float dropBorderMask = 1.0 - smoothstep(0.0, 1.0, abs(dDrop));
    vec3 dropBorderCol = uDark > 0.5 ? vec3(1.0, 1.0, 1.0) : vec3(0.0, 0.0, 0.0);
    float dropBorderAlpha = dropBorderMask * mix(0.06, uDark > 0.5 ? 0.24 : 0.13, uTrigger);
    dropletWithGlyph = mix(dropletWithGlyph, dropBorderCol, dropBorderAlpha);

    // 11. Dock Layer with Inactive Glyphs
    vec4 inactiveSample = texture2D(uInactiveTex, baseUV);
    vec3 dockWithInactive = mix(dockSurface, inactiveSample.rgb, inactiveSample.a);

    // Composite Dock over Dock Shadow
    vec3 bgRgb = mix(dockShadowCol, dockWithInactive, dockMask);
    float bgAlpha = max(dockMask * 0.98, dockShadowAlpha);

    // Composite Lifted Elevation Shadow
    if (dropShadowAlpha > 0.001) {
      bgRgb = mix(bgRgb, dropShadowCol, dropShadowAlpha * (1.0 - dropMask));
      bgAlpha = max(bgAlpha, dropShadowAlpha);
    }

    // Composite Droplet over Dock
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
