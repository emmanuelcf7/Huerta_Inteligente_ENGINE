import { useState, useEffect, useRef } from 'react'
import {
  Sprout,
  Droplets,
  Thermometer,
  Wind,
  Power,
  Settings2,
  Activity,
  Clock,
  Cpu,
  Wifi,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Sliders,
  History,
  MapPin,
  RotateCcw,
  Sparkles
} from 'lucide-react'

const clamp = (val, min, max) => Math.min(Math.max(val, min), max)
const round1 = (val) => Math.round(val * 10) / 10

function formatTime(date) {
  return date.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

function formatDate(date) {
  return date.toLocaleDateString('es-CO', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Reusable SVG Line Chart Component
function TelemetryChart({ data, dataKey, color, unit, minDomain, maxDomain, thresholds }) {
  const width = 560
  const height = 200
  const padLeft = 40
  const padRight = 18
  const padTop = 18
  const padBottom = 28

  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  const mapX = (index) => {
    if (data.length <= 1) return padLeft
    return padLeft + (index / (data.length - 1)) * plotW
  }

  const mapY = (val) => {
    const ratio = (val - minDomain) / (maxDomain - minDomain)
    return padTop + plotH - clamp(ratio, 0, 1) * plotH
  }

  const points = data.map((d, idx) => `${mapX(idx)},${mapY(d[dataKey])}`).join(' ')
  const areaPoints = `${mapX(0)},${padTop + plotH} ${points} ${mapX(data.length - 1)},${padTop + plotH}`

  const yTicks = [
    minDomain,
    round1(minDomain + (maxDomain - minDomain) * 0.25),
    round1(minDomain + (maxDomain - minDomain) * 0.5),
    round1(minDomain + (maxDomain - minDomain) * 0.75),
    maxDomain
  ]

  return (
    <div className="chart-wrapper">
      <svg viewBox={`0 0 ${width} ${height}`} className="svg-chart" role="img" aria-label={`Gráfico de ${dataKey}`}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines & Y axis labels */}
        {yTicks.map((tick) => {
          const y = mapY(tick)
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#64748b"
                fontFamily="JetBrains Mono, monospace"
              >
                {tick}{unit}
              </text>
            </g>
          )
        })}

        {/* Optional threshold reference lines */}
        {thresholds && (
          <>
            <line
              x1={padLeft}
              y1={mapY(thresholds.min)}
              x2={width - padRight}
              y2={mapY(thresholds.min)}
              stroke="#d97706"
              strokeDasharray="4 4"
              strokeWidth="1.3"
            />
            <line
              x1={padLeft}
              y1={mapY(thresholds.max)}
              x2={width - padRight}
              y2={mapY(thresholds.max)}
              stroke="#059669"
              strokeDasharray="4 4"
              strokeWidth="1.3"
            />
          </>
        )}

        {/* Shaded area & line */}
        {data.length > 1 && (
          <>
            <polygon points={areaPoints} fill={`url(#grad-${dataKey})`} />
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </>
        )}

        {/* Data points */}
        {data.map((d, idx) => {
          const cx = mapX(idx)
          const cy = mapY(d[dataKey])
          const isLast = idx === data.length - 1
          return (
            <g key={d.time + idx}>
              <circle
                cx={cx}
                cy={cy}
                r={isLast ? 4.5 : 2.5}
                fill={isLast ? '#ffffff' : color}
                stroke={color}
                strokeWidth={isLast ? 2.5 : 1}
              />
              {(idx === 0 || idx === Math.floor(data.length / 2) || isLast) && (
                <text
                  x={cx}
                  y={height - 6}
                  textAnchor={idx === 0 ? 'start' : isLast ? 'end' : 'middle'}
                  fontSize="10"
                  fill="#64748b"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {d.time}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function App() {
  const [currentTime, setCurrentTime] = useState(() => new Date())

  // Thresholds for automatic irrigation
  const [minThreshold, setMinThreshold] = useState(45)
  const [maxThreshold, setMaxThreshold] = useState(72)

  // Control mode & irrigation state
  const [autoMode, setAutoMode] = useState(true)
  const [isIrrigating, setIsIrrigating] = useState(false)
  const [bannerMessage, setBannerMessage] = useState(
    'Modo automático activo: monitoreando humedad del suelo en tiempo real (Simulación).'
  )

  // Simulated telemetry state (Sabanas de Sucre typical tropical savanna climate)
  const [telemetry, setTelemetry] = useState({
    soilMoisture: 54.2,
    cilantroMoisture: 52.8,
    hierbabuenaMoisture: 55.6,
    temperature: 31.4,
    airHumidity: 68.5,
    lastUpdate: formatTime(new Date()),
    sampleCount: 14
  })

  // Initial time-series history (last 14 samples)
  const [historyData, setHistoryData] = useState(() => {
    const now = Date.now()
    const initial = []
    let sm = 56.0
    let temp = 31.0
    for (let i = 13; i >= 0; i--) {
      const t = new Date(now - i * 3000)
      sm = round1(clamp(sm + (Math.random() - 0.52) * 1.2, 35, 85))
      temp = round1(clamp(temp + (Math.random() - 0.48) * 0.3, 27, 36))
      initial.push({
        time: formatTime(t),
        soilMoisture: sm,
        temperature: temp
      })
    }
    return initial
  })

  // System event log
  const [events, setEvents] = useState(() => [
    {
      id: 1,
      time: formatTime(new Date(Date.now() - 12000)),
      type: 'auto',
      text: 'Inicialización del sistema en MODO SIMULACIÓN (Piloto Sabanas de Sucre).'
    },
    {
      id: 2,
      time: formatTime(new Date(Date.now() - 6000)),
      type: 'config',
      text: 'Control automático habilitado con rango operativo [45% – 72%].'
    }
  ])

  const [techOpen, setTechOpen] = useState(true)

  // Refs to access current state inside the 3-second simulation interval without resetting it
  const stateRef = useRef({
    autoMode,
    isIrrigating,
    minThreshold,
    maxThreshold
  })

  useEffect(() => {
    stateRef.current = {
      autoMode,
      isIrrigating,
      minThreshold,
      maxThreshold
    }
  }, [autoMode, isIrrigating, minThreshold, maxThreshold])

  const addEvent = (type, text, customTime) => {
    const timeStr = customTime || formatTime(new Date())
    setEvents((prev) => [
      { id: Date.now() + Math.random(), time: timeStr, type, text },
      ...prev.slice(0, 29)
    ])
  }

  // 1-second clock update for header date & time
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(clockTimer)
  }, [])

  // 3-second environmental telemetry & automation engine
  useEffect(() => {
    const simInterval = setInterval(() => {
      const now = new Date()
      const timeStr = formatTime(now)
      const {
        autoMode: currentAuto,
        isIrrigating: currentIrrigating,
        minThreshold: currentMin,
        maxThreshold: currentMax
      } = stateRef.current

      setTelemetry((prev) => {
        // Calculate realistic variations for Sabanas de Sucre
        const moistureDelta = currentIrrigating
          ? 2.2 + Math.random() * 1.4 // Rises when valve is open
          : -(0.8 + Math.random() * 0.9) // Gradually drops due to evapotranspiration

        const nextCilantro = round1(
          clamp(prev.cilantroMoisture + moistureDelta + (Math.random() - 0.5) * 0.5, 22, 92)
        )
        const nextHierbabuena = round1(
          clamp(prev.hierbabuenaMoisture + moistureDelta * 0.95 + (Math.random() - 0.5) * 0.5, 24, 94)
        )
        const nextSoil = round1((nextCilantro + nextHierbabuena) / 2)

        const tempDrift = currentIrrigating ? -0.12 : 0.08
        const nextTemp = round1(
          clamp(prev.temperature + tempDrift + (Math.random() - 0.5) * 0.35, 25.5, 37.5)
        )

        const humDrift = currentIrrigating ? 0.45 : -0.2
        const nextAirHum = round1(
          clamp(prev.airHumidity + humDrift + (Math.random() - 0.5) * 0.9, 48, 88)
        )

        // Evaluate automatic irrigation hysteresis rules
        if (currentAuto) {
          if (!currentIrrigating && nextSoil < currentMin) {
            setIsIrrigating(true)
            const msg = `Riego automático ACTIVADO: humedad del suelo (${nextSoil}%) inferior al umbral mínimo (${currentMin}%).`
            setBannerMessage(msg)
            addEvent('auto', msg, timeStr)
          } else if (currentIrrigating && nextSoil >= currentMax) {
            setIsIrrigating(false)
            const msg = `Riego automático DETENIDO: humedad del suelo (${nextSoil}%) alcanzó el umbral superior (${currentMax}%).`
            setBannerMessage(msg)
            addEvent('auto', msg, timeStr)
          }
        }

        // Append reading to chart history (keep last 15 points)
        setHistoryData((oldHist) => [
          ...oldHist.slice(-14),
          {
            time: timeStr,
            soilMoisture: nextSoil,
            temperature: nextTemp
          }
        ])

        return {
          soilMoisture: nextSoil,
          cilantroMoisture: nextCilantro,
          hierbabuenaMoisture: nextHierbabuena,
          temperature: nextTemp,
          airHumidity: nextAirHum,
          lastUpdate: timeStr,
          sampleCount: prev.sampleCount + 1
        }
      })
    }, 3000)

    return () => clearInterval(simInterval)
  }, [])

  // Immediate evaluation when user toggles Auto Mode or changes thresholds
  useEffect(() => {
    if (!autoMode) return
    if (!isIrrigating && telemetry.soilMoisture < minThreshold) {
      setIsIrrigating(true)
      const msg = `Riego automático ACTIVADO: humedad actual (${telemetry.soilMoisture}%) por debajo del umbral (${minThreshold}%).`
      setBannerMessage(msg)
      addEvent('auto', msg)
    } else if (isIrrigating && telemetry.soilMoisture >= maxThreshold) {
      setIsIrrigating(false)
      const msg = `Riego automático DETENIDO: humedad actual (${telemetry.soilMoisture}%) superó el umbral máximo (${maxThreshold}%).`
      setBannerMessage(msg)
      addEvent('auto', msg)
    }
  }, [autoMode, minThreshold, maxThreshold, telemetry.soilMoisture, isIrrigating])

  // Handlers for user controls
  const handleToggleAutoMode = () => {
    const nextAuto = !autoMode
    setAutoMode(nextAuto)
    if (nextAuto) {
      const msg = `Modo automático HABILITADO (Umbrales: ${minThreshold}% – ${maxThreshold}%).`
      setBannerMessage(msg)
      addEvent('config', msg)
    } else {
      const msg = 'Modo manual HABILITADO: automatización pausada para permitir control directo.'
      setBannerMessage(msg)
      addEvent('config', msg)
    }
  }

  const handleManualIrrigationToggle = () => {
    const nextIrrigation = !isIrrigating
    // Prevent contradictory state: if user triggers manual button while in auto mode, switch cleanly to manual mode
    if (autoMode) {
      setAutoMode(false)
      addEvent(
        'manual',
        'Cambio automático a MODO MANUAL por intervención directa del operador.'
      )
    }
    setIsIrrigating(nextIrrigation)
    if (nextIrrigation) {
      const msg = 'Riego ACTIVADO manualmente por el operador (Modo Manual).'
      setBannerMessage(msg)
      addEvent('manual', msg)
    } else {
      const msg = 'Riego DETENIDO manualmente por el operador (Modo Manual).'
      setBannerMessage(msg)
      addEvent('manual', msg)
    }
  }

  const handleMinThresholdChange = (e) => {
    const val = Number(e.target.value)
    // Keep at least 5% deadband below maxThreshold
    const validMin = Math.min(val, maxThreshold - 5)
    setMinThreshold(validMin)
  }

  const handleMaxThresholdChange = (e) => {
    const val = Number(e.target.value)
    // Keep at least 5% deadband above minThreshold
    const validMax = Math.max(val, minThreshold + 5)
    setMaxThreshold(validMax)
  }

  const handleSimulateDrought = () => {
    const lowVal = round1(Math.max(26, minThreshold - 6.5))
    setTelemetry((prev) => ({
      ...prev,
      soilMoisture: lowVal,
      cilantroMoisture: round1(lowVal - 1.2),
      hierbabuenaMoisture: round1(lowVal + 1.2)
    }))
    addEvent(
      'config',
      `Prueba de descenso hídrico aplicada: humedad simulada ajustada a ${lowVal}%.`
    )
  }

  // Helper to evaluate crop status and irrigation advice
  const getCropEvaluation = (moisture, cropType) => {
    const idealMin = cropType === 'cilantro' ? 45 : 50
    const idealMax = cropType === 'cilantro' ? 70 : 75

    if (moisture < idealMin) {
      return {
        statusText: 'Déficit Hídrico',
        pillClass: 'low',
        barColor: '#d97706',
        recommendation: isIrrigating
          ? 'Riego en curso: recuperando nivel óptimo de humedad radicular.'
          : `Se recomienda activar riego hasta superar el ${idealMin}% de humedad.`
      }
    }
    if (moisture > idealMax) {
      return {
        statusText: 'Saturación Alta',
        pillClass: 'high',
        barColor: '#0284c7',
        recommendation:
          'Suspender suministro hídrico y permitir drenaje natural para evitar estrés radicular.'
      }
    }
    return {
      statusText: 'Estado Óptimo',
      pillClass: 'optimal',
      barColor: '#059669',
      recommendation:
        'Humedad dentro del rango agronómico ideal. Mantener monitoreo periódico.'
    }
  }

  const cilantroEval = getCropEvaluation(telemetry.cilantroMoisture, 'cilantro')
  const hierbabuenaEval = getCropEvaluation(telemetry.hierbabuenaMoisture, 'hierbabuena')

  return (
    <div className="dashboard-container">
      {/* 1. ENCABEZADO */}
      <header className="top-header">
        <div className="brand-section">
          <div className="brand-icon">
            <Sprout size={32} color="#34d399" />
          </div>
          <div className="brand-titles">
            <h1>Huerta Inteligente ENGINE</h1>
            <p>Sistema de monitoreo y automatización agrícola – Piloto Sucre</p>
            <div className="location-tag">
              <MapPin size={13} />
              <span>Región Sabanas de Sucre, Colombia • Parcela Experimental Cilantro & Hierbabuena</span>
            </div>
          </div>
        </div>

        <div className="header-meta">
          <div className="sim-badge" title="Todos los datos provienen de un modelo matemático simulado">
            <span className="pulse-dot"></span>
            <span>MODO SIMULACIÓN</span>
          </div>
          <div className="datetime-box mono">
            <Clock size={15} color="#38bdf8" />
            <span>{formatDate(currentTime)}</span>
            <span>|</span>
            <strong>{formatTime(currentTime)}</strong>
          </div>
        </div>
      </header>

      {/* Banner dinámico de estado operativo */}
      <div
        className={`status-banner ${
          isIrrigating ? 'irrigating' : telemetry.soilMoisture < minThreshold ? 'warning' : 'standby'
        }`}
      >
        <div className="banner-left">
          {isIrrigating ? (
            <Droplets size={20} />
          ) : telemetry.soilMoisture < minThreshold ? (
            <AlertCircle size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <span>{bannerMessage}</span>
        </div>
        <div className="banner-tag mono">
          {autoMode ? 'CONTROL: AUTOMÁTICO' : 'CONTROL: MANUAL'} • CICLO 3s
        </div>
      </div>

      {/* 2. VARIABLES AMBIENTALES */}
      <section className="kpi-grid" aria-label="Variables Ambientales Simuladas">
        <article className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Humedad del Suelo</span>
            <div className="kpi-icon">
              <Droplets size={20} />
            </div>
          </div>
          <div className="kpi-value-row mono">
            <span className="kpi-value">{telemetry.soilMoisture.toFixed(1)}</span>
            <span className="kpi-unit">%</span>
          </div>
          <div className="kpi-footer">
            <span>Promedio radicular (10–20 cm)</span>
            <span className="sim-tag-mini">SIMULADO</span>
          </div>
        </article>

        <article className="kpi-card amber-accent">
          <div className="kpi-header">
            <span className="kpi-title">Temperatura Ambiental</span>
            <div className="kpi-icon">
              <Thermometer size={20} />
            </div>
          </div>
          <div className="kpi-value-row mono">
            <span className="kpi-value">{telemetry.temperature.toFixed(1)}</span>
            <span className="kpi-unit">°C</span>
          </div>
          <div className="kpi-footer">
            <span>Microclima Sabanas de Sucre</span>
            <span className="sim-tag-mini">SIMULADO</span>
          </div>
        </article>

        <article className="kpi-card green-accent">
          <div className="kpi-header">
            <span className="kpi-title">Humedad Relativa</span>
            <div className="kpi-icon">
              <Wind size={20} />
            </div>
          </div>
          <div className="kpi-value-row mono">
            <span className="kpi-value">{telemetry.airHumidity.toFixed(1)}</span>
            <span className="kpi-unit">%</span>
          </div>
          <div className="kpi-footer">
            <span>Humedad atmosférica local</span>
            <span className="sim-tag-mini">SIMULADO</span>
          </div>
        </article>

        <article className={`kpi-card ${isIrrigating ? '' : 'green-accent'}`}>
          <div className="kpi-header">
            <span className="kpi-title">Estado del Riego</span>
            <div className="kpi-icon">
              <Power size={20} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span
              className="kpi-value"
              style={{
                fontSize: '1.45rem',
                color: isIrrigating ? '#0284c7' : '#059669'
              }}
            >
              {isIrrigating ? 'RIEGO ACTIVO' : 'EN ESPERA'}
            </span>
          </div>
          <div className="kpi-footer">
            <span>Electroválvula: {isIrrigating ? 'Abierta' : 'Cerrada'}</span>
            <span className="sim-tag-mini">SIMULADO</span>
          </div>
        </article>
      </section>

      {/* 3. CULTIVOS & 4. CONTROL DE RIEGO */}
      <div className="main-grid">
        {/* Panel de Cultivos */}
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                <Sprout size={20} color="#059669" />
                <span>Monitoreo por Cultivo Experimental</span>
              </h2>
              <p className="panel-subtitle">
                Lecturas diferenciadas por cama de cultivo (Datos simulados cada 3 s)
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={handleSimulateDrought}
              title="Simular caída de humedad debajo del umbral para probar la activación automática"
            >
              <Sparkles size={14} />
              <span>Simular Suelo Seco</span>
            </button>
          </div>

          <div className="crops-grid">
            {/* Cilantro */}
            <div className="crop-card">
              <div className="crop-top">
                <div className="crop-name-box">
                  <h3>Cilantro</h3>
                  <span className="crop-scientific">Coriandrum sativum L.</span>
                </div>
                <span className={`status-pill ${cilantroEval.pillClass}`}>
                  {cilantroEval.statusText}
                </span>
              </div>

              <div className="moisture-meter">
                <div className="meter-labels">
                  <span>Humedad del suelo asignada</span>
                  <span className="mono">{telemetry.cilantroMoisture.toFixed(1)}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${clamp(telemetry.cilantroMoisture, 0, 100)}%`,
                      backgroundColor: cilantroEval.barColor
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: '#64748b'
                  }}
                >
                  <span>Rango ideal: 45% – 70%</span>
                  <span>Sensor S-01 (Simulado)</span>
                </div>
              </div>

              <div className="crop-recommendation">
                <strong>Recomendación Agronómica</strong>
                {cilantroEval.recommendation}
              </div>
            </div>

            {/* Hierbabuena */}
            <div className="crop-card">
              <div className="crop-top">
                <div className="crop-name-box">
                  <h3>Hierbabuena</h3>
                  <span className="crop-scientific">Mentha spicata L.</span>
                </div>
                <span className={`status-pill ${hierbabuenaEval.pillClass}`}>
                  {hierbabuenaEval.statusText}
                </span>
              </div>

              <div className="moisture-meter">
                <div className="meter-labels">
                  <span>Humedad del suelo asignada</span>
                  <span className="mono">{telemetry.hierbabuenaMoisture.toFixed(1)}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${clamp(telemetry.hierbabuenaMoisture, 0, 100)}%`,
                      backgroundColor: hierbabuenaEval.barColor
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: '#64748b'
                  }}
                >
                  <span>Rango ideal: 50% – 75%</span>
                  <span>Sensor S-02 (Simulado)</span>
                </div>
              </div>

              <div className="crop-recommendation">
                <strong>Recomendación Agronómica</strong>
                {hierbabuenaEval.recommendation}
              </div>
            </div>
          </div>
        </section>

        {/* Panel de Control de Riego */}
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                <Settings2 size={20} color="#0284c7" />
                <span>Control y Automatización de Riego</span>
              </h2>
              <p className="panel-subtitle">
                Gestión manual o por histéresis de umbrales configurables
              </p>
            </div>
          </div>

          <div className="control-section">
            {/* Interruptor Modo Automático */}
            <div className="mode-switch-box">
              <div className="mode-info">
                <h4>Modo Automático Inteligente</h4>
                <p>
                  {autoMode
                    ? `Activo: inicia < ${minThreshold}% y detiene ≥ ${maxThreshold}%`
                    : 'Inactivo: control manual directo habilitado'}
                </p>
              </div>
              <label className="toggle-switch" aria-label="Habilitar o deshabilitar modo automático">
                <input
                  type="checkbox"
                  checked={autoMode}
                  onChange={handleToggleAutoMode}
                />
                <span className="slider" />
              </label>
            </div>

            {/* Botón de Acción Manual */}
            <div className="manual-action-box">
              <button
                type="button"
                onClick={handleManualIrrigationToggle}
                className={`btn-irrigation ${isIrrigating ? 'stop' : 'start'}`}
              >
                <Power size={18} />
                <span>
                  {isIrrigating
                    ? 'Desactivar Riego Manualmente'
                    : 'Activar Riego Manualmente'}
                </span>
              </button>
              <span className="helper-note">
                {autoMode
                  ? 'Nota: Al accionar el botón manual, el sistema conmutará automáticamente a Modo Manual para evitar estados contradictorios.'
                  : 'Modo Manual activo: el operador tiene el control exclusivo de la electroválvula simulada.'}
              </span>
            </div>

            {/* Configuración de Umbrales */}
            <div className="thresholds-box">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Sliders size={15} color="#0284c7" />
                  Umbrales de Automatización
                </span>
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={() => {
                    setMinThreshold(45)
                    setMaxThreshold(72)
                    addEvent('config', 'Umbrales restaurados a valores predeterminados (45% – 72%).')
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Restaurar</span>
                </button>
              </div>

              <div className="threshold-item">
                <div className="threshold-header">
                  <span>Umbral Inferior (Activar riego debajo de):</span>
                  <span className="threshold-val mono">{minThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="75"
                  step="1"
                  value={minThreshold}
                  onChange={handleMinThresholdChange}
                  className="range-slider"
                />
              </div>

              <div className="threshold-item">
                <div className="threshold-header">
                  <span>Umbral Superior (Detener riego al alcanzar):</span>
                  <span className="threshold-val mono">{maxThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="35"
                  max="90"
                  step="1"
                  value={maxThreshold}
                  onChange={handleMaxThresholdChange}
                  className="range-slider"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 5. GRÁFICOS DE EVOLUCIÓN TEMPORAL */}
      <section className="charts-grid" aria-label="Gráficos de Evolución Temporal">
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                <Activity size={20} color="#0284c7" />
                <span>Evolución Temporal – Humedad del Suelo (%)</span>
              </h2>
              <p className="panel-subtitle">
                Serie de tiempo en vivo (Datos simulados – Actualización cada 3 s)
              </p>
            </div>
            <span className="sim-tag-mini mono">ACTUAL: {telemetry.soilMoisture.toFixed(1)}%</span>
          </div>

          <TelemetryChart
            data={historyData}
            dataKey="soilMoisture"
            color="#0284c7"
            unit="%"
            minDomain={20}
            maxDomain={95}
            thresholds={{ min: minThreshold, max: maxThreshold }}
          />

          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ background: '#0284c7' }}></span>
              <span>Humedad Promedio Suelo</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: '#d97706' }}></span>
              <span>Umbral Mínimo ({minThreshold}%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: '#059669' }}></span>
              <span>Umbral Máximo ({maxThreshold}%)</span>
            </div>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                <Thermometer size={20} color="#d97706" />
                <span>Evolución Temporal – Temperatura Ambiental (°C)</span>
              </h2>
              <p className="panel-subtitle">
                Curva térmica microclimática Sabanas de Sucre (Datos simulados)
              </p>
            </div>
            <span className="sim-tag-mini mono">ACTUAL: {telemetry.temperature.toFixed(1)}°C</span>
          </div>

          <TelemetryChart
            data={historyData}
            dataKey="temperature"
            color="#d97706"
            unit="°"
            minDomain={24}
            maxDomain={39}
          />

          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ background: '#d97706' }}></span>
              <span>Temperatura Ambiente Simulada (°C)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: '#94a3b8' }}></span>
              <span>Intervalo de muestreo: 3.0 segundos</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. ESTADO DEL SISTEMA E HISTORIAL DE EVENTOS */}
      <section className="system-grid" aria-label="Estado del Sistema y Registro de Eventos">
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                <Wifi size={20} color="#059669" />
                <span>Estado Operativo del Sistema</span>
              </h2>
              <p className="panel-subtitle">Diagnóstico del nodo virtual de telemetría</p>
            </div>
          </div>

          <div className="status-list">
            <div className="status-row">
              <span className="status-label">
                <span className="pulse-dot green"></span>
                Conexión de Sensores
              </span>
              <span className="status-value">Conectado (Simulación Activa)</span>
            </div>

            <div className="status-row">
              <span className="status-label">
                <Clock size={15} />
                Último Registro Recibido
              </span>
              <span className="status-value mono">{telemetry.lastUpdate}</span>
            </div>

            <div className="status-row">
              <span className="status-label">
                <Settings2 size={15} />
                Estado de Automatización
              </span>
              <span
                className="status-value"
                style={{ color: autoMode ? '#059669' : '#0284c7' }}
              >
                {autoMode ? 'Habilitada (Por Umbrales)' : 'Deshabilitada (Modo Manual)'}
              </span>
            </div>

            <div className="status-row">
              <span className="status-label">
                <Droplets size={15} />
                Actuador de Riego
              </span>
              <span className="status-value">
                {isIrrigating ? 'Electroválvula Abierta (ON)' : 'Electroválvula Cerrada (OFF)'}
              </span>
            </div>

            <div className="status-row">
              <span className="status-label">
                <Activity size={15} />
                Muestras Procesadas
              </span>
              <span className="status-value mono">{telemetry.sampleCount} lecturas</span>
            </div>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                <History size={20} color="#0284c7" />
                <span>Historial de Eventos y Acciones</span>
              </h2>
              <p className="panel-subtitle">
                Bitácora de decisiones automáticas e intervenciones del usuario
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={() =>
                setEvents([
                  {
                    id: Date.now(),
                    time: formatTime(new Date()),
                    type: 'config',
                    text: 'Historial de eventos reiniciado por el usuario.'
                  }
                ])
              }
            >
              Limpiar bitácora
            </button>
          </div>

          <div className="event-log-list">
            {events.map((ev) => (
              <div key={ev.id} className={`event-item ${ev.type}`}>
                <span className="event-time mono">[{ev.time}]</span>
                <span className="event-text">{ev.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. EXPLICACIÓN TÉCNICA DESPLEGABLE */}
      <section className="tech-accordion" aria-label="Arquitectura Técnica del Sistema">
        <button
          type="button"
          className="accordion-trigger"
          onClick={() => setTechOpen(!techOpen)}
          aria-expanded={techOpen}
        >
          <div className="panel-title">
            <Cpu size={20} color="#0284c7" />
            <span>Arquitectura Técnica y Escalabilidad de Hardware (Desplegable)</span>
          </div>
          {techOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>

        {techOpen && (
          <div className="accordion-content">
            <div className="pipeline-steps">
              <div className="pipeline-card">
                <span className="step-num">Etapa 1</span>
                <h4>Sensores Simulados</h4>
                <p>
                  Generación de variables edafoclimáticas (humedad del suelo en cilantro y
                  hierbabuena, temperatura y humedad relativa) con variaciones plausibles cada 3 s.
                </p>
              </div>

              <div className="pipeline-card">
                <span className="step-num">Etapa 2</span>
                <h4>Procesamiento de Datos</h4>
                <p>
                  Normalización de lecturas, cálculo de humedad radicular promedio y almacenamiento
                  en ventana deslizante para series temporales.
                </p>
              </div>

              <div className="pipeline-card">
                <span className="step-num">Etapa 3</span>
                <h4>Lógica de Decisión</h4>
                <p>
                  Algoritmo de control por histéresis: compara la humedad con los umbrales inferior
                  ({minThreshold}%) y superior ({maxThreshold}%) o prioriza el mando manual.
                </p>
              </div>

              <div className="pipeline-card">
                <span className="step-num">Etapa 4</span>
                <h4>Control de Riego</h4>
                <p>
                  Conmutación sin conflictos del estado del actuador virtual (apertura/cierre de
                  paso de agua) y retroalimentación sobre la humedad del sustrato.
                </p>
              </div>

              <div className="pipeline-card">
                <span className="step-num">Etapa 5</span>
                <h4>Visualización Web</h4>
                <p>
                  Interfaz científica adaptable en React + Vite con indicadores en tiempo real,
                  recomendaciones agronómicas por cultivo y bitácora de auditoría.
                </p>
              </div>
            </div>

            <div className="hardware-box">
              <h4>
                <Cpu size={17} />
                <span>Proyección de Integración Física Futura (Fase de Campo – Sabanas de Sucre)</span>
              </h4>
              <p>
                Este prototipo opera actualmente en <strong>Modo Simulación</strong> 100% en el
                navegador. En la fase de implementación física en campo, la arquitectura está
                diseñada para integrarse con un microcontrolador <strong>ESP32</strong> conectado a
                sensores capacitivos de humedad de suelo (anticorrosivos para camas de cilantro y
                hierbabuena), un sensor ambiental digital (<strong>DHT22 / BME280</strong> para
                temperatura y humedad relativa) y un <strong>módulo de control de riego</strong>{' '}
                (relé optoacoplado + electroválvula solenoide o bomba de diafragma) enviando
                telemetría mediante MQTT/HTTP.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
