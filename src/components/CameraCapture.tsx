import { useEffect, useRef, useState } from 'react'

interface Props {
  onCapture: (file: File) => void
  onClose: () => void
}

export function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 2160 } }, audio: false })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = async () => {
            setReady(true)
            // Wait 500ms for track capabilities to become available on Android
            await new Promise(r => setTimeout(r, 500))
            const track = stream.getVideoTracks()[0]
            if (!track) return
            const caps = track.getCapabilities() as MediaTrackCapabilities & { focusMode?: string[] }
            if (caps.focusMode?.includes('continuous')) {
              track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
            } else if (caps.focusMode?.includes('single-shot')) {
              track.applyConstraints({ advanced: [{ focusMode: 'single-shot' } as MediaTrackConstraintSet] }).catch(() => {})
            }
          }
        }
      })
      .catch(() => setError('Camera not available. Please allow camera access.'))

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const stopStream = () => streamRef.current?.getTracks().forEach(t => t.stop())

  const capture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      stopStream()
      onCapture(new File([blob], 'receipt.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="camera-modal">
      <div className="camera-modal__header">
        <div style={{ width: 36 }} />
        <span>Scan Receipt</span>
        <button className="camera-modal__close" onClick={() => { stopStream(); onClose() }}>✕</button>
      </div>

      {error ? (
        <div className="camera-modal__error">{error}</div>
      ) : (
        <video ref={videoRef} className="camera-modal__video" playsInline muted autoPlay />
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="camera-modal__footer">
        <button
          className="camera-modal__shutter"
          onClick={capture}
          disabled={!ready}
          aria-label="Take photo"
        />
      </div>
    </div>
  )
}
