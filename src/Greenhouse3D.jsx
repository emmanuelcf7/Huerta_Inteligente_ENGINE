import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  Box,
  Eye,
  EyeOff,
  RotateCcw,
  Maximize2,
  Droplets,
  Sprout,
  Ruler,
  Layers
} from 'lucide-react'

/**
 * Maqueta 3D Interactiva del Vivero Cubierto con Polisombra (8.00 m x 9.00 m x 2.87 m)
 * Basada en las especificaciones de ingeniería:
 * - Ancho: 8.00 m | Largo: 9.00 m | Altura total: 2.87 m | Altura lateral: 1.90 m
 * - 7 arcos de tubo galvanizado Ø 1 1/4" separados cada 1.50 m
 * - Correas superiores, laterales e inferiores Ø 1" (9.00 m)
 * - Puerta frontal: 1.90 m alto x 1.20 m ancho
 * - Polisombra 80% (172 m² recomendados con margen)
 * - Camas de Cilantro (izquierda) y Hierbabuena (derecha) con cambio de color de sustrato
 *   según la humedad y partículas de riego animadas cuando la electroválvula está activa.
 */
export default function Greenhouse3D({
  telemetry,
  isIrrigating,
  autoMode,
  minThreshold,
  maxThreshold,
  onToggleIrrigation
}) {
  const mountRef = useRef(null)

  // Controles de vista 3D
  const [showShadeCloth, setShowShadeCloth] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [autoRotate, setAutoRotate] = useState(true)
  const [cameraPreset, setCameraPreset] = useState('iso') // 'iso', 'front', 'side', 'top', 'interior'

  // Referencias para actualizar objetos 3D dinámicamente sin recrear toda la escena
  const sceneObjectsRef = useRef({
    cilantroSoilMat: null,
    hierbabuenaSoilMat: null,
    mainPipeMat: null,
    valveLedMat: null,
    waterDropsGroup: null,
    shadeMeshGroup: null,
    cilantroPlantsGroup: null,
    hierbabuenaPlantsGroup: null,
    cameraTargetAngles: { theta: 0.68, phi: 1.05, radius: 13.5, lookAtY: 1.1 }
  })

  const stateRef = useRef({
    isIrrigating,
    autoRotate,
    telemetry
  })

  useEffect(() => {
    stateRef.current = { isIrrigating, autoRotate, telemetry }
  }, [isIrrigating, autoRotate, telemetry])

  // Función auxiliar para calcular la altura Y de un arco (8m ancho, 1.90m lateral, 2.87m cumbrera)
  const getArchY = (x) => {
    const norm = Math.min(1, Math.abs(x) / 4.0) // x va de -4.0 a +4.0
    // Curva suave que vale 0 en x = ±4, ~1.90m en los hombros laterales y 2.87m en x = 0
    return 2.87 * Math.pow(1 - Math.pow(norm, 2.15), 0.42)
  }

  // Inicialización de la escena Three.js
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 800
    const height = container.clientHeight || 440

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#eef4f8')
    scene.fog = new THREE.FogExp2('#eef4f8', 0.018)

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Iluminación científica clara
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.85)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight('#fffbeb', 1.15)
    dirLight.position.set(10, 16, 12)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    scene.add(dirLight)

    const hemiLight = new THREE.HemisphereLight('#bae6fd', '#d6d3d1', 0.45)
    scene.add(hemiLight)

    // --- 1. BASE Y TERRENO NIVELADO (8.00 m x 9.00 m + borde perimetral) ---
    const groundGroup = new THREE.Group()

    // Losa / bordillo exterior de nivelación (8.8m x 9.8m)
    const slabGeo = new THREE.BoxGeometry(8.8, 0.22, 9.8)
    const slabMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.85
    })
    const slabMesh = new THREE.Mesh(slabGeo, slabMat)
    slabMesh.position.set(0, -0.11, 0)
    slabMesh.receiveShadow = true
    groundGroup.add(slabMesh)

    // Suelo interior de tierra compactada (8.00 m x 9.00 m)
    const innerFloorGeo = new THREE.BoxGeometry(8.0, 0.06, 9.0)
    const innerFloorMat = new THREE.MeshStandardMaterial({
      color: '#a89f91',
      roughness: 0.95
    })
    const innerFloorMesh = new THREE.Mesh(innerFloorGeo, innerFloorMat)
    innerFloorMesh.position.set(0, 0.02, 0)
    innerFloorMesh.receiveShadow = true
    groundGroup.add(innerFloorMesh)

    // Cuadrícula sutil de referencia métrica (cada 1 m)
    const gridHelper = new THREE.GridHelper(12, 12, '#94a3b8', '#dbe4ee')
    gridHelper.position.y = -0.21
    groundGroup.add(gridHelper)

    scene.add(groundGroup)

    // --- 2. ESTRUCTURA METÁLICA GALVANIZADA (7 Arcos cada 1.50m = 9.00m largo) ---
    const steelMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      metalness: 0.72,
      roughness: 0.28
    })
    const clampMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      metalness: 0.8,
      roughness: 0.2
    })

    const structureGroup = new THREE.Group()

    // Generar puntos de un arco de 8.00 m de ancho (-4.0 a +4.0)
    const archPoints = []
    const segments = 44
    for (let i = 0; i <= segments; i++) {
      const x = -4.0 + (8.0 * i) / segments
      const y = getArchY(x)
      archPoints.push(new THREE.Vector3(x, y, 0))
    }
    const archCurve = new THREE.CatmullRomCurve3(archPoints)
    const archTubeGeo = new THREE.TubeGeometry(archCurve, 48, 0.045, 10, false)
    const basePlateGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.04, 12)

    // 7 arcos ubicados desde z = -4.5m hasta z = +4.5m con separación de 1.50m
    const zPositions = [-4.5, -3.0, -1.5, 0.0, 1.5, 3.0, 4.5]
    zPositions.forEach((zPos) => {
      const archMesh = new THREE.Mesh(archTubeGeo, steelMat)
      archMesh.position.z = zPos
      archMesh.castShadow = true
      structureGroup.add(archMesh)

      // Placas base ancladas al suelo con pernos de expansión (Detalle B del plano)
      const leftPlate = new THREE.Mesh(basePlateGeo, clampMat)
      leftPlate.position.set(-4.0, 0.04, zPos)
      structureGroup.add(leftPlate)

      const rightPlate = new THREE.Mesh(basePlateGeo, clampMat)
      rightPlate.position.set(4.0, 0.04, zPos)
      structureGroup.add(rightPlate)
    })

    // Correas longitudinales de 9.00 m (Superiores, laterales e inferiores Ø 1")
    const purlinXPositions = [-3.98, -3.25, -1.85, 0.0, 1.85, 3.25, 3.98]
    const purlinGeo = new THREE.CylinderGeometry(0.032, 0.032, 9.0, 10)
    purlinGeo.rotateX(Math.PI / 2)

    purlinXPositions.forEach((xPos) => {
      const yPos = Math.max(0.12, getArchY(xPos))
      const purlin = new THREE.Mesh(purlinGeo, steelMat)
      purlin.position.set(xPos, yPos, 0)
      structureGroup.add(purlin)
    })

    // Puerta frontal (1.90 m alto x 1.20 m ancho en z = +4.5 m) y postes frontales
    const doorPostHeight = getArchY(0.6)
    const doorPostGeo = new THREE.CylinderGeometry(0.038, 0.038, doorPostHeight, 10)

    const leftDoorPost = new THREE.Mesh(doorPostGeo, steelMat)
    leftDoorPost.position.set(-0.6, doorPostHeight / 2, 4.5)
    structureGroup.add(leftDoorPost)

    const rightDoorPost = new THREE.Mesh(doorPostGeo, steelMat)
    rightDoorPost.position.set(0.6, doorPostHeight / 2, 4.5)
    structureGroup.add(rightDoorPost)

    // Dintel de la puerta a 1.90 m de altura
    const lintelGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.2, 10)
    lintelGeo.rotateZ(Math.PI / 2)
    const lintelMesh = new THREE.Mesh(lintelGeo, steelMat)
    lintelMesh.position.set(0, 1.9, 4.5)
    structureGroup.add(lintelMesh)

    // Postes intermedios de refuerzo frontal y trasero (en x = ±2.2 m)
    ;[-4.5, 4.5].forEach((zFace) => {
      ;[-2.2, 2.2].forEach((xSupport) => {
        const h = getArchY(xSupport)
        const supGeo = new THREE.CylinderGeometry(0.032, 0.032, h, 8)
        const supMesh = new THREE.Mesh(supGeo, steelMat)
        supMesh.position.set(xSupport, h / 2, zFace)
        structureGroup.add(supMesh)
      })
    })

    scene.add(structureGroup)

    // --- 3. CUBIERTA DE POLISOMBRA AL 80% (Conmutable para ver el interior) ---
    const shadeGroup = new THREE.Group()
    const shadeMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      transparent: true,
      opacity: 0.42,
      roughness: 0.9,
      side: THREE.DoubleSide
    })

    // Malla del arco cubierta de 9.00 m
    const roofRibbonGeo = new THREE.BufferGeometry()
    const roofVertices = []
    const roofIndices = []

    for (let i = 0; i <= segments; i++) {
      const x = -4.0 + (8.0 * i) / segments
      const y = getArchY(x) + 0.02
      roofVertices.push(x, y, -4.5)
      roofVertices.push(x, y, 4.5)
    }

    for (let i = 0; i < segments; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = (i + 1) * 2
      const d = (i + 1) * 2 + 1
      roofIndices.push(a, b, c)
      roofIndices.push(b, d, c)
    }

    roofRibbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofVertices, 3))
    roofRibbonGeo.setIndex(roofIndices)
    roofRibbonGeo.computeVertexNormals()

    const roofShadeMesh = new THREE.Mesh(roofRibbonGeo, shadeMat)
    shadeGroup.add(roofShadeMesh)

    // Faldón oscuro inferior perimetral (ventilación y protección lateral)
    const skirtMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    })
    const skirtGeo = new THREE.PlaneGeometry(9.0, 0.55)
    const leftSkirt = new THREE.Mesh(skirtGeo, skirtMat)
    leftSkirt.rotation.y = Math.PI / 2
    leftSkirt.position.set(-3.96, 0.3, 0)
    shadeGroup.add(leftSkirt)

    const rightSkirt = new THREE.Mesh(skirtGeo, skirtMat)
    rightSkirt.rotation.y = Math.PI / 2
    rightSkirt.position.set(3.96, 0.3, 0)
    shadeGroup.add(rightSkirt)

    scene.add(shadeGroup)
    sceneObjectsRef.current.shadeMeshGroup = shadeGroup

    // --- 4. CAMAS DE CULTIVO: CILANTRO (Izquierda) Y HIERBABUENA (Derecha) ---
    const bedsGroup = new THREE.Group()
    const woodBorderMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.7
    })

    // Cama Izquierda: Cilantro (x = -2.0 m)
    const bedFrameGeo = new THREE.BoxGeometry(2.3, 0.24, 7.6)
    const cilantroFrame = new THREE.Mesh(bedFrameGeo, woodBorderMat)
    cilantroFrame.position.set(-2.0, 0.14, 0)
    cilantroFrame.castShadow = true
    cilantroFrame.receiveShadow = true
    bedsGroup.add(cilantroFrame)

    const soilGeo = new THREE.BoxGeometry(2.14, 0.08, 7.44)
    const cilantroSoilMat = new THREE.MeshStandardMaterial({
      color: '#5c4033',
      roughness: 0.9
    })
    const cilantroSoil = new THREE.Mesh(soilGeo, cilantroSoilMat)
    cilantroSoil.position.set(-2.0, 0.24, 0)
    bedsGroup.add(cilantroSoil)
    sceneObjectsRef.current.cilantroSoilMat = cilantroSoilMat

    // Cama Derecha: Hierbabuena (x = +2.0 m)
    const hierbabuenaFrame = new THREE.Mesh(bedFrameGeo, woodBorderMat)
    hierbabuenaFrame.position.set(2.0, 0.14, 0)
    hierbabuenaFrame.castShadow = true
    hierbabuenaFrame.receiveShadow = true
    bedsGroup.add(hierbabuenaFrame)

    const hierbabuenaSoilMat = new THREE.MeshStandardMaterial({
      color: '#5c4033',
      roughness: 0.9
    })
    const hierbabuenaSoil = new THREE.Mesh(soilGeo, hierbabuenaSoilMat)
    hierbabuenaSoil.position.set(2.0, 0.24, 0)
    bedsGroup.add(hierbabuenaSoil)
    sceneObjectsRef.current.hierbabuenaSoilMat = hierbabuenaSoilMat

    // Plantas 3D en las camas
    const cilantroPlantsGroup = new THREE.Group()
    const hierbabuenaPlantsGroup = new THREE.Group()

    const cilantroLeafMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      roughness: 0.6
    })
    const hierbabuenaLeafMat = new THREE.MeshStandardMaterial({
      color: '#047857',
      roughness: 0.55
    })
    const stemMat = new THREE.MeshStandardMaterial({ color: '#15803d' })

    const bushGeo = new THREE.DodecahedronGeometry(0.16, 1)
    const stemGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.14, 6)

    for (let row = -3.3; row <= 3.3; row += 0.55) {
      for (let col = -0.7; col <= 0.7; col += 0.46) {
        // Planta de Cilantro
        const cPlant = new THREE.Group()
        const cStem = new THREE.Mesh(stemGeo, stemMat)
        cStem.position.y = 0.07
        const cFoliage = new THREE.Mesh(bushGeo, cilantroLeafMat)
        cFoliage.position.y = 0.2
        cFoliage.scale.set(1.1, 0.85, 1.1)
        cPlant.add(cStem, cFoliage)
        cPlant.position.set(-2.0 + col, 0.28, row)
        cilantroPlantsGroup.add(cPlant)

        // Planta de Hierbabuena
        const hPlant = new THREE.Group()
        const hStem = new THREE.Mesh(stemGeo, stemMat)
        hStem.position.y = 0.08
        const hFoliage = new THREE.Mesh(bushGeo, hierbabuenaLeafMat)
        hFoliage.position.y = 0.22
        hFoliage.scale.set(1.2, 1.0, 1.2)
        hPlant.add(hStem, hFoliage)
        hPlant.position.set(2.0 + col, 0.28, row)
        hierbabuenaPlantsGroup.add(hPlant)
      }
    }

    bedsGroup.add(cilantroPlantsGroup)
    bedsGroup.add(hierbabuenaPlantsGroup)
    sceneObjectsRef.current.cilantroPlantsGroup = cilantroPlantsGroup
    sceneObjectsRef.current.hierbabuenaPlantsGroup = hierbabuenaPlantsGroup

    scene.add(bedsGroup)

    // --- 5. SISTEMA DE RIEGO, TUBERÍAS Y NODO IOT ESP32 ---
    const iotGroup = new THREE.Group()

    const mainPipeMat = new THREE.MeshStandardMaterial({
      color: '#64748b',
      metalness: 0.4,
      roughness: 0.3
    })
    sceneObjectsRef.current.mainPipeMat = mainPipeMat

    // Líneas de riego sobre cada cama
    const dripLineGeo = new THREE.CylinderGeometry(0.025, 0.025, 7.4, 8)
    dripLineGeo.rotateX(Math.PI / 2)

    ;[-2.45, -1.55, 1.55, 2.45].forEach((xLine) => {
      const lineMesh = new THREE.Mesh(dripLineGeo, mainPipeMat)
      lineMesh.position.set(xLine, 0.34, 0)
      iotGroup.add(lineMesh)
    })

    // Tubería colectora frontal (en z = -3.8 m)
    const manifoldGeo = new THREE.CylinderGeometry(0.04, 0.04, 5.2, 10)
    manifoldGeo.rotateZ(Math.PI / 2)
    const manifoldMesh = new THREE.Mesh(manifoldGeo, mainPipeMat)
    manifoldMesh.position.set(0, 0.34, -3.8)
    iotGroup.add(manifoldMesh)

    // Gabinete de Control ESP32 + Electroválvula Central (en x = 0, z = -3.8 m)
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 10)
    const controlPost = new THREE.Mesh(postGeo, steelMat)
    controlPost.position.set(0, 0.7, -3.8)
    iotGroup.add(controlPost)

    const boxGeo = new THREE.BoxGeometry(0.45, 0.45, 0.26)
    const boxMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 })
    const espBox = new THREE.Mesh(boxGeo, boxMat)
    espBox.position.set(0, 1.25, -3.8)
    iotGroup.add(espBox)

    // Indicador luminoso LED de la electroválvula / automatismo
    const ledGeo = new THREE.SphereGeometry(0.08, 12, 12)
    const valveLedMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      emissive: '#10b981',
      emissiveIntensity: 0.8
    })
    const valveLed = new THREE.Mesh(ledGeo, valveLedMat)
    valveLed.position.set(0, 1.55, -3.8)
    iotGroup.add(valveLed)
    sceneObjectsRef.current.valveLedMat = valveLedMat

    // Estacas de sensores de humedad en cada cama (S-01 y S-02)
    const sensorProbeGeo = new THREE.BoxGeometry(0.12, 0.35, 0.12)
    const sensorProbeMat = new THREE.MeshStandardMaterial({ color: '#0284c7' })

    const sensorS1 = new THREE.Mesh(sensorProbeGeo, sensorProbeMat)
    sensorS1.position.set(-2.0, 0.42, 2.2)
    iotGroup.add(sensorS1)

    const sensorS2 = new THREE.Mesh(sensorProbeGeo, sensorProbeMat)
    sensorS2.position.set(2.0, 0.42, 2.2)
    iotGroup.add(sensorS2)

    scene.add(iotGroup)

    // --- 6. PARTÍCULAS ANIMADAS DE RIEGO (Gotas / Aspersión sobre camas) ---
    const waterDropsGroup = new THREE.Group()
    const dropGeo = new THREE.SphereGeometry(0.045, 6, 6)
    const dropMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.85
    })

    for (let i = 0; i < 90; i++) {
      const drop = new THREE.Mesh(dropGeo, dropMat)
      const isLeftBed = i % 2 === 0
      const baseX = isLeftBed ? -2.0 : 2.0
      drop.position.set(
        baseX + (Math.random() - 0.5) * 1.9,
        0.35 + Math.random() * 1.15,
        (Math.random() - 0.5) * 7.0
      )
      drop.userData = {
        speed: 0.025 + Math.random() * 0.03,
        baseX
      }
      waterDropsGroup.add(drop)
    }

    waterDropsGroup.visible = stateRef.current.isIrrigating
    scene.add(waterDropsGroup)
    sceneObjectsRef.current.waterDropsGroup = waterDropsGroup

    // --- 7. CONTROLES DE CÁMARA CON RATÓN / TÁCTIL ---
    let isDragging = false
    let prevX = 0
    let prevY = 0
    const spherical = { theta: 0.68, phi: 1.05, radius: 13.5 }

    const handlePointerDown = (e) => {
      isDragging = true
      prevX = e.clientX
      prevY = e.clientY
    }

    const handlePointerMove = (e) => {
      if (!isDragging) return
      const dx = e.clientX - prevX
      const dy = e.clientY - prevY
      prevX = e.clientX
      prevY = e.clientY

      const target = sceneObjectsRef.current.cameraTargetAngles
      target.theta -= dx * 0.007
      target.phi = Math.max(0.25, Math.min(1.48, target.phi - dy * 0.006))
    }

    const handlePointerUp = () => {
      isDragging = false
    }

    const handleWheel = (e) => {
      e.preventDefault()
      const target = sceneObjectsRef.current.cameraTargetAngles
      target.radius = Math.max(6.5, Math.min(22, target.radius + e.deltaY * 0.008))
    }

    const domElem = renderer.domElement
    domElem.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    domElem.addEventListener('wheel', handleWheel, { passive: false })

    // Bucle de animación
    let animationFrameId
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      const target = sceneObjectsRef.current.cameraTargetAngles
      if (stateRef.current.autoRotate && !isDragging) {
        target.theta += 0.0022
      }

      // Interpolación suave de cámara
      spherical.theta += (target.theta - spherical.theta) * 0.1
      spherical.phi += (target.phi - spherical.phi) * 0.1
      spherical.radius += (target.radius - spherical.radius) * 0.1

      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta)
      camera.position.y = spherical.radius * Math.cos(spherical.phi)
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)
      camera.lookAt(0, target.lookAtY || 1.0, 0)

      // Animación de gotas cuando el riego está activo
      if (waterDropsGroup.visible) {
        waterDropsGroup.children.forEach((drop) => {
          drop.position.y -= drop.userData.speed
          if (drop.position.y < 0.28) {
            drop.position.y = 1.35 + Math.random() * 0.3
          }
        })
      }

      renderer.render(scene, camera)
    }

    animate()

    // Responsividad del canvas
    const handleResize = () => {
      if (!container) return
      const newW = container.clientWidth
      const newH = container.clientHeight || 440
      camera.aspect = newW / newH
      camera.updateProjectionMatrix()
      renderer.setSize(newW, newH)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationFrameId)
      domElem.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      domElem.removeEventListener('wheel', handleWheel)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
    }
  }, [])

  // Sincronización en tiempo real entre el estado del dashboard y la maqueta 3D
  useEffect(() => {
    const {
      cilantroSoilMat,
      hierbabuenaSoilMat,
      mainPipeMat,
      valveLedMat,
      waterDropsGroup,
      shadeMeshGroup,
      cilantroPlantsGroup,
      hierbabuenaPlantsGroup
    } = sceneObjectsRef.current

    // 1. Mostrar/ocultar polisombra
    if (shadeMeshGroup) {
      shadeMeshGroup.visible = showShadeCloth
    }

    // 2. Estado de riego (tuberías, gotas animadas y LED del nodo ESP32)
    if (waterDropsGroup) {
      waterDropsGroup.visible = isIrrigating
    }
    if (mainPipeMat) {
      mainPipeMat.color.set(isIrrigating ? '#0284c7' : '#64748b')
      mainPipeMat.emissive.set(isIrrigating ? '#0369a1' : '#000000')
      mainPipeMat.emissiveIntensity = isIrrigating ? 0.35 : 0
    }
    if (valveLedMat) {
      const ledColor = isIrrigating
        ? '#0284c7'
        : telemetry.soilMoisture < minThreshold
        ? '#d97706'
        : '#10b981'
      valveLedMat.color.set(ledColor)
      valveLedMat.emissive.set(ledColor)
    }

    // 3. Color del sustrato según el porcentaje de humedad (más oscuro cuando está húmedo, más claro cuando está seco)
    const getSoilColor = (moisture) => {
      const dryColor = new THREE.Color('#9c7a54') // Tierra seca clara
      const wetColor = new THREE.Color('#3b2314') // Tierra húmeda oscura
      const factor = Math.min(1, Math.max(0, (moisture - 25) / 60))
      return dryColor.lerp(wetColor, factor)
    }

    if (cilantroSoilMat) {
      cilantroSoilMat.color.copy(getSoilColor(telemetry.cilantroMoisture))
    }
    if (hierbabuenaSoilMat) {
      hierbabuenaSoilMat.color.copy(getSoilColor(telemetry.hierbabuenaMoisture))
    }

    // 4. Vigor visual del follaje según la humedad
    if (cilantroPlantsGroup) {
      const scaleY = telemetry.cilantroMoisture < 45 ? 0.78 : 1.0
      cilantroPlantsGroup.children.forEach((p) => {
        p.scale.y = scaleY
      })
    }
    if (hierbabuenaPlantsGroup) {
      const scaleY = telemetry.hierbabuenaMoisture < 50 ? 0.78 : 1.0
      hierbabuenaPlantsGroup.children.forEach((p) => {
        p.scale.y = scaleY
      })
    }
  }, [
    telemetry,
    isIrrigating,
    showShadeCloth,
    minThreshold,
    maxThreshold
  ])

  // Cambiar vistas predefinidas de cámara (Isométrica, Frontal, Lateral, Planta, Interior)
  const applyCameraPreset = (preset) => {
    setCameraPreset(preset)
    setAutoRotate(false)
    const target = sceneObjectsRef.current.cameraTargetAngles

    if (preset === 'iso') {
      target.theta = 0.68
      target.phi = 1.05
      target.radius = 13.5
      target.lookAtY = 1.1
    } else if (preset === 'front') {
      target.theta = 0.0
      target.phi = 1.32
      target.radius = 12.0
      target.lookAtY = 1.2
    } else if (preset === 'side') {
      target.theta = Math.PI / 2
      target.phi = 1.32
      target.radius = 13.5
      target.lookAtY = 1.2
    } else if (preset === 'top') {
      target.theta = 0.0
      target.phi = 0.26
      target.radius = 15.5
      target.lookAtY = 0.0
    } else if (preset === 'interior') {
      target.theta = 0.15
      target.phi = 1.28
      target.radius = 7.2
      target.lookAtY = 0.85
    }
  }

  return (
    <section className="panel-card model3d-section" aria-label="Maqueta 3D Interactiva del Vivero">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <Box size={20} color="#0284c7" />
            <span>Gemelo Digital 3D – Vivero en Arco Cubierto con Polisombra (8.00 m × 9.00 m)</span>
          </h2>
          <p className="panel-subtitle">
            Estructura en arco de alto relieve (7 arcos cada 1.50 m • Altura cumbrera 2.87 m • Altura lateral 1.90 m) sincronizada en tiempo real con el riego y la humedad
          </p>
        </div>

        {/* Barra de controles interactivos 3D */}
        <div className="model3d-toolbar">
          <button
            type="button"
            className={`btn-secondary-sm ${showShadeCloth ? 'active-toggle' : ''}`}
            onClick={() => setShowShadeCloth(!showShadeCloth)}
            title="Mostrar u ocultar la malla de polisombra del 80% para inspeccionar mejor el interior"
          >
            {showShadeCloth ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>{showShadeCloth ? 'Polisombra 80%: Visible' : 'Polisombra: Oculta'}</span>
          </button>

          <button
            type="button"
            className={`btn-secondary-sm ${autoRotate ? 'active-toggle' : ''}`}
            onClick={() => setAutoRotate(!autoRotate)}
          >
            <RotateCcw size={14} />
            <span>{autoRotate ? 'Rotación Auto: ON' : 'Rotación Auto: OFF'}</span>
          </button>

          <button
            type="button"
            className={`btn-secondary-sm ${showDimensions ? 'active-toggle' : ''}`}
            onClick={() => setShowDimensions(!showDimensions)}
          >
            <Ruler size={14} />
            <span>Ficha Técnica</span>
          </button>

          <button
            type="button"
            className={`btn-secondary-sm ${isIrrigating ? 'irrigating-toggle' : ''}`}
            onClick={onToggleIrrigation}
          >
            <Droplets size={14} />
            <span>{isIrrigating ? 'Detener Riego 3D' : 'Probar Riego en 3D'}</span>
          </button>
        </div>
      </div>

      {/* Selector de vistas de planos de ingeniería */}
      <div className="camera-presets-bar">
        <span className="preset-label">
          <Maximize2 size={13} />
          Vistas del Plano:
        </span>
        <button
          type="button"
          className={`preset-btn ${cameraPreset === 'iso' ? 'active' : ''}`}
          onClick={() => applyCameraPreset('iso')}
        >
          Perspectiva 3D
        </button>
        <button
          type="button"
          className={`preset-btn ${cameraPreset === 'front' ? 'active' : ''}`}
          onClick={() => applyCameraPreset('front')}
        >
          Vista Frontal (8.00 m)
        </button>
        <button
          type="button"
          className={`preset-btn ${cameraPreset === 'side' ? 'active' : ''}`}
          onClick={() => applyCameraPreset('side')}
        >
          Vista Lateral (9.00 m)
        </button>
        <button
          type="button"
          className={`preset-btn ${cameraPreset === 'top' ? 'active' : ''}`}
          onClick={() => applyCameraPreset('top')}
        >
          Vista en Planta
        </button>
        <button
          type="button"
          className={`preset-btn ${cameraPreset === 'interior' ? 'active' : ''}`}
          onClick={() => applyCameraPreset('interior')}
        >
          Interior Cultivos
        </button>
      </div>

      {/* Contenedor del lienzo WebGL + Overlays de telemetría en vivo */}
      <div className="canvas3d-wrapper">
        <div ref={mountRef} className="canvas3d-mount" />

        {/* Telemetría superpuesta en tiempo real */}
        <div className="overlay-hud top-left">
          <div className="hud-badge">
            <span className={`pulse-dot ${isIrrigating ? 'blue' : 'green'}`}></span>
            <strong>{isIrrigating ? 'ELECTROVÁLVULA ABIERTA (REGANDO)' : 'SISTEMA EN MONITOREO'}</strong>
          </div>
          <div className="hud-metrics mono">
            <div>
              <Sprout size={13} color="#10b981" /> Cama Izq. (Cilantro):{' '}
              <strong>{telemetry.cilantroMoisture.toFixed(1)}%</strong>
            </div>
            <div>
              <Sprout size={13} color="#059669" /> Cama Der. (Hierbabuena):{' '}
              <strong>{telemetry.hierbabuenaMoisture.toFixed(1)}%</strong>
            </div>
            <div>
              Modo: <strong>{autoMode ? `Automático (${minThreshold}%–${maxThreshold}%)` : 'Manual'}</strong>
            </div>
          </div>
        </div>

        {/* Instrucción de interacción */}
        <div className="overlay-hud bottom-left">
          <span>Arrastra con el clic izquierdo para rotar • Rueda del ratón para acercar/alejar</span>
        </div>
      </div>

      {/* Especificaciones de Ingeniería del Vivero (según plano técnico suministrado) */}
      {showDimensions && (
        <div className="engineering-specs-grid">
          <div className="spec-box">
            <div className="spec-box-title">
              <Ruler size={15} color="#0284c7" />
              <span>Geometría del Arco y Dimensiones</span>
            </div>
            <ul>
              <li>
                <span>Ancho × Largo:</span> <strong>8.00 m × 9.00 m (72 m² planta)</strong>
              </li>
              <li>
                <span>Altura Total / Lateral:</span> <strong>2.87 m cumbrera / 1.90 m lateral</strong>
              </li>
              <li>
                <span>Arcos Modulados:</span> <strong>7 unidades separadas cada 1.50 m</strong>
              </li>
              <li>
                <span>Puerta Frontal:</span> <strong>1.90 m alto × 1.20 m ancho</strong>
              </li>
            </ul>
          </div>

          <div className="spec-box">
            <div className="spec-box-title">
              <Layers size={15} color="#059669" />
              <span>Materiales Estructurales y Polisombra</span>
            </div>
            <ul>
              <li>
                <span>Tubos de Arco:</span> <strong>7 arcos en tubo galvanizado Ø 1 1/4"</strong>
              </li>
              <li>
                <span>Correas (Sup / Lat / Inf):</span> <strong>6 líneas de 9.00 m en tubo Ø 1"</strong>
              </li>
              <li>
                <span>Anclajes al Suelo:</span> <strong>14 placas base con perno expansión Ø 3/8" × 3"</strong>
              </li>
              <li>
                <span>Cobertura Polisombra (80%):</span> <strong>156.50 m² netos (172.00 m² con 10% margen)</strong>
              </li>
            </ul>
          </div>

          <div className="spec-box">
            <div className="spec-box-title">
              <Droplets size={15} color="#0284c7" />
              <span>Respuesta Visual en la Maqueta 3D</span>
            </div>
            <ul>
              <li>
                <span>Humedad del Suelo:</span> <strong>El sustrato se oscurece al hidratarse y se aclara al secarse</strong>
              </li>
              <li>
                <span>Riego Activo:</span> <strong>Animación de microaspersión/goteo y tuberías iluminadas en azul</strong>
              </li>
              <li>
                <span>Nodo Central ESP32:</span> <strong>Torreta de telemetría con indicador LED de estado operativo</strong>
              </li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
