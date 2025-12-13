import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTextToSpeechReturn {
  speak: (text: string) => void;
  stop: () => void;
  isPlaying: boolean;
  isEnabled: boolean;
  toggleEnabled: () => void;
  isSupported: boolean;
}

const langMap: Record<string, string> = {
  es: 'es-ES',
  en: 'en-US',
  fr: 'fr-FR',
  pt: 'pt-BR',
  de: 'de-DE',
  zh: 'zh-CN',
};

export function useTextToSpeech(language: string = 'es'): UseTextToSpeechReturn {
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

    // Usar idioma pasado como parámetro
    utterance.lang = langMap[language] || 'es-ES';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  }, [isSupported, isEnabled, language]);

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
