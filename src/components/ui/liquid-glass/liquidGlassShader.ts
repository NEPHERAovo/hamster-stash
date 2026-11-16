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

  vec4 sampleGlyphs(vec2 uv, vec2 dropPos, vec2 dropHalfSize, float dropR) {
    vec2 clampedUV = clamp(uv, 0.002, 0.998);
    vec2 pSample = clampedUV * uCanvasSize;
    float dSample = sdRoundBox(pSample - dropPos, dropHalfSize, dropR);
    float insideDrop = 1.0 - smoothstep(-1.0, 1.0, dSample);

    vec4 inactiveGlyph = texture2D(uInactiveTex, clampedUV);
    vec4 activeGlyph = texture2D(uActiveTex, clampedUV);
    return mix(inactiveGlyph, activeGlyph, insideDrop);
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uDpr;
    vec2 baseUV = p / uCanvasSize;

    // 1. Whole Dock Expansion during interaction:
    // Whole dock swells slightly (+4px width, +1.2px height) coming closer to edges
    vec2 dockHalfSize = uDockRect.zw + vec2(4.0, 1.2) * uTrigger;
    float dDock = sdRoundBox(p - uDockRect.xy, dockHalfSize, dockHalfSize.y);
    float dockMask = 1.0 - smoothstep(-0.5, 0.5, dDock);
    float dockInward = max(0.0, -dDock);

    // Dock Normal
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

    // 2. Dock Glass Edge Optics:
    // "上下为非常细的黑色边附带向内的白色高光，左右为更加明显的黑边带有更加轻微的向内的白色高光"
    float dockStroke = 1.0 - smoothstep(0.0, 1.0, abs(dDock));
    float dockStrokeDark = dockStroke * mix(uDark > 0.5 ? 0.35 : 0.20, uDark > 0.5 ? 0.70 : 0.48, dockSideWeight);

    float dockInwardBand = smoothstep(2.8, 0.3, dockInward);
    float dockTopHighlight = dockTopWeight * 0.55 * dockInwardBand;
    float dockBotHighlight = dockBotWeight * 0.22 * dockInwardBand;
    float dockSideHighlight = dockSideWeight * 0.08 * dockInwardBand;
    float dockHighlight = (dockTopHighlight + dockBotHighlight) * (1.0 - dockSideWeight * 0.65) + dockSideHighlight;

    // Translucent Frosted Glass Dock (transparent, directly revealing the app background beneath)
    vec3 dockColor = uDark > 0.5 ? vec3(0.12, 0.125, 0.14) : vec3(1.0, 1.0, 1.0);
    dockColor += vec3(dockHighlight);
    dockColor = mix(dockColor, vec3(0.0), dockStrokeDark);

    float dockFillAlpha = dockMask * (uDark > 0.5 ? 0.85 : 0.72);
    float dockStrokeAlpha = dockStroke * mix(uDark > 0.5 ? 0.35 : 0.20, uDark > 0.5 ? 0.70 : 0.48, dockSideWeight);
    float totalDockAlpha = max(dockFillAlpha, dockStrokeAlpha);

    // Inactive glyphs
    vec4 inactiveSample = texture2D(uInactiveTex, baseUV);
    vec3 dockFinal = mix(dockColor, inactiveSample.rgb, inactiveSample.a);

    // 3. Selected Tab Geometry: True Stadium Capsule (Miniature replica of the Dock)
    // Semicircular ends (r = dropHalfH) and straight top & bottom edges
    float dropR = uDropletRect.w;
    float dDrop = sdRoundBox(p - uDropletRect.xy, uDropletRect.zw, dropR);
    float dropMask = 1.0 - smoothstep(-0.5, 0.5, dDrop);
    float dropInward = max(0.0, -dDrop);

    vec2 dropRel = p - uDropletRect.xy;
    vec2 dropB = uDropletRect.zw - dropR;
    vec2 dropQ = abs(dropRel) - dropB;
    vec2 dropNorm = normalize(sign(dropRel) * max(dropQ, 0.0) + vec2(1e-5));
    if (max(dropQ.x, dropQ.y) < 0.0) {
      dropNorm = abs(dropQ.x) > abs(dropQ.y) ? vec2(sign(dropRel.x), 0.0) : vec2(0.0, sign(dropRel.y));
    }

    float dropSideWeight = pow(max(abs(dropNorm.x), 0.0), 1.6);
    float dropTopWeight = max(-dropNorm.y, 0.0);
    float dropBotWeight = max(dropNorm.y, 0.0);

    // 4. Tab Glass Edge Optics:
    // "上下为非常细的黑色边附带向内的白色高光，左右为更加明显的黑边带有更加轻微的向内的白色高光"
    float dropStroke = 1.0 - smoothstep(0.0, 1.0, abs(dDrop));
    float dropStrokeDark = dropStroke * mix(uDark > 0.5 ? 0.28 : 0.16, uDark > 0.5 ? 0.60 : 0.42, dropSideWeight);

    float dropInwardBand = smoothstep(3.2, 0.4, dropInward);
    float dropTopHighlight = dropTopWeight * (0.40 + 0.55 * uTrigger) * dropInwardBand;
    float dropBotHighlight = dropBotWeight * (0.18 + 0.32 * uTrigger) * dropInwardBand;
    float dropSideHighlight = dropSideWeight * 0.10 * dropInwardBand;
    float dropHighlight = (dropTopHighlight + dropBotHighlight) * (1.0 - dropSideWeight * 0.65) + dropSideHighlight;

    // 5. Sampling Glyphs with gentle optical magnification
    float rimWidth = 14.0;
    float rimNorm = clamp(dropInward / rimWidth, 0.0, 1.0);
    float meniscus = pow(1.0 - rimNorm, 1.6);

    vec2 dropCenterUV = uDropletRect.xy / uCanvasSize;
    vec2 deltaUV = baseUV - dropCenterUV;
    vec2 magOffset = -deltaUV * (0.06 * uTrigger);
    vec2 refractOffset = -dropNorm * (meniscus * 0.014 * uTrigger);

    vec4 glyphSample = sampleGlyphs(baseUV + magOffset + refractOffset, uDropletRect.xy, uDropletRect.zw, dropR);
    vec3 glyphRgb = glyphSample.rgb;
    float glyphAlpha = glyphSample.a;

    // 6. Selected Tab Body Color & Protrusion Overhang Optics:
    // Resting: translucent gray pill tint (#E5E5EA)
    // Excited state: "覆盖上一层白色的高光" (illuminated white highlight layer)
    vec3 restingPillTint = uDark > 0.5 ? vec3(0.20, 0.21, 0.24) : vec3(0.890, 0.895, 0.915);
    vec3 triggeredWhiteHighlight = uDark > 0.5 ? vec3(0.28, 0.29, 0.33) : vec3(1.0, 1.0, 1.0);
    vec3 tabBaseColor = mix(restingPillTint, triggeredWhiteHighlight, uColorTrigger);

    tabBaseColor += vec3(dropHighlight);
    tabBaseColor = mix(tabBaseColor, vec3(0.0), dropStrokeDark);

    vec3 tabFinal = mix(tabBaseColor, glyphRgb, glyphAlpha);

    // Overhang region (where droplet physically extends beyond dock boundary)
    float overhang = smoothstep(0.0, 1.5, dDock);
    vec3 overhangColor = (uDark > 0.5 ? vec3(0.25) : vec3(1.0)) + vec3(dropHighlight);
    overhangColor = mix(overhangColor, vec3(0.0), dropStrokeDark);
    vec3 tabCompositeColor = mix(tabFinal, overhangColor, overhang);

    // Translucent glass body in overhang region so app background shows through
    float insideDockDropAlpha = mix(uDark > 0.5 ? 0.88 : 0.92, uDark > 0.5 ? 0.94 : 0.96, uTrigger);
    float overhangDropAlpha = mix(0.18, 0.38, uTrigger) + dropHighlight * 0.85;
    float tabAlpha = mix(insideDockDropAlpha, overhangDropAlpha, overhang);
    tabAlpha = max(tabAlpha, dropStroke * mix(uDark > 0.5 ? 0.28 : 0.16, uDark > 0.5 ? 0.60 : 0.42, dropSideWeight));

    // 7. Composite Scene
    float finalAlpha = max(totalDockAlpha, dropMask * tabAlpha);
    vec3 finalRgb = mix(dockFinal, tabCompositeColor, dropMask);

    if (finalAlpha <= 0.001) discard;
    gl_FragColor = vec4(finalRgb * finalAlpha, finalAlpha);

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
