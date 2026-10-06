// The products table has no category column (schema is fixed), so the category is derived from the SKU prefix.
// Order matters: the first matching prefix wins.

export const CATEGORIES = [
  { label: 'Semen & Perekat', prefixes: ['SMN'] },
  { label: 'Batu & Bata', prefixes: ['BTA', 'BATA'] },
  { label: 'Pasir & Agregat', prefixes: ['PSR'] },
  { label: 'Besi & Baja', prefixes: ['BJK', 'BESI'] },
  { label: 'Cat', prefixes: ['CAT', 'KUAS'] },
  { label: 'Keramik', prefixes: ['KRM', 'KRMK'] },
  { label: 'Perkakas', prefixes: ['PKU', 'PAKU', 'ENGSL'] },
  { label: 'Kayu', prefixes: ['PLY', 'TRPK', 'GYP'] },
  { label: 'Pipa', prefixes: ['PVC', 'PIPA', 'LEM', 'KRAN'] },
];

export const OTHER_CATEGORY = 'Lainnya';

export function categoryOf(sku) {
  const prefix = String(sku || '').toUpperCase().split('-')[0];
  return CATEGORIES.find((c) => c.prefixes.includes(prefix))?.label ?? OTHER_CATEGORY;
}

export const CATEGORY_OPTIONS = [...CATEGORIES.map((c) => c.label), OTHER_CATEGORY];
