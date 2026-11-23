import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  Axis3D,
  Pause,
  Play,
  RotateCcw,
  Tag,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Jarvis3DShape } from '../../types/jarvis';

interface Sara3DDrawingStudioProps {
  shape: Jarvis3DShape;
  title: string;
  subtitle?: string;
  dimensions?: Record<string, number | string>;
  unit?: string;
}

class ThreeCanvasErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    // Graceful fallback rendered
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function checkWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function AxesAndGrid({ showAxes }: { showAxes: boolean }) {
  if (!showAxes) return null;
  return (
    <group>
      <gridHelper args={[10, 10, '#0ea5e9', '#1e293b']} position={[0, -1.35, 0]} />
      <LineAxis start={[0, -1.35, 0]} end={[3.2, -1.35, 0]} color="#ef4444" label="X" />
      <LineAxis start={[0, -1.35, 0]} end={[0, 2.3, 0]} color="#22c55e" label="Y" />
      <LineAxis start={[0, -1.35, 0]} end={[0, -1.35, 3.2]} color="#38bdf8" label="Z" />
    </group>
  );
}

function LineAxis({
  start,
  end,
  color,
  label,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  label: string;
}) {
  const dir = useMemo(() => {
    const v = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    return v;
  }, [start, end]);
  const length = dir.length();
  const mid: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];
  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return q;
  }, [dir]);

  return (
    <group>
      <mesh position={mid} quaternion={quat}>
        <cylinderGeometry args={[0.02, 0.02, length, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={end} quaternion={quat}>
        <coneGeometry args={[0.075, 0.22, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
      </mesh>
      <Html position={[end[0] * 1.08, end[1] + 0.14, end[2] * 1.08]} center distanceFactor={8}>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono select-none pointer-events-none"
          style={{ backgroundColor: 'rgba(10,16,30,0.88)', color, border: `1px solid ${color}` }}
        >
          {label}
        </span>
      </Html>
    </group>
  );
}

function CarModel3D({ showLabels }: { showLabels: boolean }) {
  return (
    <group position={[0, -0.82, 0]}>
      {/* Shadow contact disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]}>
        <circleGeometry args={[2.5, 48]} />
        <meshStandardMaterial color="#020617" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Lower aero chassis */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.5, 0.48, 1.56]} />
        <meshPhysicalMaterial color="#0ea5e9" metalness={0.78} roughness={0.22} clearcoat={0.9} clearcoatRoughness={0.12} />
      </mesh>

      {/* Front Hood Slope */}
      <mesh position={[1.1, 0.34, 0]} rotation={[0, 0, -0.18]} castShadow>
        <boxGeometry args={[1.22, 0.24, 1.48]} />
        <meshPhysicalMaterial color="#0284c7" metalness={0.82} roughness={0.2} clearcoat={0.9} />
      </mesh>

      {/* Cabin / Roof */}
      <mesh position={[-0.18, 0.56, 0]} castShadow>
        <boxGeometry args={[1.65, 0.44, 1.28]} />
        <meshPhysicalMaterial color="#0369a1" metalness={0.75} roughness={0.25} clearcoat={0.85} />
      </mesh>

      {/* Windshield & Rear Window */}
      <mesh position={[0.68, 0.52, 0]} rotation={[0, 0, -0.56]}>
        <boxGeometry args={[0.52, 0.42, 1.24]} />
        <meshPhysicalMaterial color="#0f172a" metalness={0.35} roughness={0.08} transparent opacity={0.86} />
      </mesh>
      <mesh position={[-1.02, 0.5, 0]} rotation={[0, 0, 0.48]}>
        <boxGeometry args={[0.48, 0.42, 1.22]} />
        <meshPhysicalMaterial color="#0f172a" metalness={0.35} roughness={0.08} transparent opacity={0.86} />
      </mesh>

      {/* Side Windows */}
      <mesh position={[-0.18, 0.56, 0.65]}>
        <boxGeometry args={[1.38, 0.32, 0.03]} />
        <meshPhysicalMaterial color="#0f172a" metalness={0.3} roughness={0.1} transparent opacity={0.88} />
      </mesh>
      <mesh position={[-0.18, 0.56, -0.65]}>
        <boxGeometry args={[1.38, 0.32, 0.03]} />
        <meshPhysicalMaterial color="#0f172a" metalness={0.3} roughness={0.1} transparent opacity={0.88} />
      </mesh>

      {/* Rear Aero Spoiler */}
      <mesh position={[-1.62, 0.52, 0]}>
        <boxGeometry args={[0.28, 0.05, 1.48]} />
        <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Headlights (LED White-Cyan) */}
      <mesh position={[1.76, 0.17, 0.52]}>
        <boxGeometry args={[0.05, 0.12, 0.34]} />
        <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[1.76, 0.17, -0.52]}>
        <boxGeometry args={[0.05, 0.12, 0.34]} />
        <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={1.6} />
      </mesh>

      {/* Taillight Bar (LED Red) */}
      <mesh position={[-1.76, 0.2, 0]}>
        <boxGeometry args={[0.05, 0.1, 1.4]} />
        <meshStandardMaterial color="#fecaca" emissive="#ef4444" emissiveIntensity={1.5} />
      </mesh>

      {/* 4 Wheels with Tires + Metallic Rims */}
      {[
        [1.12, -0.14, 0.8],
        [1.12, -0.14, -0.8],
        [-1.12, -0.14, 0.8],
        [-1.12, -0.14, -0.8],
      ].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.24, 28]} />
            <meshStandardMaterial color="#0f172a" roughness={0.88} metalness={0.1} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.21, 0.21, 0.255, 18]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.92} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.07, 0.07, 0.27, 12]} />
            <meshStandardMaterial color="#38bdf8" roughness={0.25} metalness={0.85} />
          </mesh>
        </group>
      ))}

      {showLabels && (
        <>
          <Html position={[0, 1.02, 0]} center distanceFactor={8}>
            <span className="px-2 py-0.5 rounded bg-[#0A1324] border border-cyan-400/50 text-[10px] font-semibold text-cyan-200 whitespace-nowrap">
              Cabine Aerodinâmica
            </span>
          </Html>
          <Html position={[1.75, 0.45, 0.6]} center distanceFactor={8}>
            <span className="px-2 py-0.5 rounded bg-[#0A1324] border border-sky-400/50 text-[10px] font-semibold text-sky-200 whitespace-nowrap">
              Farol LED
            </span>
          </Html>
          <Html position={[-1.12, -0.32, 1.1]} center distanceFactor={8}>
            <span className="px-2 py-0.5 rounded bg-[#0A1324] border border-slate-400/50 text-[10px] font-semibold text-slate-200 whitespace-nowrap">
              Roda & Jante
            </span>
          </Html>
        </>
      )}
    </group>
  );
}

function MoleculeModel3D({ title, showLabels }: { title: string; showLabels: boolean }) {
  const lower = title.toLowerCase();
  const isCo2 = /co2|di[oó]xido/.test(lower);
  const isCh4 = /ch4|metano/.test(lower);

  const bonds: Array<{ start: [number, number, number]; end: [number, number, number] }> = isCo2
    ? [
        { start: [0, 0, 0], end: [-1.45, 0, 0] },
        { start: [0, 0, 0], end: [1.45, 0, 0] },
      ]
    : isCh4
    ? [
        { start: [0, 0, 0], end: [0, 1.35, 0] },
        { start: [0, 0, 0], end: [1.2, -0.5, 0.7] },
        { start: [0, 0, 0], end: [-1.2, -0.5, 0.7] },
        { start: [0, 0, 0], end: [0, -0.5, -1.25] },
      ]
    : [
        { start: [0, 0.3, 0], end: [-1.15, -0.52, 0] },
        { start: [0, 0.3, 0], end: [1.15, -0.52, 0] },
      ];

  const outerAtoms: Array<{ pos: [number, number, number]; color: string; r: number; label: string }> = isCo2
    ? [
        { pos: [-1.45, 0, 0], color: '#ef4444', r: 0.46, label: 'Oxigénio (O)' },
        { pos: [1.45, 0, 0], color: '#ef4444', r: 0.46, label: 'Oxigénio (O)' },
      ]
    : isCh4
    ? [
        { pos: [0, 1.35, 0], color: '#e2e8f0', r: 0.34, label: 'H' },
        { pos: [1.2, -0.5, 0.7], color: '#e2e8f0', r: 0.34, label: 'H' },
        { pos: [-1.2, -0.5, 0.7], color: '#e2e8f0', r: 0.34, label: 'H' },
        { pos: [0, -0.5, -1.25], color: '#e2e8f0', r: 0.34, label: 'H' },
      ]
    : [
        { pos: [-1.15, -0.52, 0], color: '#e2e8f0', r: 0.38, label: 'Hidrogénio (H)' },
        { pos: [1.15, -0.52, 0], color: '#e2e8f0', r: 0.38, label: 'Hidrogénio (H)' },
      ];

  const centerAtom = isCo2 || isCh4
    ? { pos: [0, 0, 0] as [number, number, number], color: '#334155', r: 0.56, label: 'Carbono (C)' }
    : { pos: [0, 0.3, 0] as [number, number, number], color: '#ef4444', r: 0.58, label: 'Oxigénio (O) — 104,5°' };

  return (
    <group>
      <mesh position={centerAtom.pos}>
        <sphereGeometry args={[centerAtom.r, 32, 32]} />
        <meshPhysicalMaterial color={centerAtom.color} metalness={0.3} roughness={0.22} clearcoat={0.8} />
      </mesh>
      {showLabels && (
        <Html position={[centerAtom.pos[0], centerAtom.pos[1] + 0.78, centerAtom.pos[2]]} center distanceFactor={8}>
          <span className="px-2 py-0.5 rounded bg-[#0A1324] border border-rose-400/50 text-[10px] font-semibold text-rose-200 whitespace-nowrap">
            {centerAtom.label}
          </span>
        </Html>
      )}
      {outerAtoms.map((atom, i) => (
        <group key={i}>
          <mesh position={atom.pos}>
            <sphereGeometry args={[atom.r, 28, 28]} />
            <meshPhysicalMaterial color={atom.color} metalness={0.25} roughness={0.2} clearcoat={0.75} />
          </mesh>
          {showLabels && (
            <Html position={[atom.pos[0], atom.pos[1] - 0.56, atom.pos[2]]} center distanceFactor={8}>
              <span className="px-1.5 py-0.5 rounded bg-[#0A1324] border border-cyan-400/40 text-[10px] font-semibold text-cyan-100 whitespace-nowrap">
                {atom.label}
              </span>
            </Html>
          )}
        </group>
      ))}
      {bonds.map((b, i) => {
        const s = new THREE.Vector3(...b.start);
        const e = new THREE.Vector3(...b.end);
        const dir = e.clone().sub(s);
        const len = dir.length();
        const mid = s.clone().add(e).multiplyScalar(0.5);
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        return (
          <mesh key={i} position={[mid.x, mid.y, mid.z]} quaternion={quat}>
            <cylinderGeometry args={[0.1, 0.1, len, 16]} />
            <meshStandardMaterial color="#38bdf8" metalness={0.65} roughness={0.25} />
          </mesh>
        );
      })}
    </group>
  );
}

