import { z } from "zod";
import { shopifyGraphQL, truncate } from "../services/shopify-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGraphQLTool(server: McpServer) {
  server.registerTool(
    "graphql_raw",
    {
      title: "Raw GraphQL Query",
      description:
        "Execute any Shopify Admin GraphQL query or mutation directly. " +
        "Use this for operations not covered by other tools, or for custom reporting queries. " +
        "See Shopify Admin API docs for available queries and mutations.",
      inputSchema: z.object({
        query: z.string().describe("GraphQL query or mutation string"),
        variables: z.record(z.unknown()).optional().describe("GraphQL variables object"),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ query, variables }) => {
      const data = await shopifyGraphQL(query, variables ?? undefined);

      const result: Record<string, unknown> = { data: data.data };
      if (data.extensions?.cost) {
        result.cost = data.extensions.cost;
      }

      return {
        content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }],
      };
    }
  );
}
