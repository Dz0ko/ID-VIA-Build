"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Glossy liquid-metal sphere rendered with three.js. Slowly rotates, morphs with 3D noise
 * and tilts toward the mouse. With `roam` it drifts around the whole viewport on a smooth
 * path (left edge, top right, bottom, ...), nudged by scrolling, and is pushed away and
 * ripples harder when the pointer gets close.
 */
export function LiquidBlob({ className, roam = false }: { className?: string; roam?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Skip entirely on weak hardware or when WebGL is unavailable (the page still works without it).
    if ((navigator.hardwareConcurrency ?? 4) <= 2) return;
    if (window.innerWidth < 768 || window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    // Environment: gradient sky for reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(20, 32, 32);
    const envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vPos; void main(){
        float y = normalize(vPos).y; float x = normalize(vPos).x;
        vec3 top = vec3(0.80,0.84,1.0); vec3 mid = vec3(0.05,0.05,0.08); vec3 gold = vec3(1.0,0.72,0.28); vec3 blue = vec3(0.20,0.36,1.0);
        vec3 c = mix(mid, top, smoothstep(0.1, 0.9, y));
        c = mix(c, gold, smoothstep(0.2, 0.9, -y) * smoothstep(-0.2, 0.9, x) * 0.9);
        c = mix(c, blue, smoothstep(0.1, 0.9, -x) * smoothstep(-0.4, 0.5, -y) * 0.6);
        gl_FragColor = vec4(c, 1.0); }`,
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    const envTex = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envTex;

    const geo = new THREE.SphereGeometry(1.75, 96, 96);
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x0b0b10),
      metalness: 0.85,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 2.2,
      reflectivity: 1,
    });
    const uniforms = { uTime: { value: 0 }, uAmp: { value: 0.22 } };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uAmp = uniforms.uAmp;
      shader.vertexShader = `
        uniform float uTime; uniform float uAmp;
        vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
        vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
        vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
        float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
          vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
          vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
          vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
          float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
          vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
          vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
          vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
          vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
          vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
        ${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        `float n = snoise(normal * 1.6 + vec3(uTime * 0.25, uTime * 0.18, uTime * 0.12));
         float n2 = snoise(normal * 3.2 - vec3(uTime * 0.2));
         vec3 transformed = position + normal * (n * uAmp + n2 * uAmp * 0.35);`,
      ).replace(
        "#include <beginnormal_vertex>",
        `vec3 objectNormal = normalize(normal + vec3(snoise(normal*1.6+vec3(uTime*0.25+0.1)), snoise(normal*1.6+vec3(uTime*0.25+0.2)), snoise(normal*1.6+vec3(uTime*0.25+0.3))) * 0.35);`,
      );
    };
    const blob = new THREE.Mesh(geo, mat);
    scene.add(blob);

    // Lights: gold from bottom-right, blue from left, white key
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 4, 4); scene.add(key);
    const gold = new THREE.PointLight(0xf5b942, 90, 30); gold.position.set(3, -2.5, 3); scene.add(gold);
    const blue = new THREE.PointLight(0x3b6cff, 40, 30); blue.position.set(-4, -1, 2.5); scene.add(blue);
    const rim = new THREE.PointLight(0x9b9cff, 25, 30); rim.position.set(-2, 3, -3); scene.add(rim);

    const target = { x: 0, y: 0 };
    const pointer = { x: -9999, y: -9999 };
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX; pointer.y = e.clientY;
      target.x = (e.clientX / window.innerWidth - 0.5) * 2; target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onLeave = () => { pointer.x = -9999; pointer.y = -9999; };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    // Roaming: position of the (fixed) container in viewport space, plus a repulsion offset from the pointer.
    const push = { x: 0, y: 0 };
    let near = 0; // 0..1 how close the pointer is
    const place = (t: number) => {
      if (!roam) return;
      const w = el.clientWidth, h = el.clientHeight;
      const vw = window.innerWidth, vh = window.innerHeight;
      const phase = t * 0.11 + window.scrollY * 0.0012; // scrolling advances the path too
      const cx = vw / 2 + (vw / 2 - w * 0.35) * Math.sin(phase);
      const cy = vh / 2 + (vh / 2 - h * 0.35) * Math.sin(phase * 0.73 + 1.4);
      const dx = pointer.x - cx, dy = pointer.y - cy;
      const d = Math.hypot(dx, dy);
      const R = w * 0.75;
      near += ((d < R ? 1 - d / R : 0) - near) * 0.08;
      const k = d < R && d > 1 ? (R - d) / d : 0;
      push.x += (-dx * k * 0.9 - push.x) * 0.06;
      push.y += (-dy * k * 0.9 - push.y) * 0.06;
      el.style.transform = `translate3d(${cx - w / 2 + push.x}px, ${cy - h / 2 + push.y}px, 0)`;
    };

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf = 0;
    const timer = new THREE.Timer();
    let last = 0;
    let visible = true;
    const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; });
    io.observe(el);
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else tick(); };
    document.addEventListener("visibilitychange", onVis);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      timer.update();
      const t = timer.getElapsed();
      if (t - last < 1 / 30) return; // cap at 30fps
      last = t;
      uniforms.uTime.value = reduced ? 0 : t;
      place(reduced ? 0 : t);
      uniforms.uAmp.value += ((roam ? 0.22 + near * 0.3 : 0.22) - uniforms.uAmp.value) * 0.08;
      blob.rotation.y += reduced ? 0 : 0.0025 + near * 0.02;
      blob.rotation.x += (target.y * 0.35 - blob.rotation.x) * 0.04;
      blob.rotation.z += (-target.x * 0.35 - blob.rotation.z) * 0.04;
      blob.position.x += ((roam ? 0 : target.x * 0.35) - blob.position.x) * 0.03;
      blob.position.y += ((roam ? 0 : -target.y * 0.25 - 0.55) - blob.position.y) * 0.03;
      gold.position.x = 3 + Math.sin(t * 0.5) * 0.8;
      blue.position.y = -1 + Math.cos(t * 0.4) * 0.8;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      io.disconnect();
      geo.dispose(); mat.dispose(); envTex.dispose(); pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [roam]);

  return <div ref={ref} className={className} aria-hidden />;
}
