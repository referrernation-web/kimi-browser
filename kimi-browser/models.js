// Ang /models endpoint ng provider ay nagbabalik ng LAHAT ng model — hindi lang ang
// nakakausap. Kasama doon ang image generation, TTS, speech recognition, embedding,
// at rerank. Kapag napili ang isa sa kanila bilang worker o bilang second brain,
// tahimik na babagsak ang gawain at mahirap hulaan kung bakit.
//
// Ang mga vision-language (qwen-vl-max) ay NANANATILI — nakakausap sila at sila ang
// nakakabasa ng screenshot, kaya kailangan natin sila.

const NOT_CHAT =
  /(^|[-_])(image|img|tts|asr|whisper|embedding|embed|rerank|ocr|video|paraformer|cosyvoice|sambert|wanx|wan)([-_.]|\d|$)/i;

export function isChatModel(id) {
  const s = String(id || '').trim();
  if (!s) return false;
  // Ang audio family ay may parehong chat at TTS na variant — ang may "instruct" o
  // "chat" lang ang nakakausap.
  if (/-audio-/i.test(s) && !/instruct|chat/i.test(s)) return false;
  return !NOT_CHAT.test(s);
}

// Para sa listahan mula sa API: sinasala, inaalis ang doble, at inaayos ang pagkakasunod.
export function chatModels(ids) {
  return [...new Set((ids || []).map((x) => String(x || '').trim()).filter(isChatModel))].sort();
}