function VectorsModel3D({
  dimensions,
  showLabels,
}: {
  dimensions: Record<string, number | string>;
  showLabels: boolean;
}) {
  const vx = Number(dimensions.vx ?? dimensions.x ?? 2.2) || 2.2;
  const vy = Number(dimensions.vy ?? dimensions.y ?? 1.7) || 1.7;
  const vz = Number(dimensions.vz ?? dimensions.z ?? 1.5) || 1.5;
  const scale = 2.1 / Math.max(Math.abs(vx), Math.abs(vy), Math.abs(vz), 1);

  const vectors: Array<{ to: [number, number, number]; color: string; label: string }> = [
    { to: [vx * scale, 0, 0], color: '#ef4444', label: `Fx = ${vx}` },
    { to: [0, vy * scale, 0], color: '#22c55e', label: `Fy = ${vy}` },
    { to: [0, 0, vz * scale], color: '#38bdf8', label: `Fz = ${vz}` },
    {
      to: [vx * scale, vy * scale, vz * scale],
      color: '#f59e0b',
      label: `Resultante R = ${Math.sqrt(vx * vx + vy * vy + vz * vz).toFixed(2)}`,
    },
  ];

  return (
    <group position={[0, -0.7, 0]}>
      <mesh>
        <sphereGeometry args={[0.11, 20, 20]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.6} roughness={0.2} />
      </mesh>
      {vectors.map((vec, i) => {
        const dir = new THREE.Vector3(...vec.to);
        const len = Math.max(dir.length(), 0.2);
        const mid = dir.clone().multiplyScalar(0.5);
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.clone().normalize()
        );
        return (
          <group key={i}>
            <mesh position={[mid.x, mid.y, mid.z]} quaternion={quat}>
              <cylinderGeometry args={[0.045, 0.045, len, 12]} />
              <meshStandardMaterial color={vec.color} emissive={vec.color} emissiveIntensity={0.35} />
            </mesh>
            <mesh position={vec.to} quaternion={quat}>
              <coneGeometry args={[0.13, 0.34, 14]} />
              <meshStandardMaterial color={vec.color} emissive={vec.color} emissiveIntensity={0.45} />
            </mesh>
            {showLabels && (
              <Html position={[vec.to[0] * 1.08, vec.to[1] + 0.16, vec.to[2] * 1.08]} center distanceFactor={8}>
                <span
                  className="px-2 py-0.5 rounded bg-[#0A1324] text-[10px] font-bold font-mono whitespace-nowrap"
                  style={{ color: vec.color, border: `1px solid ${vec.color}` }}
                >
                  {vec.label}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Chart3DModel({
  dimensions,
  showLabels,
}: {
  dimensions: Record<string, number | string>;
  showLabels: boolean;
}) {
  const entries = useMemo(() => {
    const raw = Object.entries(dimensions)
      .filter(([, v]) => Number.isFinite(Number(v)))
      .slice(0, 6);
    if (raw.length > 0) {
      return raw.map(([k, v]) => ({ label: k, value: Number(v) }));
    }
    return [
      { label: 'Q1', value: 42 },
      { label: 'Q2', value: 68 },
      { label: 'Q3', value: 55 },
      { label: 'Q4', value: 91 },
    ];
  }, [dimensions]);

  const maxVal = Math.max(...entries.map((e) => Math.abs(e.value)), 1);
  const colors = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <group position={[0, -1.35, 0]}>
      {entries.map((e, idx) => {
        const h = Math.max(0.35, (Math.abs(e.value) / maxVal) * 2.5);
        const x = (idx - (entries.length - 1) / 2) * 0.9;
        const c = colors[idx % colors.length];
        return (
          <group key={e.label} position={[x, h / 2, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.58, h, 0.58]} />
              <meshPhysicalMaterial color={c} metalness={0.5} roughness={0.22} clearcoat={0.7} />
            </mesh>
            {showLabels && (
              <Html position={[0, h / 2 + 0.25, 0]} center distanceFactor={8}>
                <span className="px-1.5 py-0.5 rounded bg-[#0A1324] border border-cyan-400/50 text-[10px] font-mono font-bold text-white whitespace-nowrap">
                  {e.label}: {e.value}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Cartesian3DModel({ showLabels }: { showLabels: boolean }) {
  const points: Array<{ p: [number, number, number]; label: string; color: string }> = [
    { p: [1.4, 1.2, 0.8], label: 'P(2, 2, 1)', color: '#38bdf8' },
    { p: [-1.1, 1.6, -0.9], label: 'Q(-1, 2.5, -1)', color: '#10b981' },
    { p: [0.8, 0.5, -1.5], label: 'R(1, 0.8, -2)', color: '#f59e0b' },
  ];
  return (
    <group position={[0, -0.4, 0]}>
      {points.map((pt) => (
        <group key={pt.label} position={pt.p}>
          <mesh>
            <sphereGeometry args={[0.14, 24, 24]} />
            <meshStandardMaterial color={pt.color} emissive={pt.color} emissiveIntensity={0.45} />
          </mesh>
          {showLabels && (
            <Html position={[0, 0.28, 0]} center distanceFactor={8}>
              <span
                className="px-2 py-0.5 rounded bg-[#0A1324] text-[10px] font-mono font-bold whitespace-nowrap"
                style={{ color: pt.color, border: `1px solid ${pt.color}` }}
              >
                {pt.label}
              </span>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}

function ClassicSolidMesh({
  shape,
  dimensions,
  unit,
  showLabels,
}: {
  shape: Jarvis3DShape;
  dimensions: Record<string, number | string>;
  unit: string;
  showLabels: boolean;
}) {
  const dimText = Object.entries(dimensions)
    .slice(0, 3)
    .map(([k, v]) => `${k}=${v}${unit}`)
    .join(' · ');

  const renderSolid = () => {
    switch (shape) {
      case 'cuboid':
        return <boxGeometry args={[2.5, 1.45, 1.75]} />;
      case 'sphere':
        return <sphereGeometry args={[1.25, 42, 42]} />;
      case 'cylinder':
        return <cylinderGeometry args={[1.05, 1.05, 2.1, 42]} />;
      case 'cone':
        return <coneGeometry args={[1.2, 2.2, 42]} />;
      case 'pyramid':
        return <coneGeometry args={[1.35, 2.1, 4]} />;
      case 'prism':
        return <cylinderGeometry args={[1.2, 1.2, 2.1, 3]} />;
      case 'octahedron':
        return <octahedronGeometry args={[1.35, 0]} />;
      case 'torus':
        return <torusGeometry args={[1.1, 0.36, 28, 56]} />;
      default:
        return <boxGeometry args={[1.8, 1.8, 1.8]} />;
    }
  };

  if (shape === 'atom') {
    return (
      <group>
        <mesh>
          <sphereGeometry args={[0.42, 32, 32]} />
          <meshPhysicalMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.4} roughness={0.2} metalness={0.4} />
        </mesh>
        {[0, Math.PI / 3, -Math.PI / 3].map((rot, i) => (
          <group key={i} rotation={[rot, i * 0.6, rot * 0.5]}>
            <mesh>
              <torusGeometry args={[1.55, 0.025, 12, 64]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[1.55, 0, 0]}>
              <sphereGeometry args={[0.11, 18, 18]} />
              <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.85} />
            </mesh>
          </group>
        ))}
        {showLabels && (
          <Html position={[0, 1.9, 0]} center distanceFactor={8}>
            <span className="px-2 py-0.5 rounded bg-[#0A1324] border border-cyan-400/50 text-[10px] font-semibold text-cyan-200 whitespace-nowrap">
              Núcleo & Orbitais
            </span>
          </Html>
        )}
      </group>
    );
  }

  return (
    <group>
      <mesh castShadow receiveShadow>
        {renderSolid()}
        <meshPhysicalMaterial
          color="#0284c7"
          metalness={0.58}
          roughness={0.22}
          clearcoat={0.75}
          clearcoatRoughness={0.14}
        />
      </mesh>
      <mesh scale={1.004}>
        {renderSolid()}
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.32} />
      </mesh>
      {showLabels && dimText && (
        <Html position={[0, 1.48, 0]} center distanceFactor={8}>
          <span className="px-2 py-0.5 rounded bg-[#0A1324] border border-cyan-400/60 text-[10px] font-mono font-semibold text-cyan-200 whitespace-nowrap">
            {dimText}
          </span>
        </Html>
      )}
    </group>
  );
}

function Sara3DSceneContent({
  shape,
  title,
  dimensions,
  unit,
  autoRotate,
  showAxes,
  showLabels,
  zoomCommand,
  resetTick,
}: {
  shape: Jarvis3DShape;
  title: string;
  dimensions: Record<string, number | string>;
  unit: string;
  autoRotate: boolean;
  showAxes: boolean;
  showLabels: boolean;
  zoomCommand: { delta: number; seq: number } | null;
  resetTick: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.42;
    }
  });

  useEffect(() => {
    camera.position.set(3.8, 2.35, 4.4);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [resetTick, shape, camera]);

  useEffect(() => {
    if (!zoomCommand) return;
    const dir = camera.position.clone().normalize();
    const dist = camera.position.length();
    const nextDist = Math.max(2.3, Math.min(11, dist + zoomCommand.delta));
    camera.position.copy(dir.multiplyScalar(nextDist));
    controlsRef.current?.update();
  }, [zoomCommand, camera]);

  return (
    <>
      <color attach="background" args={['#060D1A']} />
      <fog attach="fog" args={['#060D1A', 9, 22]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#bae6fd', '#0f172a', 0.75]} />
      <directionalLight position={[5, 7, 5]} intensity={1.7} color="#fff7ed" castShadow />
      <directionalLight position={[-5, 3, -4]} intensity={0.85} color="#38bdf8" />
      <pointLight position={[0, -2, 3]} intensity={0.5} color="#06b6d4" />

      <AxesAndGrid showAxes={showAxes} />

      <group ref={groupRef}>
        {shape === 'car' ? (
          <CarModel3D showLabels={showLabels} />
        ) : shape === 'molecule' ? (
          <MoleculeModel3D title={title} showLabels={showLabels} />
        ) : shape === 'vectors' ? (
          <VectorsModel3D dimensions={dimensions} showLabels={showLabels} />
        ) : shape === 'chart3d' ? (
          <Chart3DModel dimensions={dimensions} showLabels={showLabels} />
        ) : shape === 'cartesian' ? (
          <Cartesian3DModel showLabels={showLabels} />
        ) : (
          <ClassicSolidMesh
            shape={shape}
            dimensions={dimensions}
            unit={unit}
            showLabels={showLabels}
          />
        )}
      </group>

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.07}
        minDistance={2.2}
        maxDistance={12}
      />
    </>
  );
}

function Isometric2DFallback({ shape, title }: { shape: Jarvis3DShape; title: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#060D1A] text-cyan-200 p-4 text-center">
      <div className="w-24 h-24 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center mb-3">
        <Axis3D className="w-10 h-10 text-cyan-300" />
      </div>
      <div className="text-sm font-bold text-white">{title}</div>
      <div className="text-xs text-slate-400 mt-1">
        Modelo 3D ({shape}) pronto em vista simplificada neste dispositivo.
      </div>
    </div>
  );
}

export const Sara3DDrawingStudio: React.FC<Sara3DDrawingStudioProps> = ({
  shape,
  title,
  subtitle,
  dimensions = {},
  unit = 'cm',
}) => {
  const [autoRotate, setAutoRotate] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [zoomCommand, setZoomCommand] = useState<{ delta: number; seq: number } | null>(null);
  const [resetTick, setResetTick] = useState(0);
  const webglReady = useMemo(() => checkWebGLAvailable(), []);

  const dimEntries = Object.entries(dimensions || {});

  return (
    <div className="rounded-xl border border-cyan-500/35 bg-[#060D1A] overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-cyan-500/20 bg-[#0A1526] flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
            Desenho 3D da SARA
          </div>
          <div className="text-xs font-semibold text-white">{title}</div>
          {subtitle && <div className="text-[11px] text-slate-400">{subtitle}</div>}
        </div>
        {dimEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-cyan-200">
            {dimEntries.slice(0, 4).map(([k, v]) => (
              <span key={k} className="px-2 py-0.5 rounded bg-[#0F1F38] border border-cyan-500/30">
                {k}: {v} {unit}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="relative h-[340px] w-full bg-[#060D1A]">
        {webglReady ? (
          <ThreeCanvasErrorBoundary fallback={<Isometric2DFallback shape={shape} title={title} />}>
            <Canvas
              shadows
              dpr={[1, 2]}
              camera={{ position: [3.8, 2.35, 4.4], fov: 45 }}
              gl={{ antialias: true, preserveDrawingBuffer: true }}
            >
              <Sara3DSceneContent
                shape={shape}
                title={title}
                dimensions={dimensions}
                unit={unit}
                autoRotate={autoRotate}
                showAxes={showAxes}
                showLabels={showLabels}
                zoomCommand={zoomCommand}
                resetTick={resetTick}
              />
            </Canvas>
          </ThreeCanvasErrorBoundary>
        ) : (
          <Isometric2DFallback shape={shape} title={title} />
        )}

        {/* Controls Dock — bottom center, NO backdrop-blur over WebGL */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#091224]/95 border border-cyan-500/35 shadow-lg">
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0F1E36] hover:bg-cyan-500/20 text-[11px] font-semibold text-cyan-100 whitespace-nowrap"
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoRotate ? 'Pausar' : 'Girar'}</span>
          </button>
          <button
            type="button"
            onClick={() => setZoomCommand((z) => ({ delta: -0.7, seq: (z?.seq || 0) + 1 }))}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0F1E36] hover:bg-cyan-500/20 text-[11px] font-semibold text-slate-200 whitespace-nowrap"
            title="Aproximar"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomCommand((z) => ({ delta: 0.7, seq: (z?.seq || 0) + 1 }))}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0F1E36] hover:bg-cyan-500/20 text-[11px] font-semibold text-slate-200 whitespace-nowrap"
            title="Afastar"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setResetTick((t) => t + 1)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0F1E36] hover:bg-cyan-500/20 text-[11px] font-semibold text-slate-200 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAxes((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap ${
              showAxes ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40' : 'bg-[#0F1E36] text-slate-400'
            }`}
          >
            <Axis3D className="w-3.5 h-3.5" />
            <span>Eixos</span>
          </button>
          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap ${
              showLabels ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40' : 'bg-[#0F1E36] text-slate-400'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Etiquetas</span>
          </button>
        </div>
      </div>
    </div>
  );
};
