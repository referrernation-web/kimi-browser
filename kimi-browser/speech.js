// Ang binabasa ng boses ay hindi dapat ang hilaw na markdown. Binabasa ng TTS ang
// bawat marka nang literal ("asterisk asterisk"), at ang em dash ay nagiging awkward
// na tigil sa gitna ng pangungusap. Dito nililinis ang teksto bago ipabasa: ang mga
// marka ay tinatanggal, at ang mga gitling at talata ay ginagawang tunay na bantas
// para may hininga at tamang tono ang pagbasa.
export function forSpeech(text) {
  const inline = (s) =>
    s
      .replace(/`([^`]*)`/g, '$1')
      // Ang link ay pangalan lang ang binabasa, hindi ang buong URL.
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      // Em at en dash: ginagawang kuwit, ito ang tunay na paghinto sa pagsasalita.
      .replace(/\s*[—–]\s*/g, ', ')
      .replace(/_/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const lines = String(text || '')
    // Ang code block ay hindi binabasa, walang saysay pakinggan ang syntax.
    .replace(/```[\s\S]*?```/g, '\nNasa panel ang code.\n')
    .split('\n')
    .map((line) => {
      // Ang inline muna BAGO ang markang pambungad: kung baligtad, ang "**1. TAPOS**"
      // ay mauubos ang isang asterisk sa bullet rule at masisira ang bold pairing.
      const bare = inline(line).replace(/^\s{0,3}(#{1,6}|[-*•]|\d+[.)]|>)\s*/, '');
      if (!bare) return '';
      // ANG SUSI SA MALINIS NA PAGBASA: bawat linya ay tinatapos ng bantas. Kung
      // wala, walang hinto ang boses at nagiging isang mahabang hininga ang lahat.
      return /[.!?:,;]$/.test(bare) ? bare : bare + '.';
    })
    .filter(Boolean);

  return lines
    .join(' ')
    // Linisin ang naipong bantas mula sa mga pagpapalit sa itaas.
    .replace(/([.!?])\s*[.,;:]+/g, '$1')
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
