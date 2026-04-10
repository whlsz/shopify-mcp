import { z } from "zod";
import { shopifyGraphQL, truncate } from "../services/shopify-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const INVENTORY_QUERY = `
query inventoryLevels($id: ID!) {
  product(id: $id) {
    id
    title
    totalInventory
    variants(first: 50) {
      edges {
        node {
          id
          title
          sku
          inventoryQuantity
          inventoryItem {
            id
            tracked
            inventoryLevels(first: 10) {
              edges {
                node {
                  id
                  available
                  location { id name }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const LOCATIONS_QUERY = `
query locations {
  locations(first: 50) {
    edges {
      node {
        id
        name
        isActive
        fulfillmentService { handle }
      }
    }
  }
}`;

export function registerInventoryTools(server: McpServer) {
  server.registerTool(
    "inventory_levels",
    {
      title: "Get Inventory Levels",
      description:
        "Get inventory levels for a product across all locations, broken down by variant.",
      inputSchema: z.object({
        product_id: z.string().describe("Product GID or numeric ID"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ product_id }) => {
      const gid = product_id.startsWith("gid://")
        ? product_id
        : `gid://shopify/Product/${product_id}`;

      const data = await shopifyGraphQL(INVENTORY_QUERY, { id: gid });
      const product = (data.data as any)?.product;

      if (!product) {
        return { content: [{ type: "text" as const, text: `Product not found: ${gid}` }] };
      }

      const variants = (product.variants?.edges ?? []).map((e: any) => ({
        id: e.node.id,
        title: e.node.title,
        sku: e.node.sku,
        quantity: e.node.inventoryQuantity,
        tracked: e.node.inventoryItem?.tracked,
        locations: (e.node.inventoryItem?.inventoryLevels?.edges ?? []).map((l: any) => ({
          location: l.node.location.name,
          available: l.node.available,
        })),
      }));

      const result = {
        product: product.title,
        totalInventory: product.totalInventory,
        variants,
      };

      return {
        content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }],
      };
    }
  );

  server.registerTool(
    "inventory_locations",
    {
      title: "List Locations",
      description: "List all inventory locations for the store.",
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      const data = await shopifyGraphQL(LOCATIONS_QUERY);
      const locations = ((data.data as any)?.locations?.edges ?? []).map((e: any) => ({
        id: e.node.id,
        name: e.node.name,
        active: e.node.isActive,
        fulfillment: e.node.fulfillmentService?.handle ?? null,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ locations }, null, 2) }],
      };
    }
  );
}
