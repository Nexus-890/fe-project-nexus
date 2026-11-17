/** Generated from the proposed #217 system config contract, not a delivered API. Run npm run generate:types; do not edit. */
export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ConfigValue: string | number | boolean;
        SystemConfig: {
            key: string;
            value: components["schemas"]["ConfigValue"];
            defaultValue: components["schemas"]["ConfigValue"];
            description: string;
            group: string;
        };
        ConfigUpdate: {
            value: components["schemas"]["ConfigValue"];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
