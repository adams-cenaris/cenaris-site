const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { verifyAdmin } = require('../../_shared/auth');

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

function chunkText(text) {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > CHUNK_SIZE && current) {
      chunks.push(current.trim());
      current = current.slice(-CHUNK_OVERLAP) + '\n\n' + para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

module.exports = async function handler(req, res) {
  try {
    if (!verifyAdmin(req)) return res.status(401).json({ error: 'Unauthorised' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { title, sourceUrl, content } = req.body || {};
    if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: 'title and content are required' });

    const supabase = getClient();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const chunks = chunkText(content.trim());
    if (!chunks.length) return res.status(400).json({ error: 'No content to index' });

    if (sourceUrl) await supabase.from('knowledge_chunks').delete().eq('source_url', sourceUrl);

    // Batch all embeddings in a single API call — much faster than sequential
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunks,
    });

    const rows = chunks.map((chunk, i) => ({
      title: title.trim(),
      source_url: sourceUrl || null,
      chunk_text: chunk,
      embedding: embeddingRes.data[i].embedding,
    }));

    const { error } = await supabase.from('knowledge_chunks').insert(rows);
    if (error) {
      console.error('[seed] DB insert error', error.message);
      return res.status(500).json({ error: 'DB insert failed' });
    }

    res.status(200).json({ ok: true, chunksCreated: rows.length });
  } catch (err) {
    console.error('[seed] error', err?.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
