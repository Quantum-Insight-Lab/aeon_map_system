/**
 * Берёт последнюю сессию с полным набором protocol.coordinate_assigned (12 шагов)
 * и печатает computeConfidence по текущей реализации.
 *
 * Запуск: node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/recompute-confidence-from-db.ts
 */
import pg from 'pg';
import {
  assembleCoordinates,
  computeConfidence,
  matchTypes,
  type ProtocolAnswersMapped,
} from '../src/aeon/cognitive-engine.js';
import { PROTOCOL_QUESTION_IDS } from '../src/protocols/cognitive_v1/queue.js';
import type { GoalLabel, AnchorLetter, ModalityLetter } from '../src/protocols/cognitive_v1/types.js';

const dsn = process.env.DATABASE_URL;
if (!dsn) {
  console.error('Нет DATABASE_URL');
  process.exit(1);
}

type CoordRow = { qid: string; axis: string; coordinate: string; occurred_at: Date };

async function findLatestCompleteSession(pool: pg.Pool): Promise<{ sessionId: string; rows: CoordRow[] } | null> {
  const sessions = await pool.query<{ sid: string }>(
    `SELECT payload->>'session_id' AS sid
     FROM events
     WHERE event_type = 'protocol.coordinate_assigned'
     GROUP BY payload->>'session_id'
     HAVING COUNT(DISTINCT payload->>'question_id') >= 12
     ORDER BY MAX(occurred_at) DESC
     LIMIT 1`,
  );
  const sid = sessions.rows[0]?.sid;
  if (!sid) return null;

  const r = await pool.query<CoordRow>(
    `SELECT
       payload->>'question_id' AS qid,
       payload->>'axis' AS axis,
       payload->>'coordinate' AS coordinate,
       occurred_at
     FROM events
     WHERE event_type = 'protocol.coordinate_assigned'
       AND payload->>'session_id' = $1
     ORDER BY occurred_at ASC, event_id ASC`,
    [sid],
  );

  const byQ = new Map<string, CoordRow>();
  for (const row of r.rows) {
    if (!row.qid || !row.axis || !row.coordinate) continue;
    byQ.set(row.qid, row);
  }

  const rows: CoordRow[] = [];
  for (const qid of PROTOCOL_QUESTION_IDS) {
    const x = byQ.get(qid);
    if (!x) {
      console.warn(`В сессии ${sid} нет координаты для ${qid}`);
      return null;
    }
    rows.push(x);
  }
  return { sessionId: sid, rows };
}

function toMapped(rows: CoordRow[]): ProtocolAnswersMapped {
  const goals: GoalLabel[] = [];
  const modalities: ModalityLetter[] = [];
  const anchors: AnchorLetter[] = [];
  for (const row of rows) {
    if (row.axis === 'goal') goals.push(row.coordinate as GoalLabel);
    else if (row.axis === 'modality') modalities.push(row.coordinate as ModalityLetter);
    else if (row.axis === 'anchor') anchors.push(row.coordinate as AnchorLetter);
  }
  return { goals, modalities, anchors };
}

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: dsn });
  try {
    const pack = await findLatestCompleteSession(pool);
    if (!pack) {
      console.log('Нет сессии с 12 различными protocol.coordinate_assigned.');
      process.exit(2);
      return;
    }

    const mapped = toMapped(pack.rows);
    const assembled = assembleCoordinates(mapped);
    const matched = matchTypes(assembled);
    const conf = computeConfidence(assembled, matched);

    console.log(JSON.stringify({ session_id: pack.sessionId }, null, 0));
    console.log(
      JSON.stringify(
        {
          coordinates_summary: {
            goals: mapped.goals,
            modalities: mapped.modalities,
            anchors: mapped.anchors,
            core_formation: assembled.coreFormation,
            primary_goal: assembled.primaryGoal,
            dominant_anchor: assembled.dominantAnchorLetter,
          },
          matched_types: matched.matchedTypes.map((t) => t.name),
          synthetic_drawing: matched.syntheticDrawing,
          confidence: conf.confidence,
          resolution: conf.resolution,
          message: conf.message,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
