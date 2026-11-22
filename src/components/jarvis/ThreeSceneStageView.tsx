import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { Axis3D, Pause, Play, RotateCcw, Ruler } from 'lucide-react';
import type { Jarvis3DShape } from '../../types/jarvis';

interface ThreeSceneStageViewProps {
  shape: Jarvis3DShape;
  title?: string;
  dimensions?: Record<string, number>;
  unit?: string;
  labelLines?: string[];
  autoRotateInitial?: boolean;
}

const FACE_HEX_PALETTE = [
  0x00e5ff, // Ciano elétrico
  0xff2a4b, // Vermelho Stark
  0x3b82f6, // Azul cobalto
  0x10b981, // Esmeralda
  0xf59e0b, // Âmbar dourado
  0x8b5cf6, // Violeta
];

function detectSoftwareWebGL(): { supported: boolean; isSoftware: boolean } {
  if (typeof document === 'undefined') return { supported: false, isSoftware: true };
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return { supported: false, isSoftware: true };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoftware = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(renderer);
    return { supported: true, isSoftware };
  } catch {
    return { supported: false, isSoftware: true };
  }
}

function normalizeBoxScale(dims?: Record<string, number>): [number, number, number] {
  const a = Math.max(0.1, Number(dims?.lado ?? dims?.side ?? dims?.a ?? dims?.largura ?? dims?.width ?? 5));
  const b = Math.max(0.1, Number(dims?.altura ?? dims?.height ?? dims?.h ?? dims?.b ?? a));
  const c = Math.max(0.1, Number(dims?.profundidade ?? dims?.depth ?? dims?.comprimento ?? dims?.length ?? dims?.c ?? a));
  const maxVal = Math.max(a, b, c, 0.1);
  const target = 2.0;
  return [
    Math.max(0.55, (a / maxVal) * target),
    Math.max(0.55, (b / maxVal) * target),
    Math.max(0.55, (c / maxVal) * target),
  ];
}

function buildDimensionLabels(
  shape: Jarvis3DShape,
  dimensions?: Record<string, number>,
  unit = 'cm',
  customLines?: string[]
): string[] {
  if (Array.isArray(customLines) && customLines.length > 0) {
    return customLines;
  }
  const d = dimensions || {};
  const entries = Object.entries(d).filter(([, v]) => typeof v === 'number' && Number.isFinite(v));
  if (entries.length === 0) {
    if (shape === 'cube') return [`Lado = 5 ${unit}`, '6 faces quadradas • 12 arestas • 8 vértices'];
    if (shape === 'sphere') return [`Raio = 4 ${unit}`, 'Superfície contínua 3D'];
    if (shape === 'cylinder') return [`Raio = 3 ${unit}`, `Altura = 6 ${unit}`];
    if (shape === 'cone') return [`Raio = 3 ${unit}`, `Altura = 6 ${unit}`];
    if (shape === 'pyramid') return [`Base = 4 ${unit}`, `Altura = 6 ${unit}`];
    return [`Unidade: ${unit}`];
  }

  const labelMap: Record<string, string> = {
    lado: 'Lado (a)',
    side: 'Lado (a)',
    a: 'a',
    b: 'b',
    c: 'c',
    largura: 'Largura',
    width: 'Largura',
    altura: 'Altura (h)',
    height: 'Altura (h)',
    h: 'Altura (h)',
    comprimento: 'Comprimento',
    length: 'Comprimento',
    profundidade: 'Profundidade',
    depth: 'Profundidade',
    raio: 'Raio (r)',
    radius: 'Raio (r)',
    r: 'Raio (r)',
    base: 'Base',
  };

  return entries.map(([k, v]) => `${labelMap[k.toLowerCase()] || k}: ${v} ${unit}`);
}

function createFloorGridTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#040a16';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.16)';
    ctx.lineWidth = 1.5;
    const step = 32;
    for (let i = 0; i <= size; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 42, 75, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/**
 * Fallback 2D sombreado interativo caso o browser/GPU não suporte WebGL.
 * Garante que o utilizador NUNCA vê um painel preto vazio.
 */
const Canvas2DFallback3D: React.FC<{
  shape: Jarvis3DShape;
  dimensions?: Record<string, number>;
  unit: string;
  autoRotate: boolean;
  showMeasures: boolean;
  showAxes: boolean;
}> = ({ shape, dimensions, unit, autoRotate, showMeasures, showAxes }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const angleRef = useRef({ rx: 0.45, ry: 0.65 });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 640;
      const h = canvas.clientHeight || 340;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const bgGrad = ctx.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.5, Math.max(w, h) * 0.7);
      bgGrad.addColorStop(0, '#0a1b36');
      bgGrad.addColorStop(1, '#030814');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      if (autoRotate && !dragRef.current.active) {
        angleRef.current.ry += 0.012;
      }

      const cx = w / 2;
      const cy = h / 2 - 4;
      const [sx, sy, sz] = normalizeBoxScale(dimensions);
      const scale = Math.min(w, h) * 0.22;

      // Sombra suave no chão
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + sy * scale * 0.86 + 18, scale * 1.15, scale * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();

      const cosY = Math.cos(angleRef.current.ry);
      const sinY = Math.sin(angleRef.current.ry);
      const cosX = Math.cos(angleRef.current.rx);
      const sinX = Math.sin(angleRef.current.rx);

      const project = (vx: number, vy: number, vz: number) => {
        const x1 = vx * cosY - vz * sinY;
        const z1 = vx * sinY + vz * cosY;
        const y2 = vy * cosX - z1 * sinX;
        const z2 = vy * sinX + z1 * cosX;
        const persp = 4.6 / (4.6 - z2 * 0.45);
        return {
          x: cx + x1 * scale * persp,
          y: cy - y2 * scale * persp,
          z: z2,
        };
      };

      if (shape === 'sphere' || shape === 'atom') {
        const rad = scale * 0.95;
        const sphGrad = ctx.createRadialGradient(cx - rad * 0.35, cy - rad * 0.35, rad * 0.1, cx, cy, rad);
        sphGrad.addColorStop(0, '#a5f3fc');
        sphGrad.addColorStop(0.45, '#0284c7');
        sphGrad.addColorStop(1, '#082f49');
        ctx.fillStyle = sphGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 42, 75, 0.75)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad, rad * 0.32, angleRef.current.ry * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const hx = sx * 0.55;
        const hy = sy * 0.55;
        const hz = sz * 0.55;
        const verts = [
          [-hx, -hy, -hz],
          [hx, -hy, -hz],
          [hx, hy, -hz],
          [-hx, hy, -hz],
          [-hx, -hy, hz],
          [hx, -hy, hz],
          [hx, hy, hz],
          [-hx, hy, hz],
        ].map(([x, y, z]) => project(x, y, z));

        const faces: Array<{ idx: number[]; color: string }> = [
          { idx: [0, 1, 2, 3], color: 'rgba(59, 130, 246, 0.88)' },
          { idx: [4, 5, 6, 7], color: 'rgba(0, 229, 255, 0.92)' },
          { idx: [0, 4, 7, 3], color: 'rgba(255, 42, 75, 0.88)' },
          { idx: [1, 5, 6, 2], color: 'rgba(16, 185, 129, 0.88)' },
          { idx: [3, 2, 6, 7], color: 'rgba(245, 158, 11, 0.92)' },
          { idx: [0, 1, 5, 4], color: 'rgba(139, 92, 246, 0.88)' },
        ];

        const sorted = faces
          .map((f) => ({
            ...f,
            depth: f.idx.reduce((acc, i) => acc + verts[i].z, 0) / f.idx.length,
          }))
          .sort((a, b) => a.depth - b.depth);

        for (const face of sorted) {
          ctx.beginPath();
          face.idx.forEach((vi, pos) => {
            const p = verts[vi];
            if (pos === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fillStyle = face.color;
          ctx.fill();
          ctx.strokeStyle = '#e0f7ff';
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }

        for (const v of verts) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(v.x, v.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        if (showMeasures) {
          const val = Number(dimensions?.lado ?? dimensions?.side ?? dimensions?.a ?? 5);
          const p0 = verts[4];
          const p1 = verts[5];
          ctx.fillStyle = '#020612';
          ctx.strokeStyle = '#00E5FF';
          ctx.lineWidth = 1.5;
          const mx = (p0.x + p1.x) / 2;
          const my = (p0.y + p1.y) / 2 + 18;
          ctx.beginPath();
          ctx.roundRect(mx - 36, my - 11, 72, 22, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#a5f3fc';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${val} ${unit}`, mx, my);
        }
      }

      if (showAxes) {
        const ox = 44;
        const oy = h - 42;
        const len = 24;
        // X (vermelho)
        ctx.strokeStyle = '#ff3b5c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + len, oy + 6);
        ctx.stroke();
        // Y (verde)
        ctx.strokeStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox, oy - len);
        ctx.stroke();
        // Z (azul)
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox - len * 0.72, oy + 10);
        ctx.stroke();
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [shape, dimensions, unit, autoRotate, showMeasures, showAxes]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(e) => {
        dragRef.current = { active: true, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!dragRef.current.active) return;
        const dx = e.clientX - dragRef.current.x;
        const dy = e.clientY - dragRef.current.y;
        dragRef.current.x = e.clientX;
        dragRef.current.y = e.clientY;
        angleRef.current.ry += dx * 0.012;
        angleRef.current.rx = Math.max(-1.2, Math.min(1.2, angleRef.current.rx + dy * 0.012));
      }}
      onPointerUp={() => {
        dragRef.current.active = false;
      }}
      onPointerLeave={() => {
        dragRef.current.active = false;
      }}
      className="w-full h-full block cursor-grab active:cursor-grabbing"
    />
  );
};

export const ThreeSceneStageView: React.FC<ThreeSceneStageViewProps> = ({
  shape,
  dimensions,
  unit = 'cm',
  labelLines,
  autoRotateInitial = true,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  const autoRotateRef = useRef(autoRotateInitial);

  const [autoRotate, setAutoRotate] = useState(autoRotateInitial);
  const [showAxes, setShowAxes] = useState(true);
  const [showMeasures, setShowMeasures] = useState(true);
  const [useCanvasFallback, setUseCanvasFallback] = useState(() => !detectSoftwareWebGL().supported);

  const measureBadges = useMemo(
    () => buildDimensionLabels(shape, dimensions, unit, labelLines),
    [shape, dimensions, unit, labelLines]
  );

  useEffect(() => {
    autoRotateRef.current = autoRotate;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    if (axesRef.current) {
      axesRef.current.visible = showAxes;
    }
  }, [showAxes]);

  useEffect(() => {
    if (useCanvasFallback) return;
    const container = mountRef.current;
    if (!container) return;

    const glProbe = detectSoftwareWebGL();
    if (!glProbe.supported) {
      setUseCanvasFallback(true);
      return;
    }

    const width = Math.max(300, container.clientWidth || 640);
    const height = Math.max(260, container.clientHeight || 340);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !glProbe.isSoftware,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setUseCanvasFallback(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040914);
    scene.fog = new THREE.Fog(0x040914, 9, 22);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.75;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(3.4, 2.55, 4.1);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !glProbe.isSoftware;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 2.2;
    controls.maxDistance = 9;
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 1.65;
    controls.target.set(0, 0.25, 0);
    controls.update();
    controlsRef.current = controls;

    // Iluminação 3 pontos + luz ambiente hemisférica
    const hemi = new THREE.HemisphereLight(0xbbeeff, 0x101c33, 0.75);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.2);
    keyLight.position.set(4.5, 6.2, 4.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 18;
    keyLight.shadow.bias = -0.0008;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00e5ff, 1.35);
    rimLight.position.set(-4.5, 3.0, -3.8);
    scene.add(rimLight);

    const accentWarm = new THREE.PointLight(0xff2a4b, 1.1, 12);
    accentWarm.position.set(2.8, 0.8, -2.5);
    scene.add(accentWarm);

    // Chão quadriculado com sombra realista
    const floorTex = createFloorGridTexture();
    floorTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    const floorGeo = new THREE.PlaneGeometry(14, 14);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.72,
      metalness: 0.18,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1.25;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const axes = new THREE.AxesHelper(2.4);
    axes.position.set(0, -1.24, 0);
    axes.visible = showAxes;
    axesRef.current = axes;
    scene.add(axes);

    // Construção do sólido 3D com faces distintas, arestas visíveis e vértices
    const solidGroup = new THREE.Group();
    solidGroup.position.set(0, 0.25, 0);
    scene.add(solidGroup);

    const disposableGeos: THREE.BufferGeometry[] = [floorGeo];
    const disposableMats: THREE.Material[] = [floorMat];

    const makeFaceMat = (hex: number, opacity = 0.92) => {
      const m = new THREE.MeshPhysicalMaterial({
        color: hex,
        roughness: 0.3,
        metalness: 0.12,
        clearcoat: 0.45,
        clearcoatRoughness: 0.25,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      });
      disposableMats.push(m);
      return m;
    };

    const addEdgesAndVertices = (geo: THREE.BufferGeometry, showVertices = true) => {
      const edgesGeo = new THREE.EdgesGeometry(geo, 18);
      disposableGeos.push(edgesGeo);
      const edgesMat = new THREE.LineBasicMaterial({ color: 0xe6fbff });
      disposableMats.push(edgesMat);
      const lines = new THREE.LineSegments(edgesGeo, edgesMat);
      solidGroup.add(lines);

      if (showVertices) {
        const pos = geo.getAttribute('position');
        const seen = new Set<string>();
        const vGeo = new THREE.SphereGeometry(0.055, 14, 14);
        const vMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0x00e5ff,
          emissiveIntensity: 0.85,
          roughness: 0.2,
        });
        disposableGeos.push(vGeo);
        disposableMats.push(vMat);

        for (let i = 0; i < pos.count; i++) {
          const vx = Number(pos.getX(i).toFixed(3));
          const vy = Number(pos.getY(i).toFixed(3));
          const vz = Number(pos.getZ(i).toFixed(3));
          const key = `${vx}|${vy}|${vz}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (seen.size > 24) break;
          const dot = new THREE.Mesh(vGeo, vMat);
          dot.position.set(vx, vy, vz);
          solidGroup.add(dot);
        }
      }
    };

    const [bx, by, bz] = normalizeBoxScale(dimensions);
    const radiusBase = Math.max(0.75, Math.min(1.25, (bx + bz) * 0.28));
    const heightBase = Math.max(1.2, Math.min(2.3, by));

    if (shape === 'cube' || shape === 'cuboid') {
      const boxDims: [number, number, number] =
        shape === 'cube' ? [bx, bx, bx] : [bx, by, bz];
      const boxGeo = new THREE.BoxGeometry(boxDims[0], boxDims[1], boxDims[2]);
      disposableGeos.push(boxGeo);
      const mats = FACE_HEX_PALETTE.map((hex) => makeFaceMat(hex, 0.9));
      const mesh = new THREE.Mesh(boxGeo, mats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      solidGroup.add(mesh);
      addEdgesAndVertices(boxGeo, true);
    } else if (shape === 'sphere') {
      const sphGeo = new THREE.SphereGeometry(radiusBase * 1.15, 36, 28);
      disposableGeos.push(sphGeo);
      const sphMat = makeFaceMat(0x00e5ff, 0.88);
      const mesh = new THREE.Mesh(sphGeo, sphMat);
      mesh.castShadow = true;
      solidGroup.add(mesh);

      const wireGeo = new THREE.SphereGeometry(radiusBase * 1.158, 16, 12);
      disposableGeos.push(wireGeo);
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xe6fbff,
        wireframe: true,
        transparent: true,
        opacity: 0.26,
      });
      disposableMats.push(wireMat);
      solidGroup.add(new THREE.Mesh(wireGeo, wireMat));

      const ringGeo = new THREE.TorusGeometry(radiusBase * 1.16, 0.018, 12, 64);
      disposableGeos.push(ringGeo);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2a4b });
      disposableMats.push(ringMat);
      const eq = new THREE.Mesh(ringGeo, ringMat);
      eq.rotation.x = Math.PI / 2;
      solidGroup.add(eq);
    } else if (shape === 'cylinder') {
      const cylGeo = new THREE.CylinderGeometry(radiusBase, radiusBase, heightBase, 36);
      disposableGeos.push(cylGeo);
      const mats = [
        makeFaceMat(FACE_HEX_PALETTE[0], 0.9),
        makeFaceMat(FACE_HEX_PALETTE[1], 0.92),
        makeFaceMat(FACE_HEX_PALETTE[2], 0.92),
      ];
      const mesh = new THREE.Mesh(cylGeo, mats);
      mesh.castShadow = true;
      solidGroup.add(mesh);
      addEdgesAndVertices(cylGeo, false);
    } else if (shape === 'cone') {
      const coneGeo = new THREE.ConeGeometry(radiusBase * 1.05, heightBase, 36);
      disposableGeos.push(coneGeo);
      const mats = [makeFaceMat(FACE_HEX_PALETTE[0], 0.9), makeFaceMat(FACE_HEX_PALETTE[1], 0.94)];
      const mesh = new THREE.Mesh(coneGeo, mats);
      mesh.castShadow = true;
      solidGroup.add(mesh);
      addEdgesAndVertices(coneGeo, false);
    } else if (shape === 'pyramid') {
      const pyrGeo = new THREE.ConeGeometry(radiusBase * 1.18, heightBase, 4);
      pyrGeo.rotateY(Math.PI / 4);
      disposableGeos.push(pyrGeo);
      const mats = [makeFaceMat(FACE_HEX_PALETTE[0], 0.9), makeFaceMat(FACE_HEX_PALETTE[4], 0.94)];
      const mesh = new THREE.Mesh(pyrGeo, mats);
      mesh.castShadow = true;
      solidGroup.add(mesh);
      addEdgesAndVertices(pyrGeo, true);
    } else if (shape === 'prism') {
      const prismGeo = new THREE.CylinderGeometry(radiusBase, radiusBase, heightBase, 3);
      disposableGeos.push(prismGeo);
      const mats = [
        makeFaceMat(FACE_HEX_PALETTE[2], 0.9),
        makeFaceMat(FACE_HEX_PALETTE[1], 0.92),
        makeFaceMat(FACE_HEX_PALETTE[3], 0.92),
      ];
      const mesh = new THREE.Mesh(prismGeo, mats);
      mesh.castShadow = true;
      solidGroup.add(mesh);
      addEdgesAndVertices(prismGeo, true);
    } else if (shape === 'octahedron') {
      const octGeo = new THREE.OctahedronGeometry(radiusBase * 1.2);
      disposableGeos.push(octGeo);
      const mesh = new THREE.Mesh(octGeo, makeFaceMat(FACE_HEX_PALETTE[5], 0.92));
      mesh.castShadow = true;
      solidGroup.add(mesh);
      addEdgesAndVertices(octGeo, true);
    } else if (shape === 'torus') {
      const torGeo = new THREE.TorusGeometry(radiusBase * 0.92, radiusBase * 0.34, 24, 56);
      disposableGeos.push(torGeo);
      const mesh = new THREE.Mesh(torGeo, makeFaceMat(FACE_HEX_PALETTE[0], 0.92));
      mesh.castShadow = true;
      solidGroup.add(mesh);
    } else {
      // atom
      const nucGeo = new THREE.SphereGeometry(0.42, 24, 24);
      disposableGeos.push(nucGeo);
      const nucMesh = new THREE.Mesh(nucGeo, makeFaceMat(0xff2a4b, 0.96));
      nucMesh.castShadow = true;
      solidGroup.add(nucMesh);

      const eGeo = new THREE.SphereGeometry(0.11, 16, 16);
      const oGeo = new THREE.TorusGeometry(1.32, 0.022, 12, 64);
      disposableGeos.push(eGeo, oGeo);
      const eMat = makeFaceMat(0x00e5ff, 1);
      const oMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 });
      disposableMats.push(oMat);

      [0, Math.PI / 3, -Math.PI / 3].forEach((rot, idx) => {
        const orbitGroup = new THREE.Group();
        orbitGroup.rotation.set(Math.PI / 2.6, rot, idx * 0.4);
        const ring = new THREE.Mesh(oGeo, oMat);
        const electron = new THREE.Mesh(eGeo, eMat);
        electron.position.set(1.32, 0, 0);
        orbitGroup.add(ring, electron);
        solidGroup.add(orbitGroup);
      });
    }

    // Animação suave de entrada com GSAP
    solidGroup.scale.set(0.7, 0.7, 0.7);
    const tween = gsap.to(solidGroup.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.65,
      ease: 'back.out(1.6)',
    });

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setUseCanvasFallback(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cw = Math.max(260, entry.contentRect.width);
        const ch = Math.max(240, entry.contentRect.height);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
        renderer.setSize(cw, ch);
      }
    });
    ro.observe(container);

    let rafId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      solidGroup.position.y = 0.25 + Math.sin(elapsed * 1.4) * 0.05;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      tween.kill();
      ro.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      axes.dispose();
      floorTex.dispose();
      envTarget.dispose();
      pmrem.dispose();
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [shape, dimensions, useCanvasFallback]);

  const handleResetView = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(3.4, 2.55, 4.1);
      controlsRef.current.target.set(0, 0.25, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-cyan-400/35 bg-[#040914] overflow-hidden">
      {/* Palco 3D dedicado (sem backdrop-filter sobre WebGL) */}
      <div className="relative w-full h-[300px] sm:h-[340px]">
        {useCanvasFallback ? (
          <Canvas2DFallback3D
            shape={shape}
            dimensions={dimensions}
            unit={unit}
            autoRotate={autoRotate}
            showMeasures={showMeasures}
            showAxes={showAxes}
          />
        ) : (
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        )}

        {/* Etiquetas de medidas reais no canto superior esquerdo */}
        {showMeasures && measureBadges.length > 0 && (
          <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-col gap-1">
            {measureBadges.map((line, i) => (
              <div
                key={i}
                className="px-2.5 py-1 rounded-lg bg-[#030916]/90 border border-cyan-400/45 text-[11px] font-mono font-bold text-cyan-200 shadow-sm"
              >
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Legenda dos eixos XYZ */}
        {showAxes && (
          <div className="pointer-events-none absolute bottom-2 left-2.5 px-2.5 py-1 rounded-lg bg-[#030916]/90 border border-cyan-500/35 text-[10px] font-mono flex items-center gap-2">
            <span className="text-rose-400 font-bold">X Vermelho</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-bold">Y Verde</span>
            <span className="text-slate-600">•</span>
            <span className="text-sky-400 font-bold">Z Azul</span>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-2 right-2.5 px-2 py-0.5 rounded bg-[#030916]/85 border border-cyan-500/25 text-[10px] font-mono text-slate-300">
          Arrasta para girar • Scroll para zoom
        </div>
      </div>

      {/* Controlos claros com texto visível fora do canvas WebGL */}
      <div className="px-3 py-2 border-t border-cyan-500/20 bg-[#071124] flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-cyan-300 font-semibold uppercase tracking-wider">
          Modelo 3D Interativo
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAutoRotate((r) => !r)}
            className="px-2.5 py-1 rounded-lg bg-[#0B1830] border border-cyan-500/35 text-cyan-100 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-cyan-500/20 transition cursor-pointer"
          >
            {autoRotate ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{autoRotate ? 'Pausar Giro' : 'Girar 3D'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMeasures((m) => !m)}
            className="px-2.5 py-1 rounded-lg bg-[#0B1830] border border-cyan-500/35 text-cyan-100 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-cyan-500/20 transition cursor-pointer"
          >
            <Ruler className="w-3 h-3" />
            <span>{showMeasures ? 'Ocultar Medidas' : 'Mostrar Medidas'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAxes((a) => !a)}
            className="px-2.5 py-1 rounded-lg bg-[#0B1830] border border-cyan-500/35 text-cyan-100 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-cyan-500/20 transition cursor-pointer"
          >
            <Axis3D className="w-3 h-3" />
            <span>{showAxes ? 'Ocultar Eixos' : 'Eixos XYZ'}</span>
          </button>

          {!useCanvasFallback && (
            <button
              type="button"
              onClick={handleResetView}
              className="px-2.5 py-1 rounded-lg bg-[#0B1830] border border-cyan-500/35 text-cyan-100 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-cyan-500/20 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reiniciar Vista</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
