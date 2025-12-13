import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';

// Cache para evitar re-traducir contenido ya traducido
const translationCache = new Map<string, string>();

export function useTranslateContent() {
  const { i18n } = useTranslation();
  const [isTranslating, setIsTranslating] = useState(false);

  const getCacheKey = (text: string, targetLang: string) => `${targetLang}:${text}`;

  const translateTexts = useCallback(async (texts: string[]): Promise<string[]> => {
    const currentLang = i18n.language;
    
    // Si es español, devolver originales
    if (currentLang === 'es') {
      return texts;
    }

    // Verificar cache
    const results: string[] = [];
    const textsToTranslate: { index: number; text: string }[] = [];

    texts.forEach((text, index) => {
      const cacheKey = getCacheKey(text, currentLang);
      const cached = translationCache.get(cacheKey);
      if (cached) {
        results[index] = cached;
      } else {
        textsToTranslate.push({ index, text });
      }
    });

    // Si todo está en cache, devolver
    if (textsToTranslate.length === 0) {
      return results;
    }

    setIsTranslating(true);

    try {
      let data: any = null;
      let error: any = null;

      // Pequeño sistema de reintentos: hasta 2 intentos si hay fallo de red
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await supabase.functions.invoke('translate-content', {
          body: {
            texts: textsToTranslate.map(t => t.text),
            targetLanguage: currentLang,
            sourceLanguage: 'es'
          }
        });

        data = result.data;
        error = result.error;

        if (!error) break;
        console.error('Translation error (attempt ' + (attempt + 1) + '):', error);
      }

      if (error) {
        // En caso de error definitivo, devolver originales
        textsToTranslate.forEach(({ index, text }) => {
          results[index] = text;
        });
      } else {
        const translations = data?.translations || [];
        textsToTranslate.forEach(({ index, text }, i) => {
          const translated = translations[i] || text;
          results[index] = translated;
          // Guardar en cache
          translationCache.set(getCacheKey(text, currentLang), translated);
        });
      }
    } catch (err) {
      console.error('Translation failed:', err);
      textsToTranslate.forEach(({ index, text }) => {
        results[index] = text;
      });
    } finally {
      setIsTranslating(false);
    }

    return results;
  }, [i18n.language]);

  const translateQuestion = useCallback(async (question: {
    pregunta: string;
    respuestas: string[];
  }): Promise<{ pregunta: string; respuestas: string[] }> => {
    const currentLang = i18n.language;
    
    if (currentLang === 'es') {
      return question;
    }

    const allTexts = [question.pregunta, ...question.respuestas];
    const translated = await translateTexts(allTexts);

    return {
      pregunta: translated[0],
      respuestas: translated.slice(1)
    };
  }, [i18n.language, translateTexts]);

  const clearCache = useCallback(() => {
    translationCache.clear();
  }, []);

  return {
    translateTexts,
    translateQuestion,
    isTranslating,
    clearCache,
    needsTranslation: i18n.language !== 'es'
  };
}
