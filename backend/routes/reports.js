import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(authenticateToken);

// Este arquivo foi substituído por reports-simple.js
// A rota /performance está disponível em reports-simple.js

export default router;
