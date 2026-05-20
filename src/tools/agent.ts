/**
 * Agent Signup Tools (bucket-less scope)
 *
 * Three tools that proxy to cosmic-backend's public /v3/agents/* endpoints.
 * These tools do NOT use the Cosmic SDK (data plane); they use the dapi
 * client (control plane) so an agent can provision a bucket from scratch
 * without any prior credentials.
 *
 * Flow:
 *   1. cosmic_agent_signup  : create bucket tied to a human_email. No auth.
 *   2. cosmic_agent_verify  : pass the OTP back. Requires agent_key.
 *   3. cosmic_agent_status  : check claim status & limits. Requires agent_key.
 */

import { z } from 'zod';
import { dapiRequest } from '../dapiClient.js';
import type { ToolResult } from '../types.js';

export const agentSignupSchema = z.object({
  human_email: z
    .string()
    .email()
    .describe(
      "The human's email address. AgentMail-style: tying the agent project to a real human from the first call gives us a real ToS-bearing party and an address to email the claim OTP to.",
    ),
  project_name: z
    .string()
    .min(1)
    .max(60)
    .describe(
      'Short human-readable name for the project (e.g. "Recipe Blog"). Used as both the project title and the bucket title.',
    ),
  agent_id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_.-]+$/)
    .describe(
      'Stable identifier for the calling agent platform (e.g. "claude-code", "cursor-agent"). Used for daily rate-limit accounting and partner attribution.',
    ),
  client: z
    .string()
    .max(64)
    .optional()
    .describe('Optional finer-grained client identifier (e.g. "cursor-1.0.5").'),
  prompt_hint: z
    .string()
    .max(500)
    .optional()
    .describe(
      "Optional short summary of what the human asked for. Stored as the project's description so the human sees context when they claim.",
    ),
});

export const agentVerifySchema = z.object({
  code: z
    .string()
    .min(4)
    .max(10)
    .describe(
      'The 6-digit OTP code the human received via email. Pasted back to the agent in chat.',
    ),
});

export const agentStatusSchema = z.object({});

export const agentTools = [
  {
    name: 'cosmic_agent_signup',
    description:
      'Create a new, unclaimed Cosmic project + bucket tied to a human email. Returns bucket keys (read_key, write_key) plus an agent_key the agent uses for verify/status. The bucket starts in restricted mode (no AI credits, max 50 objects, max 5 MB media). Cosmic emails the human a 6-digit OTP and a claim URL; the human pastes the OTP back to the agent which calls cosmic_agent_verify to lift restrictions. If the email already belongs to a real Cosmic user, returns a 409; ask the human to log in and grant the agent a bucket key instead.',
    inputSchema: {
      type: 'object' as const,
      required: ['human_email', 'project_name', 'agent_id'],
      properties: {
        human_email: {
          type: 'string',
          format: 'email',
          description: 'Email address of the human the agent is acting on behalf of.',
        },
        project_name: {
          type: 'string',
          description: 'Human-readable project name.',
        },
        agent_id: {
          type: 'string',
          description: 'Stable identifier for the calling agent platform.',
        },
        client: {
          type: 'string',
          description: 'Optional finer-grained client identifier.',
        },
        prompt_hint: {
          type: 'string',
          description: 'Optional summary of what the human asked for.',
        },
      },
    },
  },
  {
    name: 'cosmic_agent_verify',
    description:
      'Submit the 6-digit OTP code the human received via email to verify the agent project. On success, the bucket lifts restricted-mode limits (AI credits, object/media caps). Requires agent_key from cosmic_agent_signup.',
    inputSchema: {
      type: 'object' as const,
      required: ['code'],
      properties: {
        code: {
          type: 'string',
          description: 'The 6-digit OTP code from the claim email.',
        },
      },
    },
  },
  {
    name: 'cosmic_agent_status',
    description:
      'Return the current auth_type ("unclaimed" or "verified"), plan, claim status, and tier limits for the authenticated agent key. Use this to introspect what the agent is currently allowed to do, especially after a 402 agent_unclaimed_limit error.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

export async function handleAgentSignup(
  params: z.infer<typeof agentSignupSchema>,
): Promise<ToolResult> {
  const result = await dapiRequest<unknown>({
    method: 'POST',
    path: '/agents/sign-up',
    body: params,
    authenticated: false,
  });
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function handleAgentVerify(
  params: z.infer<typeof agentVerifySchema>,
): Promise<ToolResult> {
  const result = await dapiRequest<unknown>({
    method: 'POST',
    path: '/agents/verify',
    body: params,
    authenticated: true,
  });
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function handleAgentStatus(): Promise<ToolResult> {
  const result = await dapiRequest<unknown>({
    method: 'GET',
    path: '/agents/status',
    authenticated: true,
  });
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
