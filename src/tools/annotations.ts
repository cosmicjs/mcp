/**
 * Tool Annotations
 *
 * MCP clients use these hints to decide how much friction to put in front of a
 * tool call: read-only tools can be auto-approved, destructive ones should
 * prompt. The Anthropic connector directory also requires every tool to carry a
 * title plus the applicable readOnlyHint or destructiveHint.
 *
 * Grouping the hints into three builders keeps the policy consistent across all
 * tools instead of restating five fields on each definition. `title` is emitted
 * both at the top level (current spec) and inside `annotations` (where older
 * clients still look for it).
 *
 * Every tool here is closed-world: the domain of interaction is a single Cosmic
 * bucket plus Cosmic's own API, never an open set of external entities.
 */

interface AnnotatedTool {
  title: string;
  annotations: {
    title: string;
    readOnlyHint: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint: boolean;
  };
}

/** Reads state without modifying anything. Safe for clients to auto-approve. */
export function readOnlyTool(title: string): AnnotatedTool {
  return {
    title,
    annotations: {
      title,
      readOnlyHint: true,
      openWorldHint: false,
    },
  };
}

/**
 * Creates new resources or consumes billable AI credits, but never overwrites
 * or removes existing content. Not idempotent: calling twice creates twice.
 */
export function additiveTool(title: string): AnnotatedTool {
  return {
    title,
    annotations: {
      title,
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  };
}

/**
 * Overwrites or removes existing content. Idempotent, since repeating the same
 * call leaves the bucket in the same state it reached the first time.
 */
export function destructiveTool(title: string): AnnotatedTool {
  return {
    title,
    annotations: {
      title,
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  };
}
