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

    // 1. Whole Dock Expansion during interaction:
    // Whole dock swells by +5px half-width (+10px total width) and +2.5px half-height (+5px total height)
    vec2 dockHalfSize = uDockRect.zw + vec2(5.0, 2.5) * uTrigger;
    float dDock = sdRoundBox(p - uDockRect.xy, dockHalfSize, dockHalfSize.y);
    float dockMask = 1.0 - smoothstep(-0.75, 0.75, dDock);
    float dockInward = max(0.0, -dDock);

    // 2. Dock Surface & Color Dynamics:
    // Resting: soft frosted grayish off-white (#F6F7F9)
    // Triggered: illuminates smoothly into pure white (#FFFFFF)
    vec3 dockResting = uDark > 0.5 ? vec3(0.098, 0.102, 0.122) : vec3(0.965, 0.968, 0.975);
    vec3 dockTriggered = uDark > 0.5 ? vec3(0.120, 0.125, 0.145) : vec3(1.0, 1.0, 1.0);
    vec3 dockSurface = mix(dockResting, dockTriggered, uColorTrigger);

    // 3. Dock Glass Edge Optics:
    // "上下为非常细的黑色边附带向内的白色高光，左右为更加明显的黑边带有更加轻微的向内的白色高光"
    vec2 dockRel = p - uDockRect.xy;
    vec2 dockB = dockHalfSize - dockHalfSize.y;
    vec2 dockQ = abs(dockRel) - dockB;
    vec2 dockNorm = normalize(sign(dockRel) * max(dockQ, 0.0) + vec2(1e-5));
    if (max(dockQ.x, dockQ.y) < 0.0) {
      dockNorm = abs(dockQ.x) > abs(dockQ.y) ? vec2(sign(dockRel.x), 0.0) : vec2(0.0, sign(dockRel.y));
    }

    float dockSideWeight = pow(max(abs(dockNorm.x), 0.0), 1.6);
    float dockTopWeight = max(-dockNorm.y, 0.0);
    float dockBotWeight = max(dockNorm.y, 0.0);

    // Inward white specular highlight (上下强，左右轻微)
    float dockInwardBand = smoothstep(2.8, 0.3, dockInward);
    float dockHighlight = dockInwardBand * ((dockTopWeight * 0.42 + dockBotWeight * 0.18) * (1.0 - dockSideWeight * 0.65) + dockSideWeight * 0.09);
    dockSurface += vec3(dockHighlight);

    // Outer dark hairline border (上下细，左右更加明显)
    float dockBorderMask = smoothstep(1.0, 0.0, abs(dDock));
    float dockBorderDark = dockBorderMask * mix(uDark > 0.5 ? 0.16 : 0.09, uDark > 0.5 ? 0.35 : 0.24, dockSideWeight);
    dockSurface = mix(dockSurface, vec3(0.0), dockBorderDark);

    // Sample inactive glyphs across dock
    vec4 inactiveSample = texture2D(uInactiveTex, baseUV);
    vec3 dockFinal = mix(dockSurface, inactiveSample.rgb, inactiveSample.a);

    // 4. Droplet Superellipse Geometry (iOS native 1.58:1 aspect ratio)
    float k = mix(2.45, 2.20, uTrigger);
    vec2 dropRel = p - uDropletRect.xy;
    vec2 dropSize = uDropletRect.zw;

    float dDrop = distSuperellipse(dropRel, dropSize, k);
    float dropMask = 1.0 - smoothstep(-0.75, 0.75, dDrop);
    float distInward = max(0.0, -dDrop);

    vec2 outNormal = normSuperellipse(dropRel, dropSize, k);

    // 5. Smooth Refraction & Magnification of Glyphs
    float rimWidth = 14.0;
    float rimNorm = clamp(distInward / rimWidth, 0.0, 1.0);
    float meniscus = pow(1.0 - rimNorm, 1.6);

    vec2 dropCenterUV = uDropletRect.xy / uCanvasSize;
    vec2 deltaUV = baseUV - dropCenterUV;
    vec2 magOffset = -deltaUV * (0.10 * uTrigger);
    vec2 refractOffset = -outNormal * (meniscus * 0.018 * uTrigger);

    vec4 glyphSample = sampleGlyphs(baseUV + magOffset + refractOffset, uDropletRect.xy, dropSize, k);
    vec3 glyphRgb = glyphSample.rgb;
    float glyphAlpha = glyphSample.a;

    // 6. Droplet Glass Edge Optics (激发态的玻璃 tab 同样具有上下细黑边+内高光，左右深黑边+轻微内高光特性)
    float dropSideWeight = pow(max(abs(outNormal.x), 0.0), 1.6);
    float dropTopWeight = max(-outNormal.y, 0.0);
    float dropBotWeight = max(outNormal.y, 0.0);

    // Inward white specular highlight (上下强，左右轻微)
    float dropInwardBand = smoothstep(3.2, 0.4, distInward);
    float dropHighlight = dropInwardBand * ((dropTopWeight * 0.70 + dropBotWeight * 0.28) * (1.0 - dropSideWeight * 0.65) + dropSideWeight * 0.12) * uTrigger;

    // Outer dark hairline border (上下细，左右更加明显)
    float dropBorderMask = smoothstep(1.0, 0.0, abs(dDrop));
    float dropBorderDark = dropBorderMask * mix(uDark > 0.5 ? 0.16 : 0.10, uDark > 0.5 ? 0.35 : 0.24, dropSideWeight) * uTrigger;

    // 7. Droplet Material: Resting Gray Pill -> Luminous White / Transparent Glass
    vec3 restingPill = uDark > 0.5 ? vec3(0.175, 0.180, 0.205) : vec3(0.890, 0.894, 0.910);
    vec3 pillColor = mix(restingPill, dockSurface, uColorTrigger);

    vec3 dropletBase = mix(dockSurface, pillColor, 1.0 - uColorTrigger * 0.92);
    dropletBase += vec3(dropHighlight);
    dropletBase = mix(dropletBase, vec3(0.0), dropBorderDark);

    // Composite active glyph (crisp accent blue)
    vec3 dropletFinal = mix(dropletBase, glyphRgb, glyphAlpha);

    // 8. Composite Scene
    float baseAlpha = dockMask * (uDark > 0.5 ? 0.92 : 0.96);

    float overhangAlpha = (0.15 + 0.25 * uTrigger) + dropHighlight * 0.8;
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
