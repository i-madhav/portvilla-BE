/**
 * Upper bound on the number of entries in any one array section.
 *
 * Not a product limit — it is a bound that keeps a profile document, its public
 * payload, and the agent's derived slide catalog finite. Without it a single
 * profile can grow until it exhausts the agent's prompt token budget.
 */
export const MAX_SECTION_ENTRIES = 100;

/**
 * Upper bound on the stages nested inside one work. Lower than a section: a
 * lifecycle the agent narrates one stage at a time stops being a story long
 * before this.
 */
export const MAX_STAGES_PER_WORK = 20;

/**
 * The length of a stage `summary` the agent can say in one breath.
 *
 * Lives here rather than on the DTO because two layers need the same number:
 * the DTO rejects anything longer at the boundary, and the slide projector
 * trims derived talk tracks to it.
 */
export const STAGE_SUMMARY_MAX_LENGTH = 200;
