const fetch = require('node-fetch'); // npm install node-fetch@2
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Gera áudio a partir de texto usando Google Text-to-Speech.
 * @param {string} texto - O texto que será convertido em fala.
 * @param {string} nomeArquivo - (Opcional) Nome do arquivo de saída (default: 'voz.wav').
 * @returns {Promise<string>} Caminho do arquivo salvo.
 */
async function sintetizarTexto(texto, nomeArquivo = 'voz.wav') {
  try {
    const projectId = execSync("gcloud config list --format='value(core.project)'").toString().trim();
    const accessToken = execSync("gcloud auth print-access-token").toString().trim();

    const requestBody = {
      input: {
        markup: texto
      },
      voice: {
        languageCode: "pt-BR",
        name: "pt-BR-Chirp3-HD-Achernar",
        voiceClone: {}
      },
      audioConfig: {
        audioEncoding: "LINEAR16"
      }
    };

    const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-User-Project': projectId,
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (data.audioContent) {
      const buffer = Buffer.from(data.audioContent, 'base64');
      fs.writeFileSync(nomeArquivo, buffer);
      console.log(`✅ Áudio salvo como ${nomeArquivo}`);
      return nomeArquivo;
    } else {
      console.error('❌ Erro na resposta da API:', data);
      throw new Error('Falha ao gerar áudio');
    }
  } catch (error) {
    console.error('❌ Erro ao gerar áudio:', error.message);
    throw error;
  }
}

module.exports = { sintetizarTexto };
