import { NextApiRequest, NextApiResponse } from 'next';
import { processAIRequest } from '@/services/ai/aiProcessor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, conversation_history, assistant, settings } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await processAIRequest({
      message,
      conversation_history,
      assistant,
      settings
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing AI request:', error);
    return res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
} 