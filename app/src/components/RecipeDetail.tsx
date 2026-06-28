import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { recipeImageUrl } from "../clients/recipeImages";
import { recipeSteps } from "../clients/recipeSteps";
import { abbreviateUnits, durationLabel, type Recipe } from "../domain/recipes";

const TABS = ["Overview", "Ingredients", "Instructions", "Details"] as const;
type Tab = (typeof TABS)[number];

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RecipeDetail({
  recipe,
  yourTime,
  onClose,
  onCooked,
  onEdit,
  onPlan,
}: {
  recipe: Recipe;
  yourTime?: number;
  onClose: () => void;
  onCooked?: () => void;
  onEdit?: () => void;
  onPlan?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const imageUrl = recipeImageUrl(recipe.title);
  const steps = recipeSteps(recipe.title);
  const nutrition = recipe.nutrition;
  const tags = [recipe.form, recipe.role, ...recipe.genres, recipe.mainIngredient].filter((t): t is string => Boolean(t));
  const hasQuietDetails =
    Boolean(recipe.lastNote) ||
    nutrition?.proteinGrams !== undefined ||
    nutrition?.fiberGrams !== undefined ||
    recipe.mealTypes.length > 0;

  // Decode the photo before revealing it so it fades in within its reserved box
  // instead of popping in and shoving the content down.
  const [imgReady, setImgReady] = useState(false);
  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    const img = new Image();
    img.src = imageUrl;
    const done = () => {
      if (!cancelled) setImgReady(true);
    };
    img.decode?.().then(done).catch(done) ?? done();
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  // Clamp the headnote to 5 rendered lines, with a [...] toggle that only shows when
  // the text actually overflows that. Measured against the clamped element (which has
  // layout even when the Overview tab isn't the visible one).
  const descRef = useRef<HTMLParagraphElement>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  useEffect(() => setDescExpanded(false), [recipe.id]);
  useLayoutEffect(() => {
    const el = descRef.current;
    if (!el || descExpanded) return;
    setDescOverflows(el.scrollHeight - el.clientHeight > 1);
  }, [recipe.description, descExpanded]);

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="recipe-sheet"
        data-tab={tab}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="recipe-tabs" role="tablist">
          {TABS.map((name) => (
            <button
              aria-selected={tab === name}
              className={`recipe-tab${tab === name ? " recipe-tab--active" : ""}`}
              key={name}
              onClick={() => setTab(name)}
              role="tab"
              type="button"
            >
              {name}
            </button>
          ))}
          <span className="recipe-tabs__spacer" />
          <button className="recipe-tab recipe-tab--close" onClick={onClose} title="Close" type="button">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="recipe-sheet__panel">
          <div className="recipe-tabpanel" data-active={tab === "Overview"} role="tabpanel">
            <div className="recipe-overview">
              <div className="recipe-overview__main">
                <h2>{recipe.title}</h2>
                <p className="muted xs">
                  {durationLabel(recipe.activeMinutes, recipe.totalMinutes)}
                  {" · "}
                  {titleCase(recipe.vessel)} · {titleCase(recipe.cleanup)} cleanup
                  {recipe.servings ? ` · Serves ${recipe.servings}` : ""}
                  {recipe.cookedCount > 0 ? ` · cooked ${recipe.cookedCount}x` : ""}
                </p>
                {yourTime !== undefined ? <p className="muted xs">Your time ~{yourTime} min hands-on</p> : null}
                {tags.length > 0 ? (
                  <div className="chips recipe-sheet__tags">
                    {tags.map((t) => (
                      <span className="chip" key={t}>
                        {titleCase(t)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {recipe.source ? (
                  <p className="muted xs recipe-sheet__source">
                    {recipe.source.book}
                    {recipe.source.chapter ? ` · ${recipe.source.chapter}` : ""}
                  </p>
                ) : null}
                {recipe.description ? (
                  <div className="recipe-sheet__headnote-wrap">
                    <p
                      className={`recipe-sheet__headnote sm${descExpanded ? "" : " recipe-sheet__headnote--clamp"}`}
                      ref={descRef}
                    >
                      {recipe.description}
                    </p>
                    {descOverflows ? (
                      <button className="recipe-sheet__more" onClick={() => setDescExpanded((v) => !v)} type="button">
                        {descExpanded ? "Show less" : "Show more"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {imageUrl ? (
                <img
                  alt={recipe.title}
                  className={`recipe-overview__image${imgReady ? " is-ready" : ""}`}
                  src={imageUrl}
                />
              ) : (
                <div aria-hidden="true" className="recipe-overview__image recipe-overview__image--empty">
                  <Icon name="book" size={28} />
                </div>
              )}
            </div>
          </div>

          <div className="recipe-tabpanel recipe-tabpanel--overlay" data-active={tab === "Ingredients"} role="tabpanel">
            <ul
              className={`recipe-sheet__ingredients${
                recipe.ingredients.length > 6 ? " recipe-sheet__ingredients--cols" : ""
              }`}
            >
              {recipe.ingredients.map((ingredient, index) => (
                <li key={`${ingredient.name}-${index}`}>
                  {ingredient.quantity ? (
                    <span className="recipe-sheet__qty">{abbreviateUnits(ingredient.quantity)} </span>
                  ) : null}
                  {ingredient.name}
                  {ingredient.note ? <span className="muted"> · {ingredient.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="recipe-tabpanel recipe-tabpanel--overlay" data-active={tab === "Instructions"} role="tabpanel">
            {steps && steps.length > 0 ? (
              <ol className="recipe-steps">
                {steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="muted sm">No instructions captured for this recipe.</p>
            )}
          </div>

          <div className="recipe-tabpanel recipe-tabpanel--overlay" data-active={tab === "Details"} role="tabpanel">
            {hasQuietDetails ? (
              <div className="recipe-sheet__detail-body">
                {recipe.mealTypes.length > 0 ? (
                  <p className="muted xs">Meals: {recipe.mealTypes.map(titleCase).join(", ")}</p>
                ) : null}
                {nutrition?.proteinGrams !== undefined || nutrition?.fiberGrams !== undefined ? (
                  <p className="muted xs">
                    {nutrition.proteinGrams !== undefined ? `${nutrition.proteinGrams}g protein` : ""}
                    {nutrition.proteinGrams !== undefined && nutrition.fiberGrams !== undefined ? " · " : ""}
                    {nutrition.fiberGrams !== undefined ? `${nutrition.fiberGrams}g fiber` : ""} per portion (est.)
                  </p>
                ) : null}
                {recipe.lastNote ? <p className="serif sm">{recipe.lastNote}</p> : null}
              </div>
            ) : (
              <p className="muted sm">No extra details for this recipe.</p>
            )}
          </div>
        </div>

        <footer className="recipe-sheet__actions">
          <button className="button" onClick={onClose} type="button">
            Close
          </button>
          {onEdit ? (
            <button className="button" onClick={onEdit} type="button">
              Edit
            </button>
          ) : null}
          {onPlan ? (
            <button className="button button--primary" onClick={onPlan} type="button">
              Plan it
            </button>
          ) : null}
          {onCooked ? (
            <button className="button button--success" onClick={onCooked} type="button">
              <Icon name="check" size={16} />
              Cooked it
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
