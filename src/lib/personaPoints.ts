export interface PersonaPointData {
  name: string;
  n: number;
  xrange: [number, number];
  yrange: [number, number];
  zrange: [number, number];
  pos: number[];
}

const PERSONA_POINTS_URL = `${import.meta.env.BASE_URL}models/persona-model/persona-points.json`;
let pointsPromise: Promise<PersonaPointData> | null = null;

function validatePoints(value: unknown): PersonaPointData {
  if (!value || typeof value !== 'object') throw new Error('Persona point data is not an object.');
  const data = value as Partial<PersonaPointData>;
  const validRange = (range: unknown): range is [number, number] =>
    Array.isArray(range) && range.length === 2 && range.every(Number.isFinite);

  if (
    typeof data.name !== 'string' ||
    !Number.isInteger(data.n) ||
    (data.n ?? 0) <= 0 ||
    !validRange(data.xrange) ||
    !validRange(data.yrange) ||
    !validRange(data.zrange) ||
    !Array.isArray(data.pos) ||
    data.pos.length !== (data.n ?? 0) * 3 ||
    !data.pos.every(Number.isFinite)
  ) {
    throw new Error('Persona point data has an invalid 3D point-cloud schema.');
  }

  return data as PersonaPointData;
}

/** One request for the lifetime of the page. App starts it on desktop at first
 * paint; the lazy stage reads the same promise when it eventually mounts. */
export function preloadPersonaPoints(): Promise<PersonaPointData> {
  pointsPromise ??= fetch(PERSONA_POINTS_URL).then(async (response) => {
    if (!response.ok) throw new Error(`Persona points request failed with HTTP ${response.status}.`);
    return validatePoints(await response.json());
  });
  return pointsPromise;
}
