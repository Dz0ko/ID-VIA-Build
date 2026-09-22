"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/** A softly sculpted chrome form. Orbit, surface and light share one animation phase. */
export function LiquidBlob({ className, roam = false }: { className?: string; roam?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || (navigator.hardwareConcurrency ?? 4) <= 2) return;
    if (window.innerWidth < 768 || window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const host = el.closest("section") ?? el.parentElement ?? el;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);
    renderer.domElement.className = "hero-sculpture-canvas";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.z = 6.5;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(20, 32, 24);
    const envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vPos;
        void main() {
          vec3 d = normalize(vPos);
          vec3 c = vec3(0.025, 0.028, 0.055);
          float softbox = pow(max(0.0, dot(d, normalize(vec3(-0.7, 1.0, 0.8)))), 9.0);
          float strip = pow(max(0.0, dot(d, normalize(vec3(0.8, 0.2, 0.7)))), 24.0);
          float violet = pow(max(0.0, dot(d, normalize(vec3(-0.8, -0.4, -0.2)))), 4.0);
          c += vec3(1.8, 1.9, 2.0) * softbox;
          c += vec3(0.75, 0.8, 1.0) * strip;
          c += vec3(0.3, 0.19, 0.65) * violet;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    const environment = pmrem.fromScene(envScene, 0.04);
    scene.environment = environment.texture;
    envGeo.dispose();
    envMat.dispose();
    pmrem.dispose();

    const geo = new THREE.SphereGeometry(1.55, 80, 64);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xa9a6c2,
      metalness: 0.94,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.5,
    });
    const uniforms = { uPhase: { value: 0 }, uAmp: { value: 0.24 } };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = `
        uniform float uPhase;
        uniform float uAmp;
        vec3 surface(vec3 p) {
          vec3 n = normalize(p);
          float wave = sin(n.x * 3.0 + uPhase) * cos(n.y * 2.6 - uPhase * 0.7);
          wave += 0.45 * sin(n.z * 3.5 + n.y * 1.8 + uPhase * 0.6);
          return p + n * wave * uAmp;
        }
        ${shader.vertexShader}`
        .replace("#include <begin_vertex>", "vec3 transformed = surface(position);")
        .replace("#include <beginnormal_vertex>", `
          vec3 n = normalize(position);
          vec3 axis = abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 tangent = normalize(cross(axis, n));
          vec3 bitangent = cross(n, tangent);
          float radius = length(position);
          vec3 center = surface(position);
          vec3 alongT = surface(normalize(n + tangent * 0.01) * radius) - center;
          vec3 alongB = surface(normalize(n + bitangent * 0.01) * radius) - center;
          vec3 objectNormal = normalize(cross(alongT, alongB));
        `);
    };
    const blob = new THREE.Mesh(geo, mat);
    scene.add(blob);
    scene.add(new THREE.AmbientLight(0xc5c8ff, 0.3));
    const key = new THREE.DirectionalLight(0xf0f1ff, 3);
    key.position.set(-3, 4, 4);
    scene.add(key);
    const rim = new THREE.PointLight(0x9585ff, 35, 25);
    rim.position.set(3, -1, 2);
    scene.add(rim);

    const pointer = { x: 0, y: 0, active: false };
    const push = { x: 0, y: 0 };
    let near = 0;
    let scroll = 0;
    let elapsed = 0;
    let previous = 0;
    let visible = false;
    let raf = 0;
    const render = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) { previous = 0; return; }
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      const reduced = motion.matches;
      if (!reduced) elapsed += dt;
      const ease = 1 - Math.exp(-dt * 5);
      const bounds = host.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -bounds.top / Math.max(bounds.height, 1)));
      scroll += (progress - scroll) * ease;
      const phase = reduced ? 0 : elapsed * 0.10 + scroll * 0.45;
      const w = el.clientWidth, h = el.clientHeight;
      if (roam) {
        const insetX = w / 2 + 16, insetY = h / 2 + 16;
        const rx = Math.max(0, bounds.width / 2 - insetX);
        const ry = Math.max(0, bounds.height / 2 - insetY);
        const angle = phase - 0.65;
        const cx = bounds.width / 2 + rx * Math.cos(angle);
        const cy = bounds.height / 2 + ry * Math.sin(angle);
        const dx = bounds.left + cx - pointer.x, dy = bounds.top + cy - pointer.y;
        const distance = Math.hypot(dx, dy);
        const proximity = !reduced && pointer.active ? Math.max(0, 1 - distance / (w * 0.7)) : 0;
        near += (proximity - near) * ease;
        push.x += ((dx / Math.max(distance, 1)) * proximity * 36 - push.x) * ease;
        push.y += ((dy / Math.max(distance, 1)) * proximity * 36 - push.y) * ease;
        const x = THREE.MathUtils.clamp(cx + (reduced ? 0 : push.x), insetX, Math.max(insetX, bounds.width - insetX));
        const y = THREE.MathUtils.clamp(cy + (reduced ? 0 : push.y), insetY, Math.max(insetY, bounds.height - insetY));
        el.style.transform = `translate3d(${x - w / 2}px, ${y - h / 2}px, 0)`;
      }
      uniforms.uPhase.value = phase * 2;
      uniforms.uAmp.value = 0.24 + (reduced ? 0 : near * 0.08);
      blob.rotation.set(Math.sin(phase * 0.7) * 0.15, phase * 0.65, Math.cos(phase) * 0.12);
      blob.position.y = Math.sin(phase * 2) * 0.06;
      rim.position.x = 3 + Math.sin(phase) * 0.5;
      renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(render);
    };
    const restart = () => {
      cancelAnimationFrame(raf);
      previous = 0;
      raf = requestAnimationFrame(render);
    };
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      restart();
    };
    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true;
    };
    const onLeave = () => { pointer.active = false; };
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", restart);
    motion.addEventListener("change", restart);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    if (host !== el) ro.observe(host);
    // Observe the hero, not the moving object, so drifting offscreen cannot freeze the orbit.
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; restart(); });
    io.observe(host);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", restart);
      motion.removeEventListener("change", restart);
      ro.disconnect(); io.disconnect();
      geo.dispose(); mat.dispose(); environment.dispose(); renderer.dispose();
      renderer.domElement.remove();
      el.style.removeProperty("transform");
    };
  }, [roam]);

  return <div ref={ref} className={className} aria-hidden />;
}
