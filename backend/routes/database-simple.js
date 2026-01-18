import express from 'express';

const router = express.Router();

// Rota de teste simples
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Database manager está funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Rota para listar conexões
router.get('/connections', (req, res) => {
  res.json({
    connections: [],
    activeConnection: null
  });
});

// Rota para testar conexão
router.post('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Teste de conexão simulado com sucesso'
  });
});

// Rota para criar conexão
router.post('/connections', (req, res) => {
  res.json({
    success: true,
    message: 'Conexão criada com sucesso',
    connection: {
      id: Date.now().toString(),
      ...req.body,
      password: '********',
      serviceRoleKey: req.body.serviceRoleKey ? '********' : undefined
    }
  });
});

export default router; 