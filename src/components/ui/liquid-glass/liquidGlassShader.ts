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

  vec4 sampleFullScene(vec2 uv, float colorTrigger) {
    vec2 clampedUV = clamp(uv, 0.001, 0.999);
    vec2 pAt = clampedUV * uCanvasSize;

    float dD = sdRoundBox(pAt - uDockRect.xy, uDockRect.zw, uDockRect.w);
    float insideDock = 1.0 - smoothstep(-0.75, 0.75, dD);

    float dDr = sdRoundBox(pAt - uDropletRect.xy, uDropletRect.zw, uDropletRect.w);
    float insideDroplet = 1.0 - smoothstep(-1.5, 1.5, dDr);

    // Outer Dock Glass Material & Edge Optics
    float dockInw = max(0.0, -dD);
    vec2 dRel = pAt - uDockRect.xy;
    vec2 dB = uDockRect.zw - uDockRect.w;
    vec2 dQ = abs(dRel) - dB;
    vec2 dNorm = normalize(sign(dRel) * max(dQ, 0.0) + vec2(1e-5));
    if (max(dQ.x, dQ.y) < 0.0) {
      dNorm = abs(dQ.x) > abs(dQ.y) ? vec2(sign(dRel.x), 0.0) : vec2(0.0, sign(dRel.y));
    }

    // Top edge glass highlight & bottom bounce
    float topR = smoothstep(2.5, 0.5, dockInw) * max(-dNorm.y, 0.0) * (uDark > 0.5 ? 0.30 : 0.22);
    float botR = smoothstep(2.0, 0.5, dockInw) * max(dNorm.y, 0.0) * (uDark > 0.5 ? 0.15 : 0.09);
    float sideB = smoothstep(5.5, 0.5, dockInw) * pow(max(abs(dNorm.x), 0.0), 1.5) * (uDark > 0.5 ? 0.18 : 0.07);
    float bord = smoothstep(1.0, 0.0, abs(dD)) * (uDark > 0.5 ? 0.15 : 0.07);

    vec3 dCol = uDark > 0.5 ? vec3(0.10, 0.105, 0.12) : vec3(0.99, 0.995, 1.0);
    dCol += vec3(topR + botR);
    dCol -= vec3(sideB);
    dCol = mix(dCol, uDark > 0.5 ? vec3(1.0) : vec3(0.0), bord);

    vec3 cBg = uDark > 0.5 ? vec3(0.035, 0.039, 0.051) : vec3(0.953, 0.957, 0.965);
    vec3 surf = mix(cBg, dCol, insideDock);

    // Resting gray pill inside active tab boundary (fades out as colorTrigger increases)
    vec3 restPillCol = uDark > 0.5 ? vec3(0.173, 0.176, 0.208) : vec3(0.898, 0.898, 0.918);
    float pillWeight = (1.0 - colorTrigger) * insideDroplet * insideDock;
    surf = mix(surf, restPillCol, pillWeight);

    vec4 inactG = texture2D(uInactiveTex, clampedUV);
    vec4 actG = texture2D(uActiveTex, clampedUV);
    vec4 g = mix(inactG, actG, insideDroplet);

    vec3 compositeRgb = mix(surf, g.rgb, g.a);
    float compositeAlpha = max(insideDock, insideDroplet);

    return vec4(compositeRgb, compositeAlpha);
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uDpr;
    vec2 baseUV = p / uCanvasSize;

    // 1. Base Scene: Dock capsule, glass edges, inactive glyphs, and resting pill
    vec4 baseScene = sampleFullScene(baseUV, 0.0);

    // Distance fields
    float dDock = sdRoundBox(p - uDockRect.xy, uDockRect.zw, uDockRect.w);
    float dDrop = sdRoundBox(p - uDropletRect.xy, uDropletRect.zw, uDropletRect.w);
    float dropMask = 1.0 - smoothstep(-0.75, 0.75, dDrop);
    float distInward = max(0.0, -dDrop);

    // 2. Faint ambient diffusion beneath the outer dock (soft 0.045, no dirty dark box-shadow)
    float dockShadowAlpha = smoothstep(10.0, 0.0, dDock) * (uDark > 0.5 ? 0.20 : 0.045);
    vec3 dockShadowCol = uDark > 0.5 ? vec3(0.0) : vec3(0.10, 0.12, 0.18);

    // 3. Lifted droplet drop shadow (offset downwards 3.5px, only when lifted)
    vec2 shadowOffset = vec2(0.0, 3.5 * uTrigger);
    float dDropShadow = sdRoundBox(p - uDropletRect.xy - shadowOffset, uDropletRect.zw, uDropletRect.w);
    float dropShadowAlpha = smoothstep(14.0, 0.0, dDropShadow) * (uDark > 0.5 ? 0.35 : 0.14) * uTrigger;
    vec3 dropShadowCol = uDark > 0.5 ? vec3(0.0) : vec3(0.08, 0.10, 0.16);

    // 4. Droplet Capsule Outward Normal
    vec2 rel = p - uDropletRect.xy;
    vec2 b = uDropletRect.zw - uDropletRect.w;
    vec2 q = abs(rel) - b;
    vec2 outNormal = normalize(sign(rel) * max(q, 0.0) + vec2(1e-5));
    if (max(q.x, q.y) < 0.0) {
      outNormal = abs(q.x) > abs(q.y) ? vec2(sign(rel.x), 0.0) : vec2(0.0, sign(rel.y));
    }

    // 5. 16px Curved Meniscus Zone & Physical Refraction
    float rimWidth = 16.0;
    float rimFraction = clamp(distInward / rimWidth, 0.0, 1.0);
    float meniscusCurve = pow(1.0 - rimFraction, 1.6);

    // Radial lens displacement in UV space
    vec2 refractOffset = -outNormal * (meniscusCurve * 0.038 * uTrigger) - (rel / uDropletRect.zw) * (0.012 * uTrigger);

    // Physical chromatic dispersion offset: Red vs Blue separated along normal
    vec2 dispDir = -outNormal * (meniscusCurve * 0.022 * uTrigger);
    vec2 uvR = baseUV + refractOffset - dispDir;
    vec2 uvG = baseUV + refractOffset;
    vec2 uvB = baseUV + refractOffset + dispDir;

    // Sample the entire underlying scene with physical dispersion
    vec4 sceneR = sampleFullScene(uvR, uColorTrigger);
    vec4 sceneG = sampleFullScene(uvG, uColorTrigger);
    vec4 sceneB = sampleFullScene(uvB, uColorTrigger);

    vec3 lensRgb = vec3(sceneR.r, sceneG.g, sceneB.b);

    // 6. Fresnel Specular Rim Sheen on Droplet Lens
    float fresnel = pow(1.0 - rimFraction, 2.5);
    float topKey = max(-outNormal.y, 0.0);
    float botBounce = max(outNormal.y, 0.0);
    float rimHighlight = fresnel * (topKey * 0.55 + botBounce * 0.25) * uTrigger;
    lensRgb = clamp(lensRgb + vec3(rimHighlight), 0.0, 1.0);

    // 7. Composite Scene Layers
    vec3 finalRgb = baseScene.rgb;
    float finalAlpha = baseScene.a;

    // Composite ambient dock shadow
    if (dockShadowAlpha > 0.001) {
      finalRgb = mix(dockShadowCol, finalRgb, baseScene.a);
      finalAlpha = max(finalAlpha, dockShadowAlpha);
    }

    // Composite lifted droplet shadow
    if (dropShadowAlpha > 0.001) {
      finalRgb = mix(dropShadowCol, finalRgb, dropShadowAlpha * (1.0 - dropMask));
      finalAlpha = max(finalAlpha, dropShadowAlpha);
    }

    // Composite droplet lens over scene
    finalRgb = mix(finalRgb, lensRgb, dropMask);
    finalAlpha = max(finalAlpha, dropMask);

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
