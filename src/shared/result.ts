export { ok, err, Result, Ok, Err } from "neverthrow";

export type DomainError =
    | { type: "NOT_FOUND"; message: string }
    | { type: "CONFLICT"; message: string }
    | { type: "VALIDATION"; message: string }
    | { type: "BUSINESS_RULE"; message: string }
    | { type: "FORBIDDEN"; message: string }
    | { type: "UNAUTHORIZED"; message: string };

export const DomainErrors = {
    notFound: (msg: string): DomainError => ({ type: "NOT_FOUND", message: msg }),
    conflict: (msg: string): DomainError => ({ type: "CONFLICT", message: msg }),
    validation: (msg: string): DomainError => ({ type: "VALIDATION", message: msg }),
    businessRule: (msg: string): DomainError => ({ type: "BUSINESS_RULE", message: msg }),
    forbidden: (msg: string): DomainError => ({ type: "FORBIDDEN", message: msg }),
    unauthorized: (msg: string): DomainError => ({ type: "UNAUTHORIZED", message: msg }),
} as const;

export function domainErrorToStatus(err: DomainError): number {
    switch (err.type) {
        case "NOT_FOUND": return 404;
        case "CONFLICT": return 409;
        case "VALIDATION": return 400;
        case "BUSINESS_RULE": return 422;
        case "FORBIDDEN": return 403;
        case "UNAUTHORIZED": return 401;
    }
}