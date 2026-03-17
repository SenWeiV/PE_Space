import { useState, useRef, useCallback } from "react";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface UseSpeechRecognitionProps {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}

export function useSpeechRecognition({ onTranscript, onError }: UseSpeechRecognitionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechSupported] = useState(() => {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  });
  const recognitionRef = useRef<any>(null);

  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        onTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        onError('无法访问麦克风，请检查浏览器权限设置');
      }
      setIsRecording(false);
      setIsPaused(false);
    };

    recognition.onend = () => {
      setIsRecording(prev => {
        if (prev) {
          try { recognition.start(); } catch (e) { return false; }
        }
        return prev;
      });
    };

    return recognition;
  }, [onTranscript, onError]);

  const start = useCallback(() => {
    if (!speechSupported) {
      onError('当前浏览器不支持语音识别功能，请使用 Chrome、Edge 或 Safari');
      return;
    }
    const recognition = initRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
        setIsRecording(true);
        setIsPaused(false);
      } catch (e) {}
    }
  }, [speechSupported, initRecognition, onError]);

  const pause = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsPaused(true);
    }
  }, [isRecording]);

  const resume = useCallback(() => {
    if (recognitionRef.current && isPaused) {
      try {
        recognitionRef.current.start();
        setIsPaused(false);
      } catch (e) {}
    }
  }, [isPaused]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  return { isRecording, isPaused, speechSupported, start, pause, resume, stop };
}
