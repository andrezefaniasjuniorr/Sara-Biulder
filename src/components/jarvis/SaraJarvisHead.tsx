import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { JarvisHeadMood } from '../../types/jarvis';

interface SaraJarvisHeadProps {
  mood: JarvisHeadMood;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  size?: 'full' | 'split' | 'corner';
  onClickHead?: () => void;
}

const _vTmp = new THREE.Vector3();
const _cCyan = new THREE.Color('#00E5FF');
const _cCrimson = new THREE.Color('#FF2A4B');
const _cEmerald = new THREE.Color('#10B981');
const _cIce = new THREE.Color('#E0F7FF');

function probeWebGLSupport(): { supported: boolean; isSoftware: boolean } {
  if (typeof document === 'undefined') return { supported: false, isSoftware: true };
  try {
    const testCanvas = document.createElement('canvas');
    const gl =
      (testCanvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (testCanvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return { supported: false, isSoftware: true };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
      : '';
    const isSoftware = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(renderer);
    const loseExt = gl.getExtension('WEBGL_lose_context');
    loseExt?.loseContext();
    return { supported: true, isSoftware };
  } catch {
    return { supported: false, isSoftware: true };
  }
}

export const SaraJarvisHead: React.FC<SaraJarvisHeadProps> = ({
  mood,
  isSpeaking,
  isListening,
  isThinking,
  size = 'full',
  onClickHead,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [useCanvasFallback, setUseCanvasFallback] = useState(false);

  // Refs mutáveis para ler estado reativo dentro do loop 3D sem recriar a cena WebGL
  const stateRef = useRef({
    mood,
    isSpeaking,
    isListening,
    isThinking,
    targetYaw: 0,
    targetPitch: 0,
  });

  useEffect(() => {
    stateRef.current.mood = mood;
    stateRef.current.isSpeaking = isSpeaking;
    stateRef.current.isListening = isListening;
    stateRef.current.isThinking = isThinking;
  }, [mood, isSpeaking, isListening, isThinking]);

  // Cena WebGL Three.js Real 3D (Cabeça feminina aos ombros + anéis orbitais + diamante + olhos + voz)
  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const { supported, isSoftware } = probeWebGLSupport();
    if (!supported) {
      setUseCanvasFallback(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftware,
        alpha: true,
        powerPreference: isSoftware ? 'low-power' : 'high-performance',
      });
    } catch {
      setUseCanvasFallback(true);
      return;
    }

    const width = Math.max(120, mountEl.clientWidth || (size === 'corner' ? 124 : size === 'split' ? 240 : 380));
    const height = Math.max(130, mountEl.clientHeight || (size === 'corner' ? 132 : size === 'split' ? 275 : 400));

    renderer.setPixelRatio(isSoftware ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setUseCanvasFallback(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 40);
    camera.position.set(0, 0.08, size === 'corner' ? 4.4 : 4.25);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();

    // Iluminação cinematográfica Stark
    const hemiLight = new THREE.HemisphereLight('#67E8F9', '#1E1B4B', 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#00E5FF', 2.0);
    keyLight.position.set(2.4, 2.8, 3.2);
    scene.add(keyLight);

    const rimCrimson = new THREE.DirectionalLight('#FF2A4B', 1.65);
    rimCrimson.position.set(-2.6, 0.6, -2.0);
    scene.add(rimCrimson);

    const coreLight = new THREE.PointLight('#00E5FF', 1.8, 6);
    coreLight.position.set(0, -0.78, 0.9);
    scene.add(coreLight);

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Materiais holográficos partilhados
    const holoSkinMat = track(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#073250'),
        emissive: new THREE.Color('#006B8F'),
        emissiveIntensity: 0.48,
        roughness: 0.2,
        metalness: 0.18,
        transmission: 0.38,
        transparent: true,
        opacity: 0.56,
        clearcoat: 0.85,
        clearcoatRoughness: 0.15,
        side: THREE.DoubleSide,
      })
    );

    const holoWireMat = track(
      new THREE.LineBasicMaterial({
        color: '#00E5FF',
        transparent: true,
        opacity: 0.42,
      })
    );

    const crimsonWireMat = track(
      new THREE.LineBasicMaterial({
        color: '#FF2A4B',
        transparent: true,
        opacity: 0.72,
      })
    );

    const armorMat = track(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#061D36'),
        emissive: new THREE.Color('#00486E'),
        emissiveIntensity: 0.42,
        roughness: 0.25,
        metalness: 0.55,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      })
    );

    // =========================================================
    // 1. GRUPO DA CABEÇA FEMININA ESCULPIDA EM 3D
    // =========================================================
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.28, 0);
    rootGroup.add(headPivot);

    // Perfil Lathe delicado (queixo -> maxilar -> maçãs do rosto -> testa -> coroa)
    const faceProfile: THREE.Vector2[] = [
      new THREE.Vector2(0.01, -0.62),
      new THREE.Vector2(0.14, -0.6),
      new THREE.Vector2(0.28, -0.5),
      new THREE.Vector2(0.39, -0.32),
      new THREE.Vector2(0.47, -0.1),
      new THREE.Vector2(0.51, 0.12),
      new THREE.Vector2(0.5, 0.34),
      new THREE.Vector2(0.43, 0.54),
      new THREE.Vector2(0.29, 0.68),
      new THREE.Vector2(0.12, 0.75),
      new THREE.Vector2(0.0, 0.77),
    ];
    const headGeo = track(new THREE.LatheGeometry(faceProfile, isSoftware ? 22 : 30));
    // Afinar lateralmente e alongar ligeiramente em Z para formato cranial feminino realista
    const posAttr = headGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const jawTaper = y < 0 ? 0.88 + 0.12 * ((y + 0.62) / 0.62) : 1.0;
      const frontFlatten = z > 0 ? 0.94 : 1.05;
      posAttr.setXYZ(i, x * 0.84 * jawTaper, y, z * 0.96 * frontFlatten);
    }
    headGeo.computeVertexNormals();

    const headMesh = new THREE.Mesh(headGeo, holoSkinMat);
    headPivot.add(headMesh);

    const headWireGeo = track(new THREE.WireframeGeometry(headGeo));
    const headWire = new THREE.LineSegments(headWireGeo, holoWireMat);
    headWire.scale.setScalar(1.006);
    headPivot.add(headWire);

    // Aura de pontos neurais na superfície da cabeça
    const headPtsMat = track(
      new THREE.PointsMaterial({
        color: '#67E8F9',
        size: size === 'corner' ? 0.022 : 0.017,
        transparent: true,
        opacity: 0.7,
      })
    );
    const headPoints = new THREE.Points(headGeo, headPtsMat);
    headPoints.scale.setScalar(1.012);
    headPivot.add(headPoints);

    // Cabelo / Diadema holográfico lateral e posterior Stark feminino
    const crownArcGeo = track(new THREE.TorusGeometry(0.49, 0.024, 10, 40, Math.PI * 1.28));
    const crownArc = new THREE.Mesh(crownArcGeo, armorMat);
    crownArc.position.set(0, 0.24, -0.02);
    crownArc.rotation.set(0.32, 0, -Math.PI * 0.14);
    headPivot.add(crownArc);

    const hairPlateGeo = track(
      new THREE.SphereGeometry(0.555, 22, 18, Math.PI * 0.68, Math.PI * 1.64, 0.18, Math.PI * 0.72)
    );
    const hairPlate = new THREE.Mesh(hairPlateGeo, armorMat);
    hairPlate.position.set(0, 0.1, -0.06);
    hairPlate.scale.set(0.88, 1.12, 0.95);
    headPivot.add(hairPlate);

    const hairWireGeo = track(new THREE.WireframeGeometry(hairPlateGeo));
    const hairWire = new THREE.LineSegments(hairWireGeo, crimsonWireMat);
    hairWire.position.copy(hairPlate.position);
    hairWire.scale.copy(hairPlate.scale).multiplyScalar(1.01);
    headPivot.add(hairWire);

    // Transdutores auriculares Stark (esquerdo e direito)
    const earGeo = track(new THREE.CylinderGeometry(0.085, 0.065, 0.06, 6));
    const earMat = track(
      new THREE.MeshStandardMaterial({
        color: '#FF2A4B',
        emissive: '#FF2A4B',
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.7,
      })
    );
    const leftEar = new THREE.Mesh(earGeo, earMat);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(-0.46, 0.02, -0.02);
    headPivot.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, earMat);
    rightEar.rotation.z = Math.PI / 2;
    rightEar.position.set(0.46, 0.02, -0.02);
    headPivot.add(rightEar);

    // Ponte nasal delicada em 3D
    const noseGeo = track(new THREE.ConeGeometry(0.045, 0.22, 4));
    const noseMesh = new THREE.Mesh(noseGeo, holoSkinMat);
    noseMesh.position.set(0, -0.04, 0.465);
    noseMesh.rotation.x = 0.24;
    noseMesh.scale.set(0.75, 1.0, 0.9);
    headPivot.add(noseMesh);

    // Diamante luminoso na testa (pulsa quando isThinking)
    const diamondGeo = track(new THREE.OctahedronGeometry(0.068, 0));
    const diamondMat = track(
      new THREE.MeshStandardMaterial({
        color: '#00E5FF',
        emissive: '#00E5FF',
        emissiveIntensity: 2.1,
        roughness: 0.1,
        metalness: 0.3,
      })
    );
    const foreheadDiamond = new THREE.Mesh(diamondGeo, diamondMat);
    foreheadDiamond.position.set(0, 0.39, 0.445);
    foreheadDiamond.scale.set(0.75, 1.25, 0.55);
    headPivot.add(foreheadDiamond);

    // =========================================================
    // 2. OLHOS CIANO SIMÉTRICOS (PISCAM E SEGUEM O OLHAR)
    // =========================================================
    const eyeSocketGeo = track(new THREE.TorusGeometry(0.068, 0.011, 8, 24));
    const eyeRimMat = track(
      new THREE.MeshStandardMaterial({
        color: '#00E5FF',
        emissive: '#00E5FF',
        emissiveIntensity: 1.4,
      })
    );
    const irisGeo = track(new THREE.SphereGeometry(0.046, 16, 12));
    const irisMat = track(
      new THREE.MeshStandardMaterial({
        color: '#ECFEFF',
        emissive: '#00E5FF',
        emissiveIntensity: 2.2,
      })
    );
    const browGeo = track(new THREE.BoxGeometry(0.16, 0.015, 0.02));

    const createEyeAssembly = (side: -1 | 1) => {
      const group = new THREE.Group();
      group.position.set(side * 0.175, 0.11, 0.415);
      group.rotation.y = side * 0.22;

      const rim = new THREE.Mesh(eyeSocketGeo, eyeRimMat);
      rim.scale.set(1.25, 0.72, 0.5);
      group.add(rim);

      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.scale.set(1, 1, 0.45);
      iris.position.z = 0.01;
      group.add(iris);

      const brow = new THREE.Mesh(browGeo, eyeRimMat);
      brow.position.set(0, 0.095, 0.01);
      brow.rotation.z = side * -0.14;
      group.add(brow);

      headPivot.add(group);
      return { group, rim, iris };
    };

    const leftEye = createEyeAssembly(-1);
    const rightEye = createEyeAssembly(1);

    // =========================================================
    // 3. BOCA HOLOGRÁFICA E BARRAS SINCRONIZADAS À VOZ
    // =========================================================
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.27, 0.43);
    headPivot.add(mouthGroup);

    const lipLineGeo = track(new THREE.BoxGeometry(0.24, 0.01, 0.02));
    const lipLineMat = track(
      new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        emissive: '#00E5FF',
        emissiveIntensity: 1.3,
      })
    );
    const lipLine = new THREE.Mesh(lipLineGeo, lipLineMat);
    mouthGroup.add(lipLine);

    const mouthBars: THREE.Mesh[] = [];
    const barGeo = track(new THREE.BoxGeometry(0.018, 0.016, 0.024));
    const barCyanMat = track(
      new THREE.MeshStandardMaterial({
        color: '#00E5FF',
        emissive: '#00E5FF',
        emissiveIntensity: 1.8,
      })
    );
    const barRedMat = track(
      new THREE.MeshStandardMaterial({
        color: '#FF2A4B',
        emissive: '#FF2A4B',
        emissiveIntensity: 1.8,
      })
    );

    for (let i = -3; i <= 3; i++) {
      const m = new THREE.Mesh(barGeo, Math.abs(i) === 2 ? barRedMat : barCyanMat);
      m.position.set(i * 0.032, 0, 0.008);
      mouthGroup.add(m);
      mouthBars.push(m);
    }

    // =========================================================
    // 4. PESCOÇO, OMBROS, BUSTO & NÚCLEO ARC REACTOR STARK
    // =========================================================
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, -0.42, 0);
    rootGroup.add(torsoGroup);

    const neckGeo = track(new THREE.CylinderGeometry(0.16, 0.21, 0.42, 20, 4, true));
    const neckMesh = new THREE.Mesh(neckGeo, holoSkinMat);
    neckMesh.position.set(0, 0.1, -0.02);
    torsoGroup.add(neckMesh);

    const neckWireGeo = track(new THREE.WireframeGeometry(neckGeo));
    const neckWire = new THREE.LineSegments(neckWireGeo, holoWireMat);
    neckWire.position.copy(neckMesh.position);
    torsoGroup.add(neckWire);

    // Busto & Ombros esculpidos via Lathe elíptica
    const chestGeo = track(new THREE.CylinderGeometry(0.32, 0.72, 0.74, 24, 5, true));
    const chestPos = chestGeo.attributes.position;
    for (let i = 0; i < chestPos.count; i++) {
      const x = chestPos.getX(i);
      const y = chestPos.getY(i);
      const z = chestPos.getZ(i);
      // Abrir largura dos ombros e suavizar profundidade
      const shoulderFlare = y > -0.1 ? 1.55 : 1.35;
      chestPos.setXYZ(i, x * shoulderFlare, y, z * 0.56);
    }
    chestGeo.computeVertexNormals();

    const chestMesh = new THREE.Mesh(chestGeo, armorMat);
    chestMesh.position.set(0, -0.44, -0.03);
    torsoGroup.add(chestMesh);

    const chestWireGeo = track(new THREE.WireframeGeometry(chestGeo));
    const chestWire = new THREE.LineSegments(chestWireGeo, holoWireMat);
    chestWire.position.copy(chestMesh.position);
    chestWire.scale.setScalar(1.006);
    torsoGroup.add(chestWire);

    // Ombreiras luminosas esquerda/direita em ciano + vermelho
    const pauldronGeo = track(new THREE.TorusGeometry(0.28, 0.018, 8, 20, Math.PI * 0.85));
    const pauldronMat = track(
      new THREE.MeshStandardMaterial({
        color: '#FF2A4B',
        emissive: '#FF2A4B',
        emissiveIntensity: 1.5,
      })
    );
    const leftPauldron = new THREE.Mesh(pauldronGeo, pauldronMat);
    leftPauldron.position.set(-0.66, -0.26, 0.04);
    leftPauldron.rotation.set(0.25, 0.45, Math.PI * 0.65);
    torsoGroup.add(leftPauldron);

    const rightPauldron = new THREE.Mesh(pauldronGeo, pauldronMat);
    rightPauldron.position.set(0.66, -0.26, 0.04);
    rightPauldron.rotation.set(0.25, -0.45, Math.PI * 0.35);
    torsoGroup.add(rightPauldron);

    // Núcleo Arc Reactor no peito
    const reactorRingGeo = track(new THREE.TorusGeometry(0.145, 0.016, 10, 28));
    const reactorRing = new THREE.Mesh(reactorRingGeo, eyeRimMat);
    reactorRing.position.set(0, -0.46, 0.35);
    torsoGroup.add(reactorRing);

    const reactorTriGeo = track(new THREE.CircleGeometry(0.105, 3));
    const reactorTriMat = track(
      new THREE.MeshStandardMaterial({
        color: '#E0F2FE',
        emissive: '#00E5FF',
        emissiveIntensity: 2.3,
        side: THREE.DoubleSide,
      })
    );
    const reactorCore = new THREE.Mesh(reactorTriGeo, reactorTriMat);
    reactorCore.position.set(0, -0.46, 0.355);
    reactorCore.rotation.z = Math.PI;
    torsoGroup.add(reactorCore);

    // Feixe de varrimento horizontal que sobe pelo holograma
    const scanRingGeo = track(new THREE.TorusGeometry(0.76, 0.008, 6, 48));
    const scanRingMat = track(
      new THREE.MeshBasicMaterial({
        color: '#00E5FF',
        transparent: true,
        opacity: 0.42,
      })
    );
    const scanRing = new THREE.Mesh(scanRingGeo, scanRingMat);
    scanRing.rotation.x = Math.PI / 2;
    rootGroup.add(scanRing);

    // =========================================================
    // 5. TRÊS ANÉIS ORBITAIS HUD STARK + PARTÍCULAS
    // =========================================================
    const orbitGroup = new THREE.Group();
    rootGroup.add(orbitGroup);

    const ring1Geo = track(new THREE.TorusGeometry(1.18, 0.011, 8, 72));
    const ring1Mat = track(
      new THREE.MeshBasicMaterial({ color: '#00E5FF', transparent: true, opacity: 0.48 })
    );
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.set(Math.PI * 0.42, 0.18, 0);
    orbitGroup.add(ring1);

    const ring2Geo = track(new THREE.TorusGeometry(1.36, 0.009, 8, 72));
    const ring2Mat = track(
      new THREE.MeshBasicMaterial({ color: '#FF2A4B', transparent: true, opacity: 0.44 })
    );
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.set(-Math.PI * 0.36, -0.24, 0.3);
    orbitGroup.add(ring2);

    const ring3Geo = track(new THREE.TorusGeometry(1.52, 0.007, 8, 84));
    const ring3Mat = track(
      new THREE.MeshBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.28 })
    );
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3.rotation.set(Math.PI * 0.48, -0.08, 0);
    orbitGroup.add(ring3);

    // Marcadores luminosos nos anéis orbitais
    const markerGeo = track(new THREE.SphereGeometry(0.032, 10, 10));
    const markerCyan = new THREE.Mesh(markerGeo, eyeRimMat);
    markerCyan.position.set(1.18, 0, 0);
    ring1.add(markerCyan);

    const markerRed = new THREE.Mesh(markerGeo, earMat);
    markerRed.position.set(-1.36, 0, 0);
    ring2.add(markerRed);

    // Partículas holográficas ao redor
    const particleCount = isSoftware ? 70 : size === 'corner' ? 50 : 120;
    const pPositions = new Float32Array(particleCount * 3);
    const pColors = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const ang = (i / particleCount) * Math.PI * 2 * 3;
      const rad = 0.85 + Math.random() * 0.85;
      pPositions[i * 3] = Math.cos(ang) * rad;
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 2.1;
      pPositions[i * 3 + 2] = Math.sin(ang) * rad;
      const col = i % 4 === 0 ? _cCrimson : _cCyan;
      pColors[i * 3] = col.r;
      pColors[i * 3 + 1] = col.g;
      pColors[i * 3 + 2] = col.b;
    }
    const pGeo = track(new THREE.BufferGeometry());
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
    const pMat = track(
      new THREE.PointsMaterial({
        size: size === 'corner' ? 0.035 : 0.025,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
      })
    );
    const particleCloud = new THREE.Points(pGeo, pMat);
    orbitGroup.add(particleCloud);

    // Redimensionamento responsivo com ResizeObserver
    const handleResize = () => {
      if (!mountEl) return;
      const w = Math.max(120, mountEl.clientWidth);
      const h = Math.max(130, mountEl.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const resizeObs =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObs?.observe(mountEl);

    // Estado de piscar natural & loop de animação
    let rafId = 0;
    let nextBlinkAt = 1.8 + Math.random() * 2.8;
    let blinkProgress = 0;
    let lastTime = performance.now() * 0.001;
    let currentYaw = 0;
    let currentPitch = 0;

    const animate = (nowMs: number) => {
      const t = nowMs * 0.001;
      const dt = Math.min(0.05, Math.max(0.001, t - lastTime));
      lastTime = t;

      const s = stateRef.current;

      // Flutuação holográfica suave
      rootGroup.position.y = Math.sin(t * 1.9) * 0.045;

      // Piscar natural dos olhos
      if (t >= nextBlinkAt) {
        blinkProgress += dt * 9.5;
        if (blinkProgress >= Math.PI) {
          blinkProgress = 0;
          nextBlinkAt = t + 2.3 + Math.random() * 3.1;
        }
      }
      const blinkScale = blinkProgress > 0 ? Math.max(0.08, Math.cos(blinkProgress * 0.5) ** 2) : 1;

      // Olhar e inclinação suave da cabeça
      const goalYaw = s.isThinking
        ? Math.sin(t * 2.1) * 0.16
        : s.isSpeaking
        ? Math.sin(t * 2.8) * 0.09 + s.targetYaw * 0.65
        : s.targetYaw;
      const goalPitch = s.isSpeaking
        ? Math.sin(t * 4.2) * 0.045 + s.targetPitch * 0.6
        : s.isThinking
        ? -0.06
        : s.targetPitch;

      currentYaw += (goalYaw - currentYaw) * Math.min(1, dt * 6);
      currentPitch += (goalPitch - currentPitch) * Math.min(1, dt * 6);
      headPivot.rotation.y = currentYaw;
      headPivot.rotation.x = currentPitch;

      leftEye.rim.scale.y = 0.72 * blinkScale;
      rightEye.rim.scale.y = 0.72 * blinkScale;
      leftEye.iris.scale.y = blinkScale;
      rightEye.iris.scale.y = blinkScale;
      leftEye.iris.position.x = currentYaw * 0.045;
      rightEye.iris.position.x = currentYaw * 0.045;
      leftEye.iris.position.y = -currentPitch * 0.03;
      rightEye.iris.position.y = -currentPitch * 0.03;

      // Cores e brilho reativos ao estado (Pensando / Falando / Ouvindo)
      const targetColor = s.isThinking ? _cCrimson : s.isListening ? _cEmerald : _cCyan;
      diamondMat.color.lerp(targetColor, dt * 6);
      diamondMat.emissive.lerp(targetColor, dt * 6);
      diamondMat.emissiveIntensity = s.isThinking
        ? 1.9 + Math.abs(Math.sin(t * 8)) * 2.1
        : s.isSpeaking
        ? 2.2
        : 1.5;
      foreheadDiamond.rotation.y = t * (s.isThinking ? 3.5 : 1.1);

      eyeRimMat.color.lerp(s.isListening ? _cEmerald : _cCyan, dt * 5);
      eyeRimMat.emissive.lerp(s.isThinking ? _cCrimson : s.isListening ? _cEmerald : _cCyan, dt * 5);
      irisMat.emissive.lerp(s.isThinking ? _cCrimson : _cIce, dt * 4);

      coreLight.color.lerp(targetColor, dt * 5);
      coreLight.intensity = s.isSpeaking
        ? 2.1 + Math.abs(Math.sin(t * 10)) * 1.1
        : s.isThinking
        ? 2.4
        : 1.6;
      reactorCore.rotation.z = Math.PI + t * (s.isThinking ? 1.8 : 0.3);

      // Boca: imóvel e serena em silêncio; equalizador vivo ONLY when isSpeaking === true
      if (s.isSpeaking) {
        const amp = 0.45 + 0.55 * Math.abs(Math.sin(t * 14));
        lipLine.scale.y = 1 + amp * 0.6;
        for (let i = 0; i < mouthBars.length; i++) {
          const distCenter = 1 - Math.abs(i - 3) / 4.2;
          const wave = Math.abs(Math.sin(t * 18 + i * 0.9));
          mouthBars[i].scale.y = 1 + distCenter * (2.2 + wave * 5.2) * amp;
        }
      } else {
        lipLine.scale.y = 1;
        for (let i = 0; i < mouthBars.length; i++) {
          mouthBars[i].scale.y += (1 - mouthBars[i].scale.y) * Math.min(1, dt * 12);
        }
      }

      // Rotação dos anéis HUD orbitais e partículas
      const ringSpeed = s.isThinking ? 2.4 : s.isSpeaking ? 1.55 : 0.7;
      ring1.rotation.z += dt * 0.45 * ringSpeed;
      ring2.rotation.z -= dt * 0.36 * ringSpeed;
      ring3.rotation.z += dt * 0.22 * ringSpeed;
      particleCloud.rotation.y += dt * 0.25 * ringSpeed;

      // Varrimento holográfico vertical
      const scanPhase = ((t * (s.isThinking ? 0.65 : 0.28)) % 1) * 1.75 - 0.85;
      scanRing.position.y = scanPhase;
      const scanRadiusScale = scanPhase > 0 ? 0.74 : 0.98;
      scanRing.scale.setScalar(scanRadiusScale);
      scanRingMat.color.lerp(s.isThinking ? _cCrimson : _cCyan, dt * 6);
      scanRingMat.opacity = s.isThinking ? 0.62 : 0.34;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObs?.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          // ignore
        }
      }
      envTarget.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, [size]);

  // Fallback Canvas 2D com projeção 3D em perspectiva caso WebGL seja bloqueado
  useEffect(() => {
    if (!useCanvasFallback) return;
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const draw = (ms: number) => {
      const t = ms * 0.001;
      const w = canvas.clientWidth || 320;
      const h = canvas.clientHeight || 360;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h * 0.46 + Math.sin(t * 1.8) * 4;
      const s = stateRef.current;
      const scale = Math.min(w, h) * 0.34;
      const yaw = s.targetYaw * 1.4 + Math.sin(t * 0.9) * 0.08;

      const project = (x: number, y: number, z: number) => {
        const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
        const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
        const persp = 3.2 / (3.2 - rz);
        return { x: cx + rx * scale * persp, y: cy - y * scale * persp };
      };

      // Anéis orbitais em perspectiva 3D
      ctx.strokeStyle = s.isThinking ? 'rgba(255,42,75,0.65)' : 'rgba(0,229,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, scale * 1.18, scale * 0.42, Math.sin(t * 0.4) * 0.3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,42,75,0.45)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, scale * 1.32, scale * 0.48, -0.45 + Math.cos(t * 0.3) * 0.2, 0, Math.PI * 2);
      ctx.stroke();

      // Malha craniana 3D
      ctx.strokeStyle = 'rgba(0,229,255,0.75)';
      ctx.lineWidth = 1.4;
      for (let lat = -2; lat <= 3; lat++) {
        const y = lat * 0.19;
        const r = Math.max(0.18, 0.52 - Math.abs(lat) * 0.09);
        ctx.beginPath();
        for (let a = 0; a <= 20; a++) {
          const th = (a / 20) * Math.PI * 2;
          const pt = project(Math.cos(th) * r * 0.85, y + 0.16, Math.sin(th) * r * 0.95);
          if (a === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      // Olhos ciano + diamante na testa
      const dPt = project(0, 0.42, 0.46);
      ctx.fillStyle = s.isThinking ? '#FF2A4B' : '#00E5FF';
      ctx.beginPath();
      ctx.moveTo(dPt.x, dPt.y - 7);
      ctx.lineTo(dPt.x + 5, dPt.y);
      ctx.lineTo(dPt.x, dPt.y + 7);
      ctx.lineTo(dPt.x - 5, dPt.y);
      ctx.closePath();
      ctx.fill();

      const lEye = project(-0.17, 0.14, 0.43);
      const rEye = project(0.17, 0.14, 0.43);
      ctx.fillStyle = '#E0F7FF';
      ctx.beginPath();
      ctx.ellipse(lEye.x, lEye.y, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.ellipse(rEye.x, rEye.y, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Boca equalizador se falar
      const mBase = project(0, -0.22, 0.44);
      for (let i = -3; i <= 3; i++) {
        const hBar = s.isSpeaking ? 3 + Math.abs(Math.sin(ms * 0.015 + i)) * 9 : 2;
        ctx.fillStyle = i % 2 === 0 ? '#00E5FF' : '#FF2A4B';
        ctx.fillRect(mBase.x + i * 5 - 1.5, mBase.y - hBar / 2, 3, hBar);
      }

      // Ombros e Arc Reactor
      const shL = project(-0.82, -0.78, 0);
      const shR = project(0.82, -0.78, 0);
      const neckB = project(0, -0.52, 0.1);
      ctx.strokeStyle = 'rgba(0,229,255,0.72)';
      ctx.beginPath();
      ctx.moveTo(shL.x, shL.y);
      ctx.lineTo(neckB.x, neckB.y);
      ctx.lineTo(shR.x, shR.y);
      ctx.stroke();

      const corePt = project(0, -0.82, 0.32);
      ctx.strokeStyle = '#00E5FF';
      ctx.beginPath();
      ctx.arc(corePt.x, corePt.y, 11, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [useCanvasFallback]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || size === 'corner') return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    stateRef.current.targetYaw = nx * 0.32;
    stateRef.current.targetPitch = ny * 0.16;
    _vTmp.set(nx, ny, 0);
  };

  const handlePointerLeave = () => {
    stateRef.current.targetYaw = 0;
    stateRef.current.targetPitch = 0;
  };

  const dimClass =
    size === 'corner'
      ? 'w-[122px] h-[132px]'
      : size === 'split'
      ? 'w-[240px] h-[270px] sm:w-[270px] sm:h-[305px]'
      : 'w-[300px] h-[320px] sm:w-[400px] sm:h-[410px] xl:w-[440px] xl:h-[440px]';

  const statusText = isThinking
    ? 'PROCESSAMENTO NEURAL ATIVO'
    : isSpeaking
    ? 'VOZ SINTÉTICA EM EMISSÃO'
    : isListening
    ? 'ESCUTA ATIVA EM CURSO'
    : mood === 'focus'
    ? 'MODO FOCO CALIBRADO'
    : 'HOLOGRAMA STARK 3D ONLINE';

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={onClickHead}
      className={`relative flex flex-col items-center justify-center select-none ${
        onClickHead ? 'cursor-pointer' : ''
      }`}
    >
      <div className={`relative ${dimClass} flex items-center justify-center`}>
        {/* Halo radial sutil atrás da projeção WebGL (sem backdrop-filter) */}
        <div
          className="pointer-events-none absolute inset-4 rounded-full opacity-75"
          style={{
            background: isThinking
              ? 'radial-gradient(circle, rgba(255,42,75,0.18) 0%, rgba(0,229,255,0.12) 48%, rgba(0,0,0,0) 74%)'
              : 'radial-gradient(circle, rgba(0,229,255,0.22) 0%, rgba(255,42,75,0.08) 52%, rgba(0,0,0,0) 75%)',
          }}
        />

        {useCanvasFallback ? (
          <canvas
            ref={fallbackCanvasRef}
            className="relative z-10 w-full h-full block"
            aria-label="SARA JARVIS Holograma 3D Fallback"
          />
        ) : (
          <div
            ref={mountRef}
            className="relative z-10 w-full h-full"
            aria-label="SARA JARVIS Holograma 3D WebGL"
          />
        )}
      </div>

      {size !== 'corner' && (
        <div className="mt-1 px-3 py-1 rounded-full bg-[#040B1A] border border-cyan-500/35 flex items-center gap-2 text-[10px] font-mono tracking-[0.2em] uppercase">
          <span
            className={`w-2 h-2 rounded-full ${
              isThinking
                ? 'bg-[#FF2A4B]'
                : isSpeaking
                ? 'bg-[#00E5FF]'
                : isListening
                ? 'bg-emerald-400'
                : 'bg-[#00E5FF]'
            }`}
          />
          <span className={isThinking ? 'text-rose-300' : 'text-cyan-300'}>{statusText}</span>
        </div>
      )}
    </div>
  );
};
