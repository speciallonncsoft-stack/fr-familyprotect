const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const sql = neon(process.env.DATABASE_URL);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS survey_responses (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        site TEXT,
        language TEXT,
        answers JSONB,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        utm_content TEXT,
        utm_term TEXT,
        fbclid TEXT,
        referrer TEXT,
        page_path TEXT,
        variant TEXT
      );
    `;

    // 예전 버전에서 만들어진 테이블에 새 컬럼들을 안전하게 보충
    await sql`ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS response_id TEXT;`;
    await sql`ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;`;
    await sql`ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS survey_responses_response_id_idx ON survey_responses (response_id);`;

    const data = req.body;
    const responseId = data.response_id || crypto.randomUUID();

    await sql`
      INSERT INTO survey_responses
        (response_id, completed, site, language, answers, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, referrer, page_path, variant)
      VALUES
        (${responseId},
         ${data.completed === undefined ? true : !!data.completed},
         ${data.site || 'unknown'},
         ${data.language || null},
         ${JSON.stringify(data.answers || {})},
         ${data.utm_source || null},
         ${data.utm_medium || null},
         ${data.utm_campaign || null},
         ${data.utm_content || null},
         ${data.utm_term || null},
         ${data.fbclid || null},
         ${data.referrer || null},
         ${data.page_path || null},
         ${data.variant || null})
      ON CONFLICT (response_id) DO UPDATE SET
        completed = EXCLUDED.completed,
        answers = EXCLUDED.answers,
        updated_at = NOW();
    `;

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('submit error', err);
    return res.status(500).json({ error: 'save_failed' });
  }
};
