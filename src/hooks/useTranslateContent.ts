import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';

// Cache en memoria para acceso rápido
const translationCache = new Map<string, string>();

// Prefijo para localStorage
const STORAGE_PREFIX = 'trans_';
const CACHE_VERSION = 'v1';

// Cargar cache persistente al iniciar
function loadPersistentCache() {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}cache_${CACHE_VERSION}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([key, value]) => {
        translationCache.set(key, value as string);
      });
      console.debug('[TranslationCache] Loaded', translationCache.size, 'entries from localStorage');
    }
  } catch (e) {
    console.warn('[TranslationCache] Failed to load persistent cache:', e);
  }
}

// Guardar cache en localStorage (limitado a 500 entradas más recientes)
function savePersistentCache() {
  try {
    const entries = Array.from(translationCache.entries());
    // Mantener solo las últimas 500 traducciones para no saturar localStorage
    const limited = entries.slice(-500);
    const obj = Object.fromEntries(limited);
    localStorage.setItem(`${STORAGE_PREFIX}cache_${CACHE_VERSION}`, JSON.stringify(obj));
  } catch (e) {
    console.warn('[TranslationCache] Failed to save persistent cache:', e);
  }
}

// Cargar cache al importar el módulo
loadPersistentCache();

export function useTranslateContent() {
  const { i18n } = useTranslation();
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);
  const failedAttemptRef = useRef(false);

  const getCacheKey = (text: string, targetLang: string) => `${targetLang}:${text}`;

  const translateTexts = useCallback(async (texts: string[]): Promise<string[]> => {
    const currentLang = i18n.language;
    
    console.debug('[useTranslateContent] translateTexts called', {
      currentLang,
      textsCount: texts.length,
      sample: texts.slice(0, 5),
    });
    
    // Si es español, devolver originales
    if (currentLang === 'es') {
      console.debug('[useTranslateContent] Language is es, returning originals');
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
 
    console.debug('[useTranslateContent] Cache check', {
      total: texts.length,
      fromCache: results.filter(Boolean).length,
      toTranslate: textsToTranslate.length,
    });
 
    // Si todo está en cache, devolver
    if (textsToTranslate.length === 0) {
      console.debug('[useTranslateContent] All texts from cache, returning results');
      return results;
    }
 
    setIsTranslating(true);
    setTranslationFailed(false);
 
    try {
      // Vamos a traducir en lotes para evitar timeouts / errores 503
      const BATCH_SIZE = 40;
 
      for (let start = 0; start < textsToTranslate.length; start += BATCH_SIZE) {
        const batch = textsToTranslate.slice(start, start + BATCH_SIZE);
 
        let data: any = null;
        let error: any = null;
 
        console.debug('[useTranslateContent] Translating batch', {
          batchIndex: start / BATCH_SIZE,
          batchSize: batch.length,
        });
 
        // Pequeño sistema de reintentos por lote: hasta 2 intentos si hay fallo de red
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const result = await supabase.functions.invoke('translate-content', {
              body: {
                texts: batch.map(t => t.text),
                targetLanguage: currentLang,
                sourceLanguage: 'es'
              }
            });
 
            data = result.data;
            error = result.error;
 
            if (!error) break;
            console.error(`Translation error (batch ${start / BATCH_SIZE}, attempt ${attempt + 1}):`, error);
          } catch (e) {
            error = e;
            console.error(`Translation fetch error (batch ${start / BATCH_SIZE}, attempt ${attempt + 1}):`, e);
          }
        }
 
        if (error) {
          // En caso de error definitivo en este lote, marcar como fallido y devolver originales de ese lote
          console.error('[useTranslateContent] Final error for batch, keeping originals', {
            batchIndex: start / BATCH_SIZE,
            error,
          });
          setTranslationFailed(true);
          batch.forEach(({ index, text }) => {
            results[index] = text;
          });
        } else {
          const translations = data?.translations || [];
          console.debug('[useTranslateContent] Batch translated successfully', {
            batchIndex: start / BATCH_SIZE,
            translationsLength: translations.length,
          });
          batch.forEach(({ index, text }, i) => {
            const translated = translations[i] || text;
            results[index] = translated;
            // Guardar en cache memoria
            translationCache.set(getCacheKey(text, currentLang), translated);
          });
          // Persistir cache después de cada lote exitoso
          savePersistentCache();
        }
      }
    } catch (err) {
      console.error('Translation failed:', err);
      setTranslationFailed(true);
      textsToTranslate.forEach(({ index, text }) => {
        results[index] = text;
      });
    } finally {
      setIsTranslating(false);
      console.debug('[useTranslateContent] translateTexts finished', {
        finalResults: results.length,
      });
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
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}cache_${CACHE_VERSION}`);
    } catch (e) {
      console.warn('[TranslationCache] Failed to clear persistent cache:', e);
    }
  }, []);

  const retryTranslation = useCallback(() => {
    setTranslationFailed(false);
    translationCache.clear();
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}cache_${CACHE_VERSION}`);
    } catch (e) {
      console.warn('[TranslationCache] Failed to clear persistent cache:', e);
    }
  }, []);

  return {
    translateTexts,
    translateQuestion,
    isTranslating,
    translationFailed,
    retryTranslation,
    clearCache,
    needsTranslation: i18n.language !== 'es'
  };
}
