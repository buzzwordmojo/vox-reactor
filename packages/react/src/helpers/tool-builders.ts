// ═══════════════════════════════════════════════════════════
// Tool Definition Builders
// Helpers for creating common tool definitions
// ═══════════════════════════════════════════════════════════

import type { ToolDefinition } from "@vox-reactor/core";

// ─────────────────────────────────────────────────────────
// Navigation Tool
// ─────────────────────────────────────────────────────────

export interface NavigationToolConfig {
  /** Valid route paths */
  routes: string[];
  /** Optional aliases mapping phrases to routes */
  aliases?: Record<string, string>;
  /** Custom description (auto-generated if omitted) */
  description?: string;
}

export function createNavigationTool(
  config: NavigationToolConfig
): ToolDefinition {
  const aliasHints = config.aliases
    ? "\n\nCommon phrases:\n" +
      Object.entries(config.aliases)
        .map(([phrase, route]) => `- "${phrase}" → ${route}`)
        .join("\n")
    : "";

  return {
    type: "function",
    name: "navigate",
    description:
      config.description ??
      `Navigate to a page in the app.${aliasHints}`,
    parameters: {
      type: "object",
      properties: {
        route: {
          type: "string",
          enum: config.routes,
          description: "The route to navigate to",
        },
      },
      required: ["route"],
    },
  };
}

// ─────────────────────────────────────────────────────────
// CRUD Tools
// ─────────────────────────────────────────────────────────

export interface CrudToolsConfig {
  /** Table/resource name (e.g., "skills", "contacts") */
  table: string;
  /** Field definitions */
  fields: Record<
    string,
    | string
    | { type: string; enum?: string[]; description?: string; minimum?: number; maximum?: number }
  >;
  /** Which operations to generate */
  operations?: Array<"create" | "update" | "delete" | "get">;
  /** Fields required for create */
  requiredFields?: string[];
}

export function createCrudTools(config: CrudToolsConfig): ToolDefinition[] {
  const ops = config.operations ?? ["create"];
  const tools: ToolDefinition[] = [];

  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config.fields)) {
    if (typeof value === "string") {
      properties[key] = { type: value };
    } else {
      properties[key] = value;
    }
  }

  const singular = config.table.replace(/s$/, "");

  if (ops.includes("create")) {
    tools.push({
      type: "function",
      name: `create${capitalize(singular)}`,
      description: `Create a new ${singular}.`,
      parameters: {
        type: "object",
        properties,
        required: config.requiredFields ?? [],
      },
    });
  }

  if (ops.includes("update")) {
    tools.push({
      type: "function",
      name: `update${capitalize(singular)}`,
      description: `Update an existing ${singular}.`,
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: `The ${singular} ID to update` },
          ...properties,
        },
        required: ["id"],
      },
    });
  }

  if (ops.includes("delete")) {
    tools.push({
      type: "function",
      name: `delete${capitalize(singular)}`,
      description: `Delete a ${singular}.`,
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: `The ${singular} ID to delete` },
        },
        required: ["id"],
      },
    });
  }

  if (ops.includes("get")) {
    tools.push({
      type: "function",
      name: `get${capitalize(singular)}Status`,
      description: `Get the current ${singular} status/details.`,
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    });
  }

  return tools;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
