"use client";

/*
 * Iridescence shader adapted from React Bits by David Haz:
 * https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/Iridescence/Iridescence.jsx
 * MIT + Commons Clause License Condition v1.0
 * Copyright (c) 2026 David Haz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, and distribute the Software as part of
 * an application, website, or product, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * Commons Clause Restriction:
 * You may use this Software, including for any commercial purpose, so long as
 * you do not sell, sublicense, or redistribute the components themselves —
 * whether alone, in a bundle, or as a ported version.
 * The same restriction covers the React Bits tools (Background Studio, Texture
 * Lab, Shape Magic, Center Stage, Sound Lab and any tools added later) and the
 * sounds in the sound library. You may not sell, sublicense, or redistribute
 * the tools or the sounds themselves, or offer the tools or a substantially
 * similar copy of them as a hosted service — whether alone, in a bundle, or
 * as a ported version.
 * What you make with the tools is yours to use. You can use exported code,
 * images, videos, and audio files in any personal or commercial application,
 * website, or product, including paid ones. You may not sell or redistribute
 * the exports on their own, either individually or as the product itself,
 * such as a sound, texture, background, or template pack.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import { memo, useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import styles from "./unified-login.module.css";

const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
out vec4 fragColor;
void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  float d = -uTime * 0.5;
  float a = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    a += cos(fi - d - a * uv.x);
    d += sin(uv.y * fi + a);
  }
  d += uTime * 0.5;
  vec3 optical = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  optical = cos(optical * cos(vec3(d, a, 2.5)) * 0.5 + 0.5);
  float light = smoothstep(0.55, 0.98, dot(optical, vec3(0.2126, 0.7152, 0.0722)));
  vec3 graphite = vec3(0.025, 0.04, 0.07);
  vec3 silver = vec3(0.59, 0.65, 0.76);
  vec3 color = mix(graphite, silver, pow(light, 3.0) * 0.8);
  float sheen = pow(max(0.0, sin(a + d)), 4.0) * 0.24;
  color = mix(color, vec3(0.12, 0.27, 0.64), sheen);
  fragColor = vec4(color, 1.0);
}
`;

function IridescenceBackdrop() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    let renderer: Renderer;
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 1.5), alpha: false, antialias: false, powerPreference: "low-power" });
    } catch {
      return; // The CSS background remains visible without WebGL.
    }
    const gl = renderer.gl;
    const uniforms = { uTime: { value: 0 }, uResolution: { value: [1, 1] } };
    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex, fragment, uniforms });
    const mesh = new Mesh(gl, { geometry, program });
    root.appendChild(gl.canvas);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last = 0;
    let elapsed = 0;
    const draw = (now: number) => {
      frame = 0;
      if (document.hidden) return;
      if (last) elapsed += Math.min((now - last) / 1000, 0.05);
      last = now;
      uniforms.uTime.value = elapsed * 0.16;
      renderer.render({ scene: mesh });
      if (!motion.matches) frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      if (document.hidden) return;
      if (motion.matches) renderer.render({ scene: mesh });
      else frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      renderer.setSize(Math.max(1, root.clientWidth), Math.max(1, root.clientHeight));
      uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
      renderer.render({ scene: mesh });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    document.addEventListener("visibilitychange", resume);
    motion.addEventListener("change", resume);
    resize();
    resume();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
      motion.removeEventListener("change", resume);
      geometry.remove();
      program.remove();
      gl.canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <div ref={container} className={styles.background} aria-hidden="true" />;
}

export default memo(IridescenceBackdrop);
