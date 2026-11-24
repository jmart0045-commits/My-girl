import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VoiceEngine, VoiceLanguage } from '../types';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface UseVoiceAgentOptions {
  language: VoiceLanguage;
  voiceEngine: VoiceEngine;
  elevenLabsVoiceId: string;
  autoSpeak: boolean;
  onTranscript: (text: string) => void;
  onWakeDetected: () => void;
}

export function useVoiceAgent({
  language,
  voiceEngine,
  elevenLabsVoiceId,
  autoSpeak,
  onTranscript,
  onWakeDetected,
}: UseVoiceAgentOptions) {
  const [speechSupported] = useState(() => Boolean(getSpeechRecognitionCtor()));
  const [ttsSupported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window
  );
  const [dictating, setDictating] = useState(false);
  const [wakeActive, setWakeActive] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const dictationRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeWantedRef = useRef(false);
  const wakeCooldownRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  const cleanupAudio = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const speakBrowser = useCallback(
    (text: string, overrideLang?: VoiceLanguage) => {
      if (!ttsSupported || !text.trim()) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const targetLang = overrideLang ?? language;
        utterance.lang = targetLang;
        const voices = window.speechSynthesis.getVoices();
        const match =
          voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.toLowerCase())) ??
          voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.split('-')[0]));
        if (match) {
          utterance.voice = match;
        }
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setSpeaking(false);
      }
    },
    [language, ttsSupported]
  );

  const speak = useCallback(
    async (text: string, overrideLang?: VoiceLanguage) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      cleanupAudio();
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }

      if (voiceEngine === 'browser') {
        speakBrowser(trimmed, overrideLang);
        return;
      }

      const controller = new AbortController();
      ttsAbortRef.current = controller;
      setSynthesizing(true);
      setVoiceNotice(null);

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmed.slice(0, 2500),
            voiceId: elevenLabsVoiceId,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `ElevenLabs request failed (${res.status})`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setSpeaking(true);
        audio.onended = () => {
          setSpeaking(false);
          cleanupAudio();
        };
        audio.onerror = () => {
          setSpeaking(false);
          cleanupAudio();
          setVoiceNotice('Unable to play ElevenLabs audio stream.');
        };

        await audio.play();
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setSpeaking(false);
        setVoiceNotice(
          err instanceof Error ? err.message : 'ElevenLabs synthesis failed.'
        );
      } finally {
        setSynthesizing(false);
      }
    },
    [cleanupAudio, elevenLabsVoiceId, speakBrowser, ttsSupported, voiceEngine]
  );

  const stopSpeaking = useCallback(() => {
    cleanupAudio();
    if (ttsSupported) {
      window.speechSynthesis.cancel();
    }
    setSynthesizing(false);
    setSpeaking(false);
  }, [cleanupAudio, ttsSupported]);

  const stopDictation = useCallback(() => {
    try {
      dictationRef.current?.stop();
    } catch {
      // ignore
    }
    dictationRef.current = null;
    setDictating(false);
  }, []);

  const stopWakeListener = useCallback(() => {
    wakeWantedRef.current = false;
    try {
      wakeRef.current?.abort();
    } catch {
      // ignore
    }
    wakeRef.current = null;
    setWakeActive(false);
  }, []);

  const startDictation = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceNotice('Browser speech recognition is unavailable in this browser.');
      return;
    }
    if (wakeWantedRef.current) {
      stopWakeListener();
    }
    setVoiceNotice(null);
    stopDictation();

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;

    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const transcript = results
        .map((r) => r[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript) {
        onTranscript(transcript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setVoiceNotice(`Voice input error: ${event.error}`);
      }
      setDictating(false);
    };

    recognition.onend = () => {
      setDictating(false);
      dictationRef.current = null;
    };

    dictationRef.current = recognition;
    try {
      recognition.start();
      setDictating(true);
    } catch (err) {
      setDictating(false);
      setVoiceNotice(
        err instanceof Error ? err.message : 'Unable to start microphone recognition.'
      );
    }
  }, [language, onTranscript, stopDictation, stopWakeListener]);

  const startWakeListener = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceNotice('Wake phrase listener requires a Web Speech API compatible browser.');
      return;
    }
    if (dictationRef.current) {
      stopDictation();
    }
    setVoiceNotice(null);
    wakeWantedRef.current = true;

    const launch = () => {
      if (!wakeWantedRef.current) return;
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const words = Array.from(event.results)
          .map((r) => r[0]?.transcript ?? '')
          .join(' ')
          .toLowerCase();
        if (words.includes('my girl')) {
          const now = Date.now();
          if (now - wakeCooldownRef.current > 3500) {
            wakeCooldownRef.current = now;
            if (autoSpeak) {
              void speak('ဟုတ်ကဲ့၊ ပြောပါရှင်', 'my-MM');
            }
            onWakeDetected();
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          wakeWantedRef.current = false;
          setWakeActive(false);
          setVoiceNotice('Microphone permission was denied for wake listening.');
        }
      };

      recognition.onend = () => {
        if (wakeWantedRef.current) {
          window.setTimeout(launch, 650);
        } else {
          setWakeActive(false);
        }
      };

      wakeRef.current = recognition;
      try {
        recognition.start();
        setWakeActive(true);
      } catch {
        setWakeActive(false);
      }
    };

    launch();
  }, [autoSpeak, onWakeDetected, speak, stopDictation]);

  useEffect(() => {
    return () => {
      wakeWantedRef.current = false;
      cleanupAudio();
      try {
        dictationRef.current?.abort();
      } catch {
        // ignore
      }
      try {
        wakeRef.current?.abort();
      } catch {
        // ignore
      }
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [cleanupAudio, ttsSupported]);

  const clearVoiceNotice = useCallback(() => setVoiceNotice(null), []);

  return useMemo(
    () => ({
      speechSupported,
      ttsSupported,
      dictating,
      wakeActive,
      speaking,
      synthesizing,
      voiceNotice,
      clearVoiceNotice,
      startDictation,
      stopDictation,
      startWakeListener,
      stopWakeListener,
      speak,
      stopSpeaking,
    }),
    [
      speechSupported,
      ttsSupported,
      dictating,
      wakeActive,
      speaking,
      synthesizing,
      voiceNotice,
      clearVoiceNotice,
      startDictation,
      stopDictation,
      startWakeListener,
      stopWakeListener,
      speak,
      stopSpeaking,
    ]
  );
}
