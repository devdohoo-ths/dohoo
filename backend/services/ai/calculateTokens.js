const Gpt3EncoderModulePromise = import("gpt-3-encoder");

export const calculateTokens = async (messages) => {
  const { encode } = await Gpt3EncoderModulePromise;
  let totalTokens = 0;

  messages.forEach(msg => {
    if (typeof msg.content !== 'string') {
      console.warn('Mensagem com content inválido detectado:', msg);
    }
    const content = typeof msg.content === 'string' ? msg.content : '';

    const contentTokens = encode(content);
    totalTokens += contentTokens.length;

    totalTokens += 4; // tokens extras por mensagem
  });

  totalTokens += 2; // tokens extras para encerramento

  return totalTokens;
}


