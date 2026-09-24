/**
 * The demo description: Portvilla in the owner’s own voice.
 *
 * A **TypeScript constant, not a `.txt` asset**, because `nest build` compiles and
 * copies nothing else — a text file beside this one would be missing from `dist/`
 * and the seed would fail only after a build, which is the worst place to find out.
 *
 * Every fact in it comes from this repository’s own documents: the decision docs,
 * `PLAN.md` and the cross-repo roadmap. Nothing is invented — no customers, no
 * quotes, no revenue, no team. That is the point of the demo. The sections with no
 * grounded material here (testimonials, offerings, team) are *expected* to come back
 * empty, and an empty section is the honest result, not a defect; seeding fiction to
 * fill them would make the one profile everybody looks at the one profile that lies.
 *
 * Copied verbatim from `docs/plan/plan.md` → Appendix A, wrapping included. The line
 * breaks are harmless: grounding normalises whitespace before it compares anything.
 *
 * `--brief <path>` swaps in another description to exercise the other entity types;
 * this one is the default.
 */
export const PORTVILLA_BRIEF = `
Portvilla turns a portfolio into a voice agent that speaks for its owner. Instead of a
static page, a visitor opens portvilla.in/<username> and talks to an agent that represents
the owner in the third person, answers questions about their work, and puts the exact
matching slide on screen while it speaks. The agent can only say what it has shown: every
slide is derived from the owner's saved knowledge, and the agent has no other source.

Who it is for: individual developers and designers, companies, products and organizations.
One profile schema serves all four entity types, with eleven knowledge sections: identity,
works with their stages, timeline, capabilities, offerings, metrics, testimonials, team,
media, content and social links.

How it works. An owner signs up with email and a one-time code, chooses an address, and
adds their knowledge either by hand or from a résumé PDF (up to 5 MB), which Portvilla
turns into drafted suggestions the owner reviews before anything is saved. Every array
entry gets a stable key, and a product or project can carry a story: an ordered arc of
stages such as private beta, general availability and scale, each with a one-breath summary
the agent says aloud and a longer detail it keeps for when a visitor asks to go deeper. A
pure projector derives the slide catalog from the profile at read time, so there is never a
second copy of the content to keep in sync. Today the catalog has six slide templates:
identity, work, work stage, capabilities, timeline and contact.

The conversation. A visitor clicks "Talk to <agent>", the browser joins a LiveKit room, and
a Python worker built on LiveKit Agents runs speech-to-text, a language model and
text-to-speech. Before it describes anything the agent calls a show-slide tool, so the
visual is on screen when the voice arrives. It can step to the next slide to walk a story
one stage per turn, expand the current slide for more depth, or clear the screen and return
to the orb. Slides travel to the browser over the LiveKit data channel with their payload
inline, so the frontend renders by template and never needs a catalog of its own.

Owner controls. Visibility is public, protected (visitors enter a password) or private.
The owner names the agent and sets its tone (formal, balanced or casual), verbosity and
technical depth. Since 7 September 2026 the owner also picks the agent's stack from a
catalog: the primary language, whether it listens in one language or many, whether it
replies in the visitor's language, the speech-to-text model with boosted key terms, the
language model, the voice and speaking speed, and turn-taking (whether the visitor may
interrupt, and how patient the agent is before answering). Presets, added 13 September
2026, fill all of that in one click. Since 16 September 2026 the owner can preview the exact
slide catalog the agent will narrate from the dashboard.

Cost guards, shipped 13 September 2026: each profile has a monthly budget of voice minutes
(120 by default); a session wraps up at nine minutes and ends at ten; after sixty seconds
of silence the agent asks whether the visitor is still there and ends the session at
ninety. When the budget is spent, the page says the agent is resting and shows the profile.

Technology. Three repositories: a NestJS 11 API on MongoDB with Mongoose, a React 18 and
Vite frontend with a single design system of tokens and primitives, and a Python LiveKit
Agents worker. The API deploys to Google Cloud Run from GitHub Actions; the worker deploys
to LiveKit Cloud. A GitHub parser can read a user's top ten repositories and summarise
them. The design system, promoted across the product on 5 September 2026, uses warm paper
surfaces, one violet accent, Bricolage Grotesque for human language and IBM Plex Mono for
system language.

How it evolved. Accounts with one-time-code verification and the first profile endpoints
landed on 30 May 2026. The entity-agnostic profile schema followed on 2 June 2026, the
agent persona on 3 June, and the provider-agnostic LLM layer on 4 June. The LiveKit session
lifecycle arrived on 14 June 2026 and Docker packaging on 28 June. The onboarding revamp and
the dashboard shipped on 4 July 2026, continuous deployment to Cloud Run on 11 July, résumé
parsing with prefilled suggestions on 17 July, and the public profile page on 18 July 2026.
The warm voice-first design system was accepted on 23 August 2026. The narrative layer,
with stable keys, work stages and the derived slide catalog, was built and verified end to
end through late August and early September 2026. Agent stack configuration shipped on
7 September, presets and cost guards on 13 September, and the owner's slide preview on
16 September 2026.

Status. Portvilla is in early access. The landing page introduces the product through the
intro agent and invites visitors to join the waitlist. Next on the roadmap: a slide for every
knowledge section, a text lane with captions for visitors without a microphone, evidence
links between skills and the work that proves them, and conversation transcripts and
unanswered questions reported back to the owner.

Links: https://portvilla.in
`;
