import express from 'express';
import { sendMessage, getConnectionStatus } from '../services/whatsapp.js';
import multer from 'multer';
import audioProcessor from '../services/audioProcessor.js';

const router = express.Router();

// Configurar multer para upload de áudio
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 16 * 1024 * 1024 // 16MB max
    }
});

// Obter status da conexão
router.get('/status', async (req, res) => {
    try {
        const status = await getConnectionStatus();
        res.json({ status });
    } catch (error) {
        console.error('Erro ao obter status:', error);
        res.status(500).json({ error: 'Erro ao obter status da conexão' });
    }
});

// Enviar mensagem
router.post('/send', async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios' });
        }

        await sendMessage(phone, message);
        res.json({ success: true, message: 'Mensagem enviada com sucesso' });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// Listar chats
router.get('/chats', async (req, res) => {
    try {
        // Implementar lógica para listar chats
        res.json({ chats: [] });
    } catch (error) {
        console.error('Erro ao listar chats:', error);
        res.status(500).json({ error: 'Erro ao listar chats' });
    }
});

// Rota para processar áudio do WhatsApp
router.post('/process-audio', upload.single('audio'), async (req, res) => {
    try {
        const { chatId, companyId } = req.body;
        const audioFile = req.file;

        if (!audioFile) {
            return res.status(400).json({ error: 'Nenhum arquivo de áudio fornecido' });
        }

        if (!chatId || !companyId) {
            return res.status(400).json({ error: 'chatId e companyId são obrigatórios' });
        }

        const result = await audioProcessor.processAudio(
            audioFile.buffer,
            chatId,
            companyId
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Erro ao processar áudio:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Erro ao processar áudio'
        });
    }
});

export default router;
