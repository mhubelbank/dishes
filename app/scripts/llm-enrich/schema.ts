// JSON Schema for the model's structured output (output_config.format), plus the
// matching TS type. Structured outputs guarantee the shape; the verifier
// (verify.ts) enforces the things a schema can't express — substring grounding,
// numeric ranges, the allergen floor.
import { CUISINES, FORMS, MAIN_INGREDIENTS, ROLES } from "./vocab";

export interface LlmIngredient {
  name: string; // the food, lowercase-ish, no quantity ("grapeseed oil")
  quantity: string; // display string ("1 1/2 lb", "3 tbsp", "") — abbreviated units
  note: string; // prep ("finely chopped", "")
}

export interface LlmRecipe {
  ingredients: LlmIngredient[];
  activeMinutes: number; // hands-on time estimate
  totalMinutes: number; // start-to-finish
  servings: number;
  form: string; // one of FORMS or ""
  role: string; // one of ROLES or ""
  cuisine: string; // one of CUISINES or ""
  mainIngredient: string; // one of MAIN_INGREDIENTS or ""
  containsPeanuts: boolean;
  containsTreeNuts: boolean;
  nutrition: { proteinGrams: number; fiberGrams: number }; // per portion, est.
  confidence: "high" | "medium" | "low";
  changes: string[]; // human-readable list of every correction/addition vs. the input
}

export const RECIPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "ingredients", "activeMinutes", "totalMinutes", "servings", "form", "role",
    "cuisine", "mainIngredient", "containsPeanuts", "containsTreeNuts",
    "nutrition", "confidence", "changes",
  ],
  properties: {
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "note"],
        properties: {
          name: { type: "string" },
          quantity: { type: "string" },
          note: { type: "string" },
        },
      },
    },
    activeMinutes: { type: "integer" },
    totalMinutes: { type: "integer" },
    servings: { type: "integer" },
    form: { type: "string", enum: ["", ...FORMS] },
    role: { type: "string", enum: ["", ...ROLES] },
    cuisine: { type: "string", enum: ["", ...CUISINES] },
    mainIngredient: { type: "string", enum: ["", ...MAIN_INGREDIENTS] },
    containsPeanuts: { type: "boolean" },
    containsTreeNuts: { type: "boolean" },
    nutrition: {
      type: "object",
      additionalProperties: false,
      required: ["proteinGrams", "fiberGrams"],
      properties: {
        proteinGrams: { type: "integer" },
        fiberGrams: { type: "integer" },
      },
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    changes: { type: "array", items: { type: "string" } },
  },
} as const;
