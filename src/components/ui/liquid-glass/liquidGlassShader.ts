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

  // Superellipse accurate distance estimation for smooth continuous-curvature oval
  float distSuperellipse(vec2 p, vec2 ab, float k) {
    vec2 q = abs(p) / ab;
    float val = pow(pow(q.x, k) + pow(q.y, k), 1.0 / k);
    vec2 g = vec2(
      (q.x > 1e-5) ? pow(q.x, k - 1.0) / ab.x : 0.0,
      (q.y > 1e-5) ? pow(q.y, k - 1.0) / ab.y : 0.0
    );
    float grad = length(g);
    if (grad < 1e-6) return -min(ab.x, ab.y);
    return (val - 1.0) / grad;
  }

  vec2 normSuperellipse(vec2 p, vec2 ab, float k) {
    vec2 q = abs(p) / ab;
    vec2 g = vec2(
      sign(p.x) * ((q.x > 1e-5) ? pow(q.x, k - 1.0) / ab.x : 0.0),
      sign(p.y) * ((q.y > 1e-5) ? pow(q.y, k - 1.0) / ab.y : 0.0)
    );
    return normalize(g + vec2(1e-6));
  }

  vec4 sampleGlyphs(vec2 uv, vec2 dropPos, vec2 dropSize, float k) {
    vec2 clampedUV = clamp(uv, 0.002, 0.998);
    vec2 pSample = clampedUV * uCanvasSize;
    float dSample = distSuperellipse(pSample - dropPos, dropSize, k);
    float insideDrop = 1.0 - smoothstep(-1.5, 1.5, dSample);

    vec4 inactiveGlyph = texture2D(uInactiveTex, clampedUV);
    vec4 activeGlyph = texture2D(uActiveTex, clampedUV);
    return mix(inactiveGlyph, activeGlyph, insideDrop);
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uDpr;
    vec2 baseUV = p / uCanvasSize;

    // 1. Dock Capsule Distance Field
    float dDock = sdRoundBox(p - uDockRect.xy, uDockRect.zw, uDockRect.w);
    float dockMask = 1.0 - smoothstep(-0.75, 0.75, dDock);
    float dockInward = max(0.0, -dDock);

    // 2. Dock Capsule Surface & High-Light Glass Edge Optics
    // "上下偏白，左右带点黑灰" (Top/bottom whitish highlight, left/right subtle black-gray refraction)
    vec3 dockSurface = uDark > 0.5 ? vec3(0.098, 0.102, 0.122) : vec3(1.0, 1.0, 1.0);

    vec2 dockRel = p - uDockRect.xy;
    vec2 dockB = uDockRect.zw - uDockRect.w;
    vec2 dockQ = abs(dockRel) - dockB;
    vec2 dockNorm = normalize(sign(dockRel) * max(dockQ, 0.0) + vec2(1e-5));
    if (max(dockQ.x, dockQ.y) < 0.0) {
      dockNorm = abs(dockQ.x) > abs(dockQ.y) ? vec2(sign(dockRel.x), 0.0) : vec2(0.0, sign(dockRel.y));
    }

    // Top & bottom edges: luminous pure white specular catch-light & bottom bounce
    float topWeight = max(-dockNorm.y, 0.0);
    float botWeight = max(dockNorm.y, 0.0);
    float dockTopGlint = topWeight * smoothstep(2.8, 0.3, dockInward) * (uDark > 0.5 ? 0.35 : 0.24);
    float dockBotGlint = botWeight * smoothstep(2.0, 0.3, dockInward) * (uDark > 0.5 ? 0.20 : 0.10);
    dockSurface += vec3(dockTopGlint + dockBotGlint);

    // Left & right curved ends: subtle dark-gray / dark-smoke flank refraction
    float dockSideWeight = pow(max(abs(dockNorm.x), 0.0), 1.5);
    float dockSideDark = dockSideWeight * smoothstep(4.0, 0.3, dockInward) * (uDark > 0.5 ? 0.24 : 0.13);
    dockSurface -= vec3(dockSideDark);

    // 1px perimeter contour:
    // Top & bottom = delicate white highlight line
    // Left & right flanks = subtle dark hairline
    float borderMask = smoothstep(1.0, 0.0, abs(dDock));
    float borderLight = (1.0 - dockSideWeight) * borderMask * (uDark > 0.5 ? 0.30 : 0.18);
    float borderDark = dockSideWeight * borderMask * (uDark > 0.5 ? 0.25 : 0.15);
    dockSurface = clamp(dockSurface + vec3(borderLight), 0.0, 1.0);
    dockSurface = mix(dockSurface, vec3(0.0), borderDark);

    // Sample inactive glyphs across dock
    vec4 inactiveSample = texture2D(uInactiveTex, baseUV);
    vec3 dockFinal = mix(dockSurface, inactiveSample.rgb, inactiveSample.a);

    // 3. Droplet Superellipse: Wide horizontal capsule (k ~ 2.85) -> Smooth oval dome (k ~ 2.25)
    float k = mix(2.85, 2.25, uTrigger);
    vec2 dropRel = p - uDropletRect.xy;
    vec2 dropSize = uDropletRect.zw;

    float dDrop = distSuperellipse(dropRel, dropSize, k);
    float dropMask = 1.0 - smoothstep(-0.75, 0.75, dDrop);
    float distInward = max(0.0, -dDrop);

    vec2 outNormal = normSuperellipse(dropRel, dropSize, k);

    // 4. Smooth Physical Refraction & Magnification of Glyphs (Trigger state)
    float rimWidth = 14.0;
    float rimNorm = clamp(distInward / rimWidth, 0.0, 1.0);
    float meniscus = pow(1.0 - rimNorm, 1.6);

    // Magnification: pull UVs slightly towards drop center (~10% magnification when triggered)
    vec2 dropCenterUV = uDropletRect.xy / uCanvasSize;
    vec2 deltaUV = baseUV - dropCenterUV;
    vec2 magOffset = -deltaUV * (0.10 * uTrigger);
    vec2 refractOffset = -outNormal * (meniscus * 0.018 * uTrigger);

    vec4 glyphSample = sampleGlyphs(baseUV + magOffset + refractOffset, uDropletRect.xy, dropSize, k);
    vec3 glyphRgb = glyphSample.rgb;
    float glyphAlpha = glyphSample.a;

    // 5. Specular Catch-light on the Oval Dome
    float dropTopKey = max(-outNormal.y, 0.0);
    float dropBotKey = max(outNormal.y, 0.0);

    // Top arc bright white catch-light (peaks at center dome, curves smoothly to sides)
    float topGlint = smoothstep(3.2, 0.5, distInward) * smoothstep(0.0, 0.5, distInward) * pow(dropTopKey, 1.3) * (uDark > 0.5 ? 0.85 : 0.65) * uTrigger;

    // Bottom arc subtle reflection
    float botGlint = smoothstep(2.5, 0.4, distInward) * smoothstep(0.0, 0.4, distInward) * pow(dropBotKey, 1.5) * (uDark > 0.5 ? 0.35 : 0.20) * uTrigger;

    // Microscopic 1px glass edge contour
    float dropHairline = smoothstep(1.0, 0.0, abs(dDrop)) * (uDark > 0.5 ? 0.22 : 0.10) * uTrigger;

    // Subtle side edge refraction on droplet flanks
    float dropSideDark = pow(max(abs(outNormal.x), 0.0), 1.5) * smoothstep(3.5, 0.3, distInward) * (uDark > 0.5 ? 0.16 : 0.08) * uTrigger;

    // 6. Droplet Material: Resting Gray Pill -> Luminous White / Transparent Glass
    // Resting: soft neutral gray (#E5E5EA, wide horizontal capsule)
    // Triggered: smoothly lightens from gray to white (#FFFFFF / dock surface)
    vec3 restingPill = uDark > 0.5 ? vec3(0.180, 0.185, 0.210) : vec3(0.898, 0.898, 0.918);
    vec3 pillColor = mix(restingPill, dockSurface, uColorTrigger);

    // Glass body is transparent: reveals dock surface, illuminated by trigger highlight
    vec3 dropletBase = mix(dockSurface, pillColor, 1.0 - uColorTrigger * 0.92);
    dropletBase = dropletBase - vec3(dropSideDark) + vec3(topGlint + botGlint);
    dropletBase = mix(dropletBase, uDark > 0.5 ? vec3(1.0) : vec3(0.0), dropHairline);

    // Composite active glyph (crisp accent blue)
    vec3 dropletFinal = mix(dropletBase, glyphRgb, glyphAlpha);

    // 7. Composite Scene (Zero outer dock shadow)
    float baseAlpha = dockMask * (uDark > 0.5 ? 0.92 : 0.96);

    // Droplet alpha:
    // Inside dock: 1.0 (seamlessly covers tab)
    // Outside dock overhang: translucent glass body (alpha ~0.20 to 0.40) + specular rim
    float overhangAlpha = (0.15 + 0.25 * uTrigger) + (topGlint + botGlint) * 0.8;
    float dropletAlpha = mix(overhangAlpha, 1.0, dockMask);

    vec3 finalRgb = mix(dockFinal, dropletFinal, dropMask);
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
