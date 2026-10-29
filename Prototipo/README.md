# Huerta Inteligente ENGINE – Piloto Sucre

Prototipo web funcional de monitoreo y automatización agrícola diseñado para una huerta experimental de **cilantro (*Coriandrum sativum*)** y **hierbabuena (*Mentha spicata*)** en la región de **Sabanas de Sucre, Colombia**.

## Características Principales

- **Modo Simulación Transparente:** Generación de lecturas plausibles en tiempo real cada 3 segundos (humedad del suelo, temperatura ambiental, humedad relativa y estado de riego).
- **Monitoreo por Cultivo:** Tarjetas dedicadas para Cilantro y Hierbabuena con humedad asignada, estado agronómico y recomendación dinámica de riego.
- **Control de Riego Inteligente (Manual y Automático):**
  - Interruptor de modo automático con control por histéresis de umbrales configurables (inferior y superior).
  - Botón de activación/desactivación manual con conmutación segura para evitar estados contradictorios entre modo manual y automático.
  - Botón de prueba rápida (*Simular Suelo Seco*) para verificar la respuesta inmediata del automatismo.
- **Gráficos de Evolución Temporal:** Series de tiempo en SVG nativo y adaptable para humedad del suelo y temperatura ambiental.
- **Estado del Sistema y Bitácora:** Diagnóstico de conexión simulada, conteo de muestras y registro cronológico de eventos automáticos y manuales.
- **Explicación Técnica Desplegable:** Flujo completo desde sensores simulados hasta proyección de integración física futura con **ESP32**, sensores capacitivos de humedad de suelo, sensores ambientales y módulo de control de riego.

## Ejecución Local

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Abrir en el navegador la URL indicada en consola (por defecto `http://localhost:5173`).

## Construcción para Producción y Despliegue en Vercel

Para compilar y verificar el paquete de producción:
```bash
npm run build
```

El proyecto incluye `vercel.json` preconfigurado y no requiere variables de entorno, claves API ni base de datos.
