/**
 * Which slice of a player-type form to render.
 *
 * These forms are shared by onboarding and /profile/edit — the edit page
 * imports the exact same components. So the way to shorten onboarding is NOT
 * to delete fields (that would make them permanently unreachable, since the
 * editor is the only other place they appear) but to render a subset of them.
 * One component, one field definition, two audiences.
 *
 * - `onboarding`: only what a profile needs to be recognisable and findable.
 * - `full`: everything, which is what the editor shows.
 *
 * Everything hidden in `onboarding` is optional in `full` too. A deferred field
 * that stayed `required` would lock the editor's save button for every user who
 * skipped it — and because the photos section shares that save path, it would
 * block saving photos as well.
 */
export type FormMode = "onboarding" | "full";
