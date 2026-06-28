// Controlled vocabularies the model must pick from (enums in the schema) and the
// verifier checks against. Keeping these closed is a guardrail: the model can't
// invent a course or cuisine, only choose one — or return "" for none.
import { FORMS, ROLES, type RecipeForm, type RecipeRole } from "../../src/domain/recipes";

export { FORMS, ROLES };
export type { RecipeForm, RecipeRole };

export const CUISINES = [
  "Italian", "Mexican", "Thai", "Korean", "Vietnamese", "Japanese", "Chinese",
  "Indian", "Middle Eastern", "Greek", "Spanish", "French", "American",
  "Mediterranean", "Caribbean", "African", "Ethiopian", "North African",
  "Persian", "Portuguese", "British", "German", "Filipino",
  "Indonesian", "Malaysian", "Peruvian", "Brazilian", "Turkish",
] as const;

export const MAIN_INGREDIENTS = [
  "chicken", "beef", "pork", "lamb", "seafood", "fish", "tofu", "eggs",
  "beans", "pasta", "grain", "vegetable", "cheese", "mushroom",
] as const;
