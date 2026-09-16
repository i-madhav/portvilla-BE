import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

import {
  findLanguage,
  findLlmModel,
  findPreset,
  findSttModel,
  isKnownVoice,
} from '../../domain/agent-stack/catalog';

/** The catalog lists a property can be checked against. */
export type CatalogKind = 'language' | 'stt' | 'llm' | 'voice' | 'preset';

const LOOKUP: Record<CatalogKind, (value: string) => boolean> = {
  language: (v) => findLanguage(v) !== undefined,
  stt: (v) => findSttModel(v) !== undefined,
  llm: (v) => findLlmModel(v) !== undefined,
  voice: isKnownVoice,
  preset: (v) => findPreset(v) !== undefined,
};

const NOUN: Record<CatalogKind, string> = {
  language: 'a supported language',
  stt: 'an available listening model',
  llm: 'an available thinking model',
  voice: 'an available voice',
  preset: 'an available preset',
};

/**
 * `@IsCatalogId('stt')` — the value must be an id the catalog knows. One
 * declarative check per field, so a model can be retired by removing its
 * catalog entry and every request path rejects it the same way.
 *
 * Cross-field rules (a voice that speaks the primary language, and so on) are
 * not expressible per property; they live in `agent-stack.rules.ts` and run in
 * the service over the merged section.
 */
export function IsCatalogId(
  kind: CatalogKind,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isCatalogId',
      target: target.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [kind],
      validator: {
        validate: (value: unknown, args: ValidationArguments): boolean =>
          typeof value === 'string' &&
          LOOKUP[args.constraints[0] as CatalogKind](value),
        defaultMessage: (args: ValidationArguments): string =>
          `${args.property} must be ${NOUN[args.constraints[0] as CatalogKind]}.`,
      },
    });
  };
}
