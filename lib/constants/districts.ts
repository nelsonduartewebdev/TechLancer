/**
 * Portuguese districts (18 mainland + 2 autonomous regions).
 * Keys are district slugs; each has label and uuid (location_id for API).
 */
export const PT_DISTRICTS = {
  aveiro: { label: 'Aveiro', uuid: '550e8400-e29b-41d4-a716-446655440002' },
  beja: { label: 'Beja', uuid: '550e8400-e29b-41d4-a716-446655440003' },
  braga: { label: 'Braga', uuid: '550e8400-e29b-41d4-a716-446655440004' },
  braganca: { label: 'Bragança', uuid: '550e8400-e29b-41d4-a716-446655440005' },
  castelo_branco: { label: 'Castelo Branco', uuid: '550e8400-e29b-41d4-a716-446655440006' },
  coimbra: { label: 'Coimbra', uuid: '550e8400-e29b-41d4-a716-446655440007' },
  evora: { label: 'Évora', uuid: '550e8400-e29b-41d4-a716-446655440008' },
  faro: { label: 'Faro', uuid: '550e8400-e29b-41d4-a716-446655440009' },
  guarda: { label: 'Guarda', uuid: '550e8400-e29b-41d4-a716-44665544000a' },
  leiria: { label: 'Leiria', uuid: '550e8400-e29b-41d4-a716-44665544000b' },
  lisboa: { label: 'Lisboa', uuid: '550e8400-e29b-41d4-a716-446655440001' },
  portalegre: { label: 'Portalegre', uuid: '550e8400-e29b-41d4-a716-44665544000c' },
  porto: { label: 'Porto', uuid: '550e8400-e29b-41d4-a716-44665544000d' },
  santarem: { label: 'Santarém', uuid: '550e8400-e29b-41d4-a716-44665544000e' },
  setubal: { label: 'Setúbal', uuid: '550e8400-e29b-41d4-a716-44665544000f' },
  viana_do_castelo: { label: 'Viana do Castelo', uuid: '550e8400-e29b-41d4-a716-446655440010' },
  vila_real: { label: 'Vila Real', uuid: '550e8400-e29b-41d4-a716-446655440011' },
  viseu: { label: 'Viseu', uuid: '550e8400-e29b-41d4-a716-446655440012' },
  acores: { label: 'Açores', uuid: '550e8400-e29b-41d4-a716-446655440013' },
  madeira: { label: 'Madeira', uuid: '550e8400-e29b-41d4-a716-446655440014' },
} as const;

export type DistrictId = keyof typeof PT_DISTRICTS;

export const DISTRICT_IDS = Object.keys(PT_DISTRICTS) as DistrictId[];

/** Get location_id (UUID) for a district. */
export function getDistrictLocationId(districtId: DistrictId): string {
  return PT_DISTRICTS[districtId].uuid;
}
