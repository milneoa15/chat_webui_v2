const express = require('express');
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
const defaults = {
  model: 'llama3',
  temperature: 0.7,
  top_p: 0.9,
  top_k: null,
  repeat_penalty: null,
  context_window: null,
  max_tokens: null,
  stop: [],
};
const config = {
  id: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  theme: 'terminal',
  ollama_base_url: 'http://localhost:11434',
  generation_defaults: defaults,
};
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});
app.get('/api/config', (req, res) => {
  res.json(config);
});
app.get('/api/sessions', (req, res) => {
  res.json({ items: [] });
});
app.get('/api/sessions/:id/messages', (req, res) => {
  res.json({ items: [], total: 0, limit: 200, offset: 0 });
});
app.get('/api/sessions/:id/metrics', (req, res) => {
  res.json({
    session_id: Number(req.params.id),
    total_prompt_tokens: 0,
    total_completion_tokens: 0,
    total_messages: 0,
    messages: [],
  });
});
app.put('/api/config', (req, res) => {
  Object.assign(config, req.body);
  res.json(config);
});
const server = app.listen(8000, () => {
  console.log('Mock API running on 8000');
});
