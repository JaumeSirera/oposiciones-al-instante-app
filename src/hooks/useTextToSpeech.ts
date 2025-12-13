import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTextToSpeechReturn {
  speak: (text: string) => void;
  stop: () => void;
  isPlaying: boolean;
  isEnabled: boolean;
  toggleEnabled: () => void;
  isSupported: boolean;
}

export function useTextToSpeech(): UseTextToSpeechReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(() => {
    const saved = localStorage.getItem('tts_enabled');
    return saved === 'true';
  });
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    localStorage.setItem('tts_enabled', String(isEnabled));
  }, [isEnabled]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  const speak = useCallback((text: string) => {
    if (!isSupported || !isEnabled || !text) return;

    // Detener cualquier reproducción anterior
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Detectar idioma del texto (básico)
    const detectLanguage = (t: string): string => {
      // Caracteres chinos
      if (/[\u4e00-\u9fff]/.test(t)) return 'zh-CN';
      // Caracteres alemanes
      if (/[äöüßÄÖÜ]/.test(t)) return 'de-DE';
      // Palabras francesas comunes
      if (/\b(le|la|les|un|une|des|est|sont|avec|pour|dans)\b/i.test(t)) return 'fr-FR';
      // Palabras portuguesas
      if (/\b(não|sim|você|para|com|como|quando|porque)\b/i.test(t)) return 'pt-BR';
      // Palabras inglesas
      if (/\b(the|is|are|was|were|have|has|been|with|this|that)\b/i.test(t)) return 'en-US';
      // Por defecto español
      return 'es-ES';
    };

    utterance.lang = detectLanguage(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  }, [isSupported, isEnabled]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [isSupported]);

  const toggleEnabled = useCallback(() => {
    if (!isEnabled) {
      setIsEnabled(true);
    } else {
      stop();
      setIsEnabled(false);
    }
  }, [isEnabled, stop]);

  return {
    speak,
    stop,
    isPlaying,
    isEnabled,
    toggleEnabled,
    isSupported,
  };
}
