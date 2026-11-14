// "Eerst bekijken, dan online zetten": when a repository has a branch with this
// name, the CMS opens it instead of the default branch. Saves land there, and
// the "Zet online" button merges it into the default branch (the live site).
export const CONCEPT_BRANCH = "concept";

export const isConceptBranch = (branch?: string | null) => branch === CONCEPT_BRANCH;
