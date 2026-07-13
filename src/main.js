import './style.css'

const statusEl = document.querySelector('#status')

const BRIGHTNESS_THRESHOLD = 0.5
const MATCH_HOLD_MS = 700
const SAMPLE_INTERVAL_MS = 120
const REDIRECT_URL = `${import.meta.env.BASE_URL}chooseApp.html`

async function startBrightnessWatcher() {
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

  statusEl.textContent = 'Monitoring brightness for chooseApp...'

  let matchedSince = null

  const intervalId = window.setInterval(() => {
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return
    }

    canvas.width = 64
    canvas.height = Math.max(36, Math.round((64 * video.videoHeight) / video.videoWidth))

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let luminanceSum = 0

    for (let i = 0; i < imageData.length; i += 4) {
      const r = imageData[i]
      const g = imageData[i + 1]
      const b = imageData[i + 2]
      luminanceSum += 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    const pixelCount = imageData.length / 4
    const brightness = luminanceSum / (pixelCount * 255)

    console.log(
      `[brightness] ${brightness.toFixed(3)} (${(brightness * 100).toFixed(1)}%)`
    )

    const meetsCondition = brightness <= BRIGHTNESS_THRESHOLD

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

startBrightnessWatcher()
