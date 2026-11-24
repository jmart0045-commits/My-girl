import { Mic, MicOff, Square, Volume2, VolumeX } from 'lucide-react';
import type { ElevenLabsVoice, VoiceEngine, VoiceLanguage } from '../types';

interface HoloCoreProps {
  sending: boolean;
  dictating: boolean;
  wakeActive: boolean;
  speaking: boolean;
  synthesizing: boolean;
  language: VoiceLanguage;
  onChangeLanguage: (lang: VoiceLanguage) => void;
  voiceEngine: VoiceEngine;
  onChangeVoiceEngine: (engine: VoiceEngine) => void;
  elevenLabsConfigured: boolean;
  elevenLabsVoices: ElevenLabsVoice[];
  selectedVoiceId: string;
  onChangeVoiceId: (voiceId: string) => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  onStopSpeaking: () => void;
  onToggleWake: () => void;
  speechSupported: boolean;
}

export function HoloCore({
  sending,
  dictating,
  wakeActive,
  speaking,
  synthesizing,
  language,
  onChangeLanguage,
  voiceEngine,
  onChangeVoiceEngine,
  elevenLabsConfigured,
  elevenLabsVoices,
  selectedVoiceId,
  onChangeVoiceId,
  autoSpeak,
  onToggleAutoSpeak,
  onStopSpeaking,
  onToggleWake,
  speechSupported,
}: HoloCoreProps) {
  const statusLabel = sending
    ? 'Thinking…'
    : synthesizing
      ? 'Generating ElevenLabs voice…'
      : dictating
        ? 'Listening to voice…'
        : speaking
          ? 'Speaking reply…'
          : wakeActive
            ? 'Wake listener active · Say “My Girl”'
            : 'Ready · Burmese & English';

  const activePulse = sending || dictating || speaking || synthesizing || wakeActive;

  return (
    <div className="relative flex flex-col items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-cyan-500/25 dark:bg-[#070D1B]/90 backdrop-blur-md px-5 py-4 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-cyan-500/10 via-indigo-500/5 to-transparent dark:from-cyan-500/20 dark:via-indigo-500/10"
      />

      <div className="relative flex flex-col items-center">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <svg
            viewBox="0 0 160 160"
            className={`absolute inset-0 h-full w-full ${activePulse ? 'animate-holo-orbit' : ''}`}
            aria-hidden="true"
          >
            <circle
              cx="80"
              cy="80"
              r="72"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="6 6"
              className="text-slate-300 dark:text-cyan-400/35"
            />
            <circle
              cx="80"
              cy="80"
              r="58"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="28 14 10 14"
              className="text-sky-500/60 dark:text-cyan-400/70"
            />
          </svg>

          <div
            className={`relative flex h-22 w-22 flex-col items-center justify-center rounded-full border border-sky-400/40 bg-gradient-to-b from-sky-500/15 to-indigo-500/15 dark:border-cyan-400/50 dark:from-cyan-500/20 dark:to-indigo-600/25 shadow-[0_0_30px_rgba(56,189,248,0.22)] ${
              activePulse ? 'animate-holo-breathe' : ''
            }`}
          >
            <svg
              viewBox="0 0 64 64"
              className="h-10 w-10 text-sky-700 dark:text-cyan-200"
              aria-hidden="true"
            >
              <circle cx="32" cy="22" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M15 51c0-9.4 7.6-16 17-16s17 6.6 17 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="28.5" cy="21" r="1.3" fill="currentColor" />
              <circle cx="35.5" cy="21" r="1.3" fill="currentColor" />
            </svg>
            <span className="mt-0.5 font-display text-[9px] font-bold tracking-[0.2em] text-sky-800 dark:text-cyan-200">
              MY GIRL
            </span>
          </div>
        </div>

        <div className="mt-1 h-1.5 w-40 rounded-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent blur-[1px]" />
        <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-cyan-200/85 text-center">
          {statusLabel}
        </p>
      </div>

      <div className="relative z-10 mt-3 flex w-full flex-col items-center gap-2">
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-[#0D162B] border border-slate-200 dark:border-cyan-500/20 p-0.5">
            <button
              type="button"
              onClick={() => onChangeLanguage('my-MM')}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                language === 'my-MM'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-cyan-500/25 dark:text-cyan-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-100'
              }`}
            >
              မြန်မာ (my)
            </button>
            <button
              type="button"
              onClick={() => onChangeLanguage('en-US')}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                language === 'en-US'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-cyan-500/25 dark:text-cyan-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-100'
              }`}
            >
              English (US)
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleWake}
            disabled={!speechSupported}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${
              wakeActive
                ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-cyan-500/25 dark:bg-[#0D162B] dark:text-cyan-200 dark:hover:bg-cyan-500/15'
            }`}
          >
            {wakeActive ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            <span>{wakeActive ? 'Wake On' : 'Wake Off'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleAutoSpeak}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              autoSpeak
                ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-cyan-500/25 dark:bg-[#0D162B] dark:text-cyan-200 dark:hover:bg-cyan-500/15'
            }`}
          >
            {autoSpeak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>{autoSpeak ? 'Auto TTS' : 'TTS Off'}</span>
          </button>

          {(speaking || synthesizing) && (
            <button
              type="button"
              onClick={onStopSpeaking}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200 whitespace-nowrap shrink-0"
            >
              <Square className="h-3 w-3" />
              <span>Stop</span>
            </button>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <div
            role="group"
            aria-label="Voice engine"
            className="flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-[#0D162B] border border-slate-200 dark:border-cyan-500/20 p-0.5"
          >
            <button
              type="button"
              onClick={() => onChangeVoiceEngine('elevenlabs')}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                voiceEngine === 'elevenlabs'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-indigo-500/30 dark:text-cyan-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-100'
              }`}
            >
              ElevenLabs
            </button>
            <button
              type="button"
              onClick={() => onChangeVoiceEngine('browser')}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                voiceEngine === 'browser'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-indigo-500/30 dark:text-cyan-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-100'
              }`}
            >
              Browser
            </button>
          </div>

          {voiceEngine === 'elevenlabs' && (
            <select
              value={selectedVoiceId}
              onChange={(e) => onChangeVoiceId(e.target.value)}
              aria-label="ElevenLabs voice"
              className="rounded-lg border border-slate-200 dark:border-cyan-500/25 bg-white dark:bg-[#0D162B] px-2.5 py-1 text-[11px] text-slate-700 dark:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 max-w-[200px]"
            >
              {elevenLabsVoices.map((v) => (
                <option
                  key={v.id}
                  value={v.id}
                  className="bg-white dark:bg-[#0D162B] text-slate-900 dark:text-slate-100"
                >
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {voiceEngine === 'elevenlabs' && !elevenLabsConfigured && (
          <p className="text-[10px] text-amber-700 dark:text-amber-300/90 text-center">
            Set ELEVENLABS_API_KEY in Settings &gt; Secrets to play ElevenLabs voice, or select Browser.
          </p>
        )}
      </div>
    </div>
  );
}
