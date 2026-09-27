import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * Tolerance for the sum. Regions are drawn in floating-point percentages, and
 * `33.3 + 66.7` is `100.00000000000001` — a region flush with the edge must not
 * be rejected for it.
 */
const EPSILON = 1e-9;

/**
 * `@FitsWithinImage('x')` on `w` — the extent, added to its origin, must stay
 * inside the image (`x + w ≤ 100`), since both are percentages of it.
 *
 * Only the sum is checked here. Whether each side is a number in range is left
 * to its own validators, so a bad origin is reported once, on the origin.
 */
export function FitsWithinImage(
  origin: string,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'fitsWithinImage',
      target: target.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [origin],
      validator: {
        validate: (value: unknown, args: ValidationArguments): boolean => {
          const start = (args.object as Record<string, unknown>)[
            args.constraints[0] as string
          ];
          if (typeof value !== 'number' || typeof start !== 'number') {
            return true;
          }
          return start + value <= 100 + EPSILON;
        },
        defaultMessage: (args: ValidationArguments): string =>
          `${args.constraints[0] as string} + ${args.property} must not exceed 100.`,
      },
    });
  };
}
