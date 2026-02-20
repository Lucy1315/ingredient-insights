// ─── Ingredient Normalization Utilities ──────────────────────────────────────

const SALT_SUFFIXES = [
  "HYDROCHLORIDE", "HCL", "HCI", "SODIUM", "POTASSIUM", "CALCIUM",
  "MAGNESIUM", "SULFATE", "SULPHATE", "PHOSPHATE", "ACETATE",
  "CITRATE", "TARTRATE", "MALEATE", "FUMARATE", "SUCCINATE",
  "CHLORIDE", "BROMIDE", "IODIDE", "NITRATE", "MESYLATE",
  "TOSYLATE", "BESYLATE", "MALATE", "GLUCONATE", "LACTATE",
  "OXALATE", "STEARATE", "PALMITATE", "OLEATE", "BENZOATE",
  "VALERATE", "BUTYRATE", "PROPIONATE", "FORMATE", "ASCORBATE",
  "MONOHYDRATE", "DIHYDRATE", "TRIHYDRATE", "ANHYDROUS",
  "HEMIHYDRATE", "SESQUIHYDRATE",
];

const HYDRATE_PATTERN = /\s*(MONO|DI|TRI|TETRA|HEMI|SESQUI)?HYDRATE/gi;
const STRENGTH_PATTERN = /\s*\d+(\.\d+)?\s*(MG|MCG|G|ML|%|IU|MEQ|MMOL|UNITS?)\b/gi;
const BRACKET_PATTERN = /\([^)]*\)/g;
const DOSAGE_FORM_WORDS = [
  "TABLET", "CAPSULE", "INJECTION", "SOLUTION", "SUSPENSION",
  "CREAM", "OINTMENT", "GEL", "PATCH", "SPRAY", "INHALER",
  "EXTENDED", "RELEASE", "DELAYED", "MODIFIED", "IMMEDIATE",
];

/**
 * Normalize a product name for API querying.
 * Trims, uppercases, removes suffix markers like >>, strips punctuation.
 */
export function normalizeProductName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/>>.*$/, "")         // remove suffix markers
    .replace(/[^\w\s-]/g, " ")   // remove non-word chars except hyphen
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the primary brand token (first significant word).
 */
export function extractPrimaryToken(normalized: string): string {
  const words = normalized.split(/\s+/).filter(Boolean);
  // Skip very short tokens and common filler words
  const skip = new Set(["THE", "AND", "OF", "FOR", "WITH", "IN", "A", "AN"]);
  for (const word of words) {
    if (word.length >= 3 && !skip.has(word)) return word;
  }
  return words[0] || normalized;
}

/**
 * Remove salts, hydrates, strengths, and dosage form words from an ingredient string.
 * Returns a clean base name in uppercase.
 */
export function cleanIngredient(raw: string): string {
  let s = raw.toUpperCase().trim();

  // Remove bracket content
  s = s.replace(BRACKET_PATTERN, " ");

  // Remove strength values
  s = s.replace(STRENGTH_PATTERN, " ");

  // Remove hydrate indicators
  s = s.replace(HYDRATE_PATTERN, " ");

  // Remove dosage form words
  for (const word of DOSAGE_FORM_WORDS) {
    s = s.replace(new RegExp(`\\b${word}\\b`, "gi"), " ");
  }

  // Remove salt suffixes (word boundary aware)
  for (const salt of SALT_SUFFIXES) {
    s = s.replace(new RegExp(`\\b${salt}\\b`, "gi"), " ");
  }

  // Cleanup whitespace and trailing punctuation
  s = s.replace(/[,;]+/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/^[-\s]+|[-\s]+$/g, "");

  return s;
}

/**
 * Parse a raw active ingredients string into an array of individual ingredient names.
 */
export function parseIngredients(raw: string): string[] {
  if (!raw) return [];
  // Split on common delimiters: semicolons, commas (with context), "and", "AND"
  const parts = raw
    .split(/[;]+|\band\b/gi)
    .flatMap((p) => p.split(/,(?=\s*[A-Z])/i)) // comma before capital
    .map((p) => p.trim())
    .filter(Boolean);
  return parts;
}

/**
 * Generate a standardized Ingredient_base from raw active ingredients text.
 * - Cleans each ingredient
 * - Sorts alphabetically for multi-ingredient products
 */
export function generateIngredientBase(rawIngredients: string): string {
  if (!rawIngredients) return "";
  const parts = parseIngredients(rawIngredients);
  const cleaned = parts
    .map(cleanIngredient)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const unique = [...new Set(cleaned)];
  unique.sort();
  return unique.join("; ");
}
