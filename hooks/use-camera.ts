import { useRef, useState, useCallback } from 'react';

export interface CameraHook {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isStreaming: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureImage: () => string | null;
  // Zoom
  zoomRange: { min: number; max: number; step: number } | null;
  currentZoom: number;
  setZoom: (z: number) => Promise<void>;
  // Torch
  torchSupported: boolean;
  torchOn: boolean;
  toggleTorch: () => Promise<void>;
}

/**
 * Turn a getUserMedia failure into something a user can act on.
 *
 * These arrive as DOMExceptions whose `.message` is often empty and whose
 * `.name` is jargon, so the name is what we actually branch on.
 */
function describeCameraError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow camera access for this site in your browser settings, then try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use by another app. Close it and try again.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'This camera does not support the requested settings.';
    case 'AbortError':
      return 'The camera stopped unexpectedly. Please try again.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'Could not access the camera.';
  }
}

export const useCamera = (): CameraHook => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const torchOnRef = useRef(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsStreaming(false);

      // --- Fix stream-orphan bug: stop any existing stream before requesting a new one ---
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;

      // Check if getUserMedia is supported.
      // Browsers only expose mediaDevices in a secure context, so the usual
      // cause of this on a working browser is the app being served over plain
      // http:// (e.g. testing on a LAN IP) rather than a missing feature.
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const insecure = typeof window !== 'undefined' && !window.isSecureContext;
        throw new Error(
          insecure
            ? 'The camera needs a secure connection. Open the app over https:// or on localhost.'
            : 'This browser does not support camera access.',
        );
      }

      console.log('Requesting camera access...');

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Prefer the back camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (err) {
        // Some devices — laptops with only a front camera, certain Android
        // WebViews — reject the rear-camera hint outright instead of ignoring
        // it. Any camera beats no camera, so retry unconstrained.
        if ((err as { name?: string } | null)?.name !== 'OverconstrainedError') throw err;
        console.warn('Rear camera unavailable, falling back to any camera');
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;

      const video = videoRef.current;

      // A missing <video> used to be skipped silently: the stream stayed live,
      // isStreaming stayed false, and startCamera *resolved* — so the caller
      // logged success while the UI sat on a placeholder forever. Fail loudly,
      // and release the camera so the device light doesn't stay on for nothing.
      if (!video) {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        throw new Error('Camera view was not ready. Please try again.');
      }

      video.srcObject = stream;

      // Wait for the video to be ready, then play.
      await new Promise<void>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          video.onloadedmetadata = null;
          video.onerror = null;
          clearTimeout(timer);
        };
        const succeed = () => { if (!settled) { settled = true; cleanup(); resolve(); } };
        const fail = (err: Error) => { if (!settled) { settled = true; cleanup(); reject(err); } };

        // Nothing below is guaranteed to fire. Without a deadline, a re-attach
        // that never emits metadata leaves this promise pending forever and the
        // scanner stuck mid-open with no error to show.
        const timer = setTimeout(
          () => fail(new Error('Camera timed out while starting. Please try again.')),
          10000,
        );

        const play = () => {
          video.play()
            .then(() => { setIsStreaming(true); succeed(); })
            .catch(err => fail(err instanceof Error ? err : new Error('Could not start the camera preview')));
        };

        // On a fast re-attach the metadata event may already have fired, in which
        // case onloadedmetadata never fires again — check the state first.
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          play();
        } else {
          video.onloadedmetadata = play;
          video.onerror = () => fail(new Error('Camera view failed to load'));
        }
      });

      // --- Detect zoom and torch capabilities ---
      try {
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities() as any;

          if (capabilities.zoom) {
            setZoomRange({
              min: capabilities.zoom.min,
              max: capabilities.zoom.max,
              step: capabilities.zoom.step ?? 0.1,
            });
            setCurrentZoom(capabilities.zoom.min);
          } else {
            setZoomRange(null);
          }

          if (capabilities.torch) {
            setTorchSupported(true);
          } else {
            setTorchSupported(false);
          }
        }
      } catch {
        // getCapabilities() not available on this browser — degrade silently
        setZoomRange(null);
        setTorchSupported(false);
      }
    } catch (err) {
      // Don't leave a half-acquired stream running behind a failure.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      const errorMessage = describeCameraError(err);
      setError(errorMessage);
      setIsStreaming(false);
      console.error('Camera error:', err);
      // Rethrow a message the caller can show as-is; the raw DOMException name
      // ("NotAllowedError") tells the user nothing about what to do next.
      throw new Error(errorMessage);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);

    // Reset capability state so controls hide when camera stops
    setZoomRange(null);
    setCurrentZoom(1);
    setTorchSupported(false);
    setTorchOn(false);
    torchOnRef.current = false;
  }, []);

  const captureImage = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) {
      console.log('Capture failed: missing refs or not streaming', {
        video: !!videoRef.current,
        canvas: !!canvasRef.current,
        streaming: isStreaming
      });
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      console.log('Capture failed: no canvas context');
      return null;
    }

    // Check if video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Capture failed: video dimensions are 0', {
        width: video.videoWidth,
        height: video.videoHeight
      });
      return null;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64 = dataUrl.split(',')[1]; // Remove data:image/jpeg;base64, prefix

    console.log('Image captured successfully', {
      width: canvas.width,
      height: canvas.height,
      dataSize: base64.length
    });

    return base64;
  }, [isStreaming]);

  const setZoom = useCallback(async (z: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: z } as any] });
      setCurrentZoom(z);
    } catch {
      // zoom not supported or constraint rejected — ignore silently
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOnRef.current;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      torchOnRef.current = next;
      setTorchOn(next);
    } catch {
      // torch not supported or constraint rejected — ignore silently
    }
  }, []);

  return {
    videoRef,
    canvasRef,
    isStreaming,
    error,
    startCamera,
    stopCamera,
    captureImage,
    zoomRange,
    currentZoom,
    setZoom,
    torchSupported,
    torchOn,
    toggleTorch,
  };
};
