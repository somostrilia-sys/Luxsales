/**
 * Fish Audio TTS - Shared Module
 * Gera áudio com voz clonada do Alex via Fish Audio API
 */

const FISH_AUDIO_API = "https://api.fish.audio/v1/tts";

interface TTSOptions {
  text: string;
  apiKey: string;
  modelId: string;
  format?: "mp3" | "wav" | "opus";
}

/**
 * Gera áudio TTS via Fish Audio API
 * Retorna ArrayBuffer do áudio ou null em caso de erro
 */
export async function generateTTS(options: TTSOptions): Promise<ArrayBuffer | null> {
  const { text, apiKey, modelId, format = "opus" } = options;

  if (!text || !apiKey || !modelId) return null;

  // Limitar texto a 500 chars pra não gastar crédito demais
  const trimmedText = text.slice(0, 500);

  try {
    const response = await fetch(FISH_AUDIO_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: trimmedText,
        reference_id: modelId,
        format: format,
        mp3_bitrate: 64,
        latency: "normal",
      }),
    });

    if (!response.ok) {
      console.error(`Fish Audio TTS error: ${response.status} ${await response.text()}`);
      return null;
    }

    return await response.arrayBuffer();
  } catch (err) {
    console.error("Fish Audio TTS exception:", err);
    return null;
  }
}

/**
 * Envia áudio como mensagem de voz no Telegram
 */
export async function sendVoiceTelegram(
  botToken: string,
  chatId: string,
  audioBuffer: ArrayBuffer,
  caption?: string,
): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("voice", new Blob([audioBuffer], { type: "audio/ogg" }), "voice.ogg");
    if (caption) {
      formData.append("caption", caption);
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendVoice`,
      { method: "POST", body: formData }
    );

    if (!response.ok) {
      console.error(`Telegram sendVoice error: ${response.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendVoice exception:", err);
    return false;
  }
}

/**
 * Adiciona variações naturais ao texto para TTS
 * - Ênfase em palavras-chave (MAIÚSCULAS)
 * - Pausas naturais (reticências)
 * - Tosse esporádica (~8% das vezes)
 */
export function humanizeText(text: string): string {
  let result = text;

  // Adicionar pausas naturais em vírgulas longas
  result = result.replace(/,\s/g, (match) => {
    return Math.random() < 0.3 ? "... " : match;
  });

  // Tosse esporádica (~8% das mensagens)
  if (Math.random() < 0.08) {
    const sentences = result.split(". ");
    if (sentences.length > 1) {
      const insertAt = Math.floor(Math.random() * (sentences.length - 1)) + 1;
      sentences.splice(insertAt, 0, "*ahem*");
      result = sentences.join(". ");
    }
  }

  return result;
}
