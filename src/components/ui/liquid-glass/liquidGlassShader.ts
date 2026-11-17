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
  uniform float uDockRadius;
  uniform float uDropletRadius;
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

  vec3 sampleUnderGlass(vec2 uv, vec2 dockHalfSize, float dropR) {
    vec2 clampedUV = clamp(uv, 0.002, 0.998);
    vec2 pSample = clampedUV * uCanvasSize;

    float dDockSample = sdRoundBox(pSample - uDockRect.xy, dockHalfSize, uDockRadius);
    float isInsideDock = 1.0 - smoothstep(-0.5, 0.5, dDockSample);

    vec3 pageBg = uDark > 0.5 ? vec3(0.040, 0.043, 0.052) : vec3(0.953, 0.957, 0.965);
    vec3 dockBg = uDark > 0.5 ? vec3(0.14, 0.15, 0.18) : vec3(1.0, 1.0, 1.0);
    vec3 surfaceCol = mix(pageBg, dockBg, isInsideDock);

    vec2 sampleRel = pSample - uDropletRect.xy;
    float sXNorm = clamp(abs(sampleRel.x) / max(1.0, uDropletRect.z), 0.0, 1.0);
    float sCamber = (1.0 - sXNorm * sXNorm) * 0.85;
    vec2 pSampleWarp = pSample;
    pSampleWarp.y -= sign(sampleRel.y) * sCamber;

    float dDropSample = sdRoundBox(pSampleWarp - uDropletRect.xy, uDropletRect.zw, dropR);
    float isInsideDrop = 1.0 - smoothstep(-0.75, 0.75, dDropSample);

    vec4 inactiveG = texture2D(uInactiveTex, clampedUV);
    vec4 activeG = texture2D(uActiveTex, clampedUV);
    vec4 glyph = mix(inactiveG, activeG, isInsideDrop);

    return mix(surfaceCol, glyph.rgb, glyph.a);
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uDpr;
    vec2 baseUV = p / uCanvasSize;

    vec2 dockHalfSize = uDockRect.zw + vec2(4.0, 1.5) * uTrigger;
    float dockR = min(dockHalfSize.y, uDockRadius);
    float dDock = sdRoundBox(p - uDockRect.xy, dockHalfSize, dockR);
    float dockMask = 1.0 - smoothstep(-0.5, 0.5, dDock);
    float dockInward = max(0.0, -dDock);

    vec2 dockRel = p - uDockRect.xy;
    vec2 dockB = dockHalfSize - dockR;
    vec2 dockQ = abs(dockRel) - dockB;
    vec2 dockNorm = normalize(sign(dockRel) * max(dockQ, 0.0) + vec2(1e-5));
    if (max(dockQ.x, dockQ.y) < 0.0) {
      dockNorm = abs(dockQ.x) > abs(dockQ.y) ? vec2(sign(dockRel.x), 0.0) : vec2(0.0, sign(dockRel.y));
    }

    float dockSideWeight = pow(max(abs(dockNorm.x), 0.0), 1.6);
    float dockTopWeight = max(-dockNorm.y, 0.0);
    float dockBotWeight = max(dockNorm.y, 0.0);

    float dockStroke = 1.0 - smoothstep(0.0, 0.8, abs(dDock));
    float dockStrokeDark = dockStroke * mix(uDark > 0.5 ? 0.35 : 0.35, uDark > 0.5 ? 0.72 : 0.35, dockSideWeight);
    vec3 edgeDarkCol = uDark > 0.5 ? vec3(0.02, 0.03, 0.06) : vec3(0.20, 0.22, 0.28);

    float dockInwardBand = smoothstep(0.4, 1.4, dockInward) * smoothstep(1.8, 1.0, dockInward);
    float dockTopHighlight = dockTopWeight * (0.60 + 0.30 * uTrigger) * dockInwardBand;
    float dockBotHighlight = dockBotWeight * (0.26 + 0.16 * uTrigger) * dockInwardBand;
    float dockSideHighlight = dockSideWeight * 0.08 * dockInwardBand;
    float dockHighlight = (dockTopHighlight + dockBotHighlight) * (1.0 - dockSideWeight * 0.55) + dockSideHighlight;

    vec3 dockBaseCol = uDark > 0.5 ? vec3(0.12, 0.13, 0.16) : vec3(1.0, 1.0, 1.0);
    dockBaseCol += vec3(dockHighlight);
    dockBaseCol = mix(dockBaseCol, edgeDarkCol, dockStrokeDark);

    float dockFillAlpha = dockMask * mix(0.0, uDark > 0.5 ? 0.55 : 0.48, uTrigger);
    float dockEdgeAlpha = dockStroke * mix(uDark > 0.5 ? 0.40 : 0.24, uDark > 0.5 ? 0.75 : 0.55, dockSideWeight);
    float totalDockAlpha = max(dockFillAlpha, dockEdgeAlpha);
    totalDockAlpha = max(totalDockAlpha, dockHighlight * 0.85);

    vec4 inactiveGlyph = texture2D(uInactiveTex, baseUV);
    vec3 dockWithInactive = mix(dockBaseCol, inactiveGlyph.rgb, inactiveGlyph.a);
    float dockTotalAlpha = max(totalDockAlpha, inactiveGlyph.a * dockMask);

    vec2 dropRel = p - uDropletRect.xy;
    float xNorm = clamp(abs(dropRel.x) / max(1.0, uDropletRect.z), 0.0, 1.0);
    float camber = (1.0 - xNorm * xNorm) * 0.85;
    vec2 pDropWarp = p;
    pDropWarp.y -= sign(dropRel.y) * camber;

    float dropR = min(uDropletRect.w, uDropletRadius);
    float dDrop = sdRoundBox(pDropWarp - uDropletRect.xy, uDropletRect.zw, dropR);
    float dropMask = 1.0 - smoothstep(-0.5, 0.5, dDrop);
    float dropInward = max(0.0, -dDrop);

    float dShadow = sdRoundBox((pDropWarp - vec2(0.0, 4.0 * uTrigger)) - uDropletRect.xy, uDropletRect.zw, dropR);
    float shadowAlpha = smoothstep(14.0, 1.0, dShadow) * (uDark > 0.5 ? 0.30 : 0.09) * uTrigger;
    vec3 shadowCol = uDark > 0.5 ? vec3(0.01, 0.02, 0.04) : vec3(0.18, 0.22, 0.32);

    if (dropMask <= 0.001 && dockTotalAlpha <= 0.001 && shadowAlpha <= 0.001) {
      discard;
    }

    float pillFade = 1.0 - smoothstep(0.0, 0.15, uTrigger);
    vec3 pillGrey = uDark > 0.5 ? vec3(0.18, 0.19, 0.22) : vec3(0.902, 0.902, 0.920);
    float pillAlpha = dropMask * pillFade * (uDark > 0.5 ? 0.94 : 0.98);
    vec4 activeGlyphRest = texture2D(uActiveTex, baseUV);
    vec3 restingTabCol = mix(pillGrey, activeGlyphRest.rgb, activeGlyphRest.a);

    vec2 dropRelW = pDropWarp - uDropletRect.xy;
    vec2 dropB = uDropletRect.zw - dropR;
    vec2 dropQ = abs(dropRelW) - dropB;
    vec2 dropNorm = normalize(sign(dropRelW) * max(dropQ, 0.0) + vec2(1e-5));
    if (max(dropQ.x, dropQ.y) < 0.0) {
      dropNorm = abs(dropQ.x) > abs(dropQ.y) ? vec2(sign(dropRelW.x), 0.0) : vec2(0.0, sign(dropRelW.y));
    }

    float dropSideWeight = pow(max(abs(dropNorm.x), 0.0), 1.6);
    float dropTopWeight = max(-dropNorm.y, 0.0);
    float dropBotWeight = max(dropNorm.y, 0.0);

    float dropStroke = (1.0 - smoothstep(0.0, 1.2, abs(dDrop))) * uTrigger;
    float dropStrokeDark = dropStroke * mix(uDark > 0.5 ? 0.28 : 0.15, uDark > 0.5 ? 0.60 : 0.42, dropSideWeight);

    float dropInwardBand = smoothstep(1.2, 0.4, dropInward);
    float dropTopHighlight = dropTopWeight * (0.65 * uTrigger) * dropInwardBand;
    float dropBotHighlight = dropBotWeight * (0.30 * uTrigger) * dropInwardBand;
    float dropSideHighlight = dropSideWeight * (0.10 * uTrigger) * dropInwardBand;
    float dropHighlight = (dropTopHighlight + dropBotHighlight) * (1.0 - dropSideWeight * 0.65) + dropSideHighlight;

    float rimWidth = 14.0;
    float rimNorm = clamp(1.0 - dropInward / rimWidth, 0.0, 1.0);
    float meniscusCurve = pow(rimNorm, 1.85);

    float activeRefract = uRefraction * uTrigger;
    float activeDisp = uDispersion * uTrigger;

    vec2 refractOffset = dropNorm * (meniscusCurve * 0.048 * activeRefract)
                       - (dropRel / uDropletRect.zw) * (0.010 * activeRefract);
    vec2 dispShift = dropNorm * (meniscusCurve * 0.036 * activeDisp);

    float r = sampleUnderGlass(baseUV + refractOffset + dispShift, dockHalfSize, dropR).r;
    float g = sampleUnderGlass(baseUV + refractOffset, dockHalfSize, dropR).g;
    float bCol = sampleUnderGlass(baseUV + refractOffset - dispShift, dockHalfSize, dropR).b;
    vec3 glassColor = vec3(r, g, bCol);

    float bevelShade = smoothstep(5.5, 0.6, dropInward) * smoothstep(0.0, 0.8, dropInward);
    float shadeStrength = bevelShade * (uDark > 0.5 ? 0.16 : 0.055) * uRimStrength * uTrigger;
    glassColor *= (1.0 - shadeStrength);

    float topArc = pow(max(dot(dropNorm, normalize(vec2(-0.15, -0.99))), 0.0), 2.6);
    float botArc = pow(max(dot(dropNorm, normalize(vec2(0.15, 0.99))), 0.0), 3.0);
    float spec = dropInwardBand * (topArc * 0.75 + botArc * 0.45) * uTrigger;
    vec3 specColor = uDark > 0.5 ? vec3(0.85, 0.90, 1.0) : vec3(1.0, 1.0, 1.0);
    glassColor = clamp(glassColor + specColor * spec, 0.0, 1.0);

    float hairBorder = smoothstep(1.4, 0.0, dropInward);
    vec3 edgeLineCol = uDark > 0.5 ? vec3(0.45, 0.52, 0.70) : vec3(0.76, 0.79, 0.86);
    glassColor = mix(glassColor, edgeLineCol, hairBorder * 0.38 * uRimStrength * uTrigger);

    glassColor = mix(glassColor, vec3(0.0), dropStrokeDark);
    glassColor += vec3(dropHighlight);

    float overhang = smoothstep(0.0, 1.5, dDock);
    float insideDockGlassAlpha = uDark > 0.5 ? 0.94 : 0.96;
    float overhangGlassAlpha = mix(0.35, 0.55, uTrigger) + dropHighlight * 0.75;
    float activeGlassAlpha = mix(insideDockGlassAlpha, overhangGlassAlpha, overhang);

    float glassFade = smoothstep(0.05, 0.25, uTrigger);
    vec3 finalTabCol = mix(restingTabCol, glassColor, glassFade);
    float finalTabAlpha = mix(pillAlpha, activeGlassAlpha, glassFade);

    vec3 finalCol = mix(dockWithInactive, finalTabCol, dropMask);
    float finalAlpha = max(dockTotalAlpha, dropMask * finalTabAlpha);

    float outsideDrop = 1.0 - dropMask;
    if (shadowAlpha > 0.001 && outsideDrop > 0.001) {
      finalCol = mix(finalCol, shadowCol, shadowAlpha * outsideDrop);
      finalAlpha = max(finalAlpha, shadowAlpha * outsideDrop);
    }

    if (finalAlpha <= 0.001) discard;
    gl_FragColor = vec4(finalCol * finalAlpha, finalAlpha);
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
