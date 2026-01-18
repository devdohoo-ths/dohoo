import express from 'express';
import multer from 'multer';
import path from 'path';
import transcriptService from '../services/transcript/transcriptService.js';
import elevenLabsService from '../services/transcript/elevenLabsService.js';
import fs from 'fs';

const router = express.Router();

// Configure multer for audio file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'audio');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Função para converter dígitos para extenso (português)
const DIGITOS_EXTENSO = [
  'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'
];
function numerosPorExtenso(texto) {
  return texto.replace(/\d+/g, (numero) =>
    numero.split('').map(d => DIGITOS_EXTENSO[parseInt(d)]).join(' ')
  );
}

// Upload audio and create transcript
router.post('/upload', upload.single('audio'), async (req, res) => {
    try {
        const { chatId } = req.body;
        const audioFile = req.file;

        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const transcriptId = await transcriptService.createTranscript(chatId, audioFile.path);
        res.json({ transcriptId, message: 'Audio uploaded successfully' });
    } catch (error) {
        console.error('Error uploading audio:', error);
        res.status(500).json({ error: 'Failed to upload audio' });
    }
});

// Get transcript by ID
router.get('/:transcriptId', async (req, res) => {
    try {
        const transcript = await transcriptService.getTranscriptById(req.params.transcriptId);
        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found' });
        }
        res.json(transcript);
    } catch (error) {
        console.error('Error fetching transcript:', error);
        res.status(500).json({ error: 'Failed to fetch transcript' });
    }
});

// Get all transcripts for a chat
router.get('/chat/:chatId', async (req, res) => {
    try {
        const transcripts = await transcriptService.getTranscriptsByChatId(req.params.chatId);
        res.json(transcripts);
    } catch (error) {
        console.error('Error fetching chat transcripts:', error);
        res.status(500).json({ error: 'Failed to fetch chat transcripts' });
    }
});

// Convert transcript to speech using Eleven Labs
router.post('/:transcriptId/convert', async (req, res) => {
    try {
        const { transcriptId } = req.params;
        const { voiceId } = req.body;

        const transcript = await transcriptService.getTranscriptById(transcriptId);
        if (!transcript) {
            return res.status(404).json({ error: 'Transcript not found' });
        }

        // Converte números por extenso apenas para ElevenLabs
        const textoPorExtenso = numerosPorExtenso(transcript.transcript_text);

        const outputPath = path.join(process.cwd(), 'uploads', 'converted', `${transcriptId}.mp3`);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        const convertedAudioPath = await elevenLabsService.convertTextToSpeech(
            textoPorExtenso, // <-- Envia o texto por extenso!
            voiceId,
            outputPath
        );

        const conversionId = await transcriptService.createAudioConversion(
            transcriptId,
            transcript.audio_file_path,
            voiceId
        );

        await transcriptService.updateAudioConversion(conversionId, convertedAudioPath);

        res.json({
            conversionId,
            convertedAudioPath,
            message: 'Audio converted successfully'
        });
    } catch (error) {
        console.error('Error converting audio:', error);
        res.status(500).json({ error: 'Failed to convert audio' });
    }
});

// Get available voices from Eleven Labs
router.get('/voices', async (req, res) => {
    try {
        const voices = await elevenLabsService.getAvailableVoices();
        res.json(voices);
    } catch (error) {
        console.error('Error fetching voices:', error);
        res.status(500).json({ error: 'Failed to fetch available voices' });
    }
});

export default router; 