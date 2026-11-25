// Izračun hranilnih vrednosti, validacija živil in seštevki.
import { validateNumber } from './stevila.js';

export const BASIS_100G = '100g';
export const BASIS_PIECE = 'kos';
export const UNIT_G = 'g';
export const UNIT_PIECE = 'kos';

const MACROS = ['kcal', 'protein', 'fat', 'carbs'];

function hasPieceWeight(food) {
  return Number.isFinite(food.pieceWeight) && food.pieceWeight > 0;
}

/** Enote, v katerih lahko vnesem količino tega živila. Prva je privzeta. */
export function availableUnits(food) {
  if (food.basis === BASIS_PIECE) {
    return hasPieceWeight(food) ? [UNIT_PIECE, UNIT_G] : [UNIT_PIECE];
  }
  return hasPieceWeight(food) ? [UNIT_G, UNIT_PIECE] : [UNIT_G];
}

/**
 * Izračun vrednosti za količino. `food` je živilo ali posnetek živila.
 * Vrne { kcal, protein, fat, carbs } ali null, če enota ni na voljo / količina ni veljavna.
 */
export function calcNutrition(food, quantity, unit) {
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  if (!availableUnits(food).includes(unit)) return null;

  let factor;
  if (food.basis === BASIS_PIECE) {
    const pieces = unit === UNIT_PIECE ? quantity : quantity / food.pieceWeight;
    factor = pieces;
  } else {
    const grams = unit === UNIT_G ? quantity : quantity * food.pieceWeight;
    factor = grams / 100;
  }
  const out = {};
  for (const k of MACROS) out[k] = (Number(food[k]) || 0) * factor;
  return out;
}

/** Posnetek živila, ki se shrani v vnos (da kasnejše spremembe knjižnice ne vplivajo nanj). */
export function snapshotFood(food) {
  return {
    name: food.name,
    basis: food.basis,
    kcal: food.kcal,
    protein: food.protein,
    fat: food.fat,
    carbs: food.carbs,
    pieceWeight: hasPieceWeight(food) ? food.pieceWeight : null,
  };
}

/**
 * Sestavi vnos v dnevnik z zamrznjenimi izračunanimi vrednostmi.
 * `source` je živilo iz knjižnice ali posnetek obstoječega vnosa.
 */
export function buildEntry({ id, date, foodId, source, quantity, unit, createdAt, now = Date.now() }) {
  const food = snapshotFood(source);
  const n = calcNutrition(food, quantity, unit);
  if (!n) throw new Error('Neveljavna količina ali enota.');
  return {
    id,
    date,
    foodId: foodId ?? null,
    food,
    quantity,
    unit,
    kcal: n.kcal,
    protein: n.protein,
    fat: n.fat,
    carbs: n.carbs,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

/** Seštevek vnosov. */
export function sumEntries(entries) {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const e of entries) for (const k of MACROS) t[k] += Number(e[k]) || 0;
  return t;
}

/** Napredek proti cilju. ratio je neomejen (lahko > 1). */
export function progress(consumed, goal) {
  const g = Number(goal) || 0;
  const ratio = g > 0 ? consumed / g : 0;
  return {
    ratio,
    remaining: g - consumed,
    over: g > 0 && consumed > g,
  };
}

/**
 * Validacija obrazca za živilo. Vhod so nizi iz obrazca.
 * Vrne { ok, errors: {polje: sporočilo}, value }.
 */
export function validateFood(input) {
  const errors = {};
  const value = {};

  const name = String(input.name ?? '').trim();
  if (!name) errors.name = 'Vpiši ime živila.';
  else if (name.length > 80) errors.name = 'Ime je predolgo.';
  value.name = name;

  if (input.basis !== BASIS_100G && input.basis !== BASIS_PIECE) errors.basis = 'Izberi osnovo vrednosti.';
  value.basis = input.basis;

  for (const k of MACROS) {
    const max = k === 'kcal' ? 10000 : 1000;
    const r = validateNumber(input[k], { min: 0, max });
    if (r.error) errors[k] = r.error;
    value[k] = r.value;
  }

  const pw = validateNumber(input.pieceWeight, { required: false, min: 0, minExclusive: true, max: 100000 });
  if (pw.error) errors.pieceWeight = pw.error;
  value.pieceWeight = pw.value;

  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** Validacija količine vnosa (> 0). */
export function validateQuantity(input) {
  return validateNumber(input, { min: 0, minExclusive: true, max: 100000 });
}

/** kcal iz makrohranil (4/9/4). */
export function kcalFromMacros({ protein = 0, fat = 0, carbs = 0 }) {
  return protein * 4 + fat * 9 + carbs * 4;
}
