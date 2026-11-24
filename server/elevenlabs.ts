export interface ElevenLabsVoiceInfo {
  id: string;
  name: string;
  category: string;
}

export const DEFAULT_ELEVENLABS_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const VALID_VOICE_ID = /^[a-zA-Z0-9_-]{8,64}$/;
const ALLOWED_MODELS = new Set(['eleven_multilingual_v2', 'eleven_flash_v2_5']);

export const CURATED_VOICES: ElevenLabsVoiceInfo[] = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (Warm Assistant)', category: 'premade' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Calm & Clear)', category: 'premade' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte (Natural)', category: 'premade' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily (Bright & Expressive)', category: 'premade' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica (Conversational)', category: 'premade' },
];

function getValidApiKey(): { key: string | null; invalidReason?: string } {
  const raw = process.env.ELEVENLABS_API_KEY?.trim() ?? '';
  if (!raw || raw === 'MY_ELEVENLABS_API_KEY') {
    return { key: null };
  }
  if (!raw.startsWith('sk_')) {
    return {
      key: null,
      invalidReason:
        "ELEVENLABS_API_KEY in Settings > Secrets must start with 'sk_'. Using Browser voice until updated.",
    };
  }
  return { key: raw };
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(getValidApiKey().key);
}

export async function listElevenLabsVoices(): Promise<{
  configured: boolean;
  defaultVoiceId: string;
  voices: ElevenLabsVoiceInfo[];
  warning?: string;
}> {
  const { key, invalidReason } = getValidApiKey();
  if (!key) {
    return {
      configured: false,
      defaultVoiceId: DEFAULT_ELEVENLABS_VOICE_ID,
      voices: CURATED_VOICES,
      ...(invalidReason ? { warning: invalidReason } : {}),
    };
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': key,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return {
        configured: res.status !== 401 && res.status !== 403,
        defaultVoiceId: DEFAULT_ELEVENLABS_VOICE_ID,
        voices: CURATED_VOICES,
        warning:
          res.status === 401 || res.status === 403
            ? 'ElevenLabs rejected ELEVENLABS_API_KEY. Please check Settings > Secrets.'
            : undefined,
      };
    }

    const data = (await res.json()) as {
      voices?: Array<{ voice_id?: string; name?: string; category?: string }>;
    };
    const mapped = (data.voices ?? [])
      .filter((v): v is { voice_id: string; name: string; category?: string } =>
        Boolean(v?.voice_id && v?.name)
      )
      .slice(0, 40)
      .map((v) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category ?? 'premade',
      }));

    return {
      configured: true,
      defaultVoiceId: mapped[0]?.id ?? DEFAULT_ELEVENLABS_VOICE_ID,
      voices: mapped.length > 0 ? mapped : CURATED_VOICES,
    };
  } catch {
    return {
      configured: true,
      defaultVoiceId: DEFAULT_ELEVENLABS_VOICE_ID,
      voices: CURATED_VOICES,
    };
  }
}

export class ElevenLabsError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function synthesizeElevenLabsSpeech(params: {
  text: string;
  voiceId?: string;
  modelId?: string;
}): Promise<Buffer> {
  const { key, invalidReason } = getValidApiKey();
  if (!key) {
    throw new ElevenLabsError(
      invalidReason ? 400 : 503,
      invalidReason ?? 'ELEVENLABS_API_KEY is not configured in Settings > Secrets.'
    );
  }

  const voiceId = (params.voiceId ?? DEFAULT_ELEVENLABS_VOICE_ID).trim();
  if (!VALID_VOICE_ID.test(voiceId)) {
    throw new ElevenLabsError(400, 'Invalid ElevenLabs voice ID.');
  }

  const modelId =
    params.modelId && ALLOWED_MODELS.has(params.modelId)
      ? params.modelId
      : 'eleven_multilingual_v2';

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: params.text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.78,
        },
      }),
      signal: AbortSignal.timeout(20000),
    }
  );

  if (!res.ok) {
    let detail = `ElevenLabs API error (${res.status})`;
    try {
      const errJson = (await res.json()) as {
        detail?: { message?: string } | string;
      };
      if (typeof errJson.detail === 'string') {
        detail = errJson.detail;
      } else if (errJson.detail?.message) {
        detail = errJson.detail.message;
      }
    } catch {
      // ignore non-JSON error body
    }
    throw new ElevenLabsError(res.status >= 400 && res.status < 600 ? res.status : 502, detail);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
