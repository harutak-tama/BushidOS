const statusEl = document.querySelector('#status')

const SHARPNESS_THRESHOLD = 0.09
const MATCH_HOLD_MS = 1400
const SAMPLE_INTERVAL_MS = 120
const SHARPNESS_SMOOTH_ALPHA = 0.2
const BASE_URL = import.meta?.env?.BASE_URL ?? './public/'
const REDIRECT_URL = `${BASE_URL}chooseApp.html?v=2`

function measureSharpness(imageData, width, height) {
  const luminance = new Float32Array(width * height)

  for (let i = 0, p = 0; i < imageData.length; i += 4, p += 1) {
    const r = imageData[i]
    const g = imageData[i + 1]
    const b = imageData[i + 2]
    luminance[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  let laplaceSum = 0
  let sampleCount = 0

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      const center = luminance[idx]
      const top = luminance[idx - width]
      const bottom = luminance[idx + width]
      const left = luminance[idx - 1]
      const right = luminance[idx + 1]
      const laplace = (4 * center) - top - bottom - left - right
      laplaceSum += Math.abs(laplace)
      sampleCount += 1
    }
  }

  if (sampleCount === 0) {
    return 0
  }

  return laplaceSum / (sampleCount * 255)
}

async function startBlurWatcher() {
  if (!navigator.mediaDevices?.getUserMedia) {
    statusEl.textContent = 'Camera API is not available on this device.'
    return
  }

  const video = document.createElement('video')
  video.autoplay = true
  video.playsInline = true
  video.muted = true

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) {
    statusEl.textContent = 'Failed to initialize image processor.'
    return
  }

  let stream

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    })
  } catch (error) {
    statusEl.textContent = 'Camera permission is required.'
    return
  }

  video.srcObject = stream

  try {
    await video.play()
  } catch (error) {
    statusEl.textContent = 'Unable to start camera stream.'
    stream.getTracks().forEach((track) => track.stop())
    return
  }

  statusEl.textContent = 'Monitoring blur for chooseApp...'

  let matchedSince = null
  let smoothedSharpness = null

  const intervalId = window.setInterval(() => {
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return
    }

    canvas.width = 64
    canvas.height = Math.max(36, Math.round((64 * video.videoHeight) / video.videoWidth))

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const sharpness = measureSharpness(imageData, canvas.width, canvas.height)
    smoothedSharpness =
      smoothedSharpness === null
        ? sharpness
        : smoothedSharpness + SHARPNESS_SMOOTH_ALPHA * (sharpness - smoothedSharpness)

    console.log(
      `[sharpness] ${sharpness.toFixed(3)}, [smooth] ${smoothedSharpness.toFixed(3)}, [blur] ${smoothedSharpness <= SHARPNESS_THRESHOLD
      }`
    )

    const meetsCondition = smoothedSharpness <= SHARPNESS_THRESHOLD

    if (meetsCondition) {
      matchedSince = matchedSince ?? performance.now()

      if (performance.now() - matchedSince < MATCH_HOLD_MS) {
        return
      }

      window.clearInterval(intervalId)
      stream.getTracks().forEach((track) => track.stop())
      window.location.replace(REDIRECT_URL)
      return
    }

    matchedSince = null
  }, SAMPLE_INTERVAL_MS)
}

startBlurWatcher()
