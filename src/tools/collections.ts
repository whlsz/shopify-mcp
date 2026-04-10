import { z } from "zod";
import { shopifyGraphQL, truncate } from "../services/shopify-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const LIST_QUERY = `
query listCollections($first: Int!, $after: String, $query: String) {
  collections(first: $first, after: $after, query: $query) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id
        title
        handle
        productsCount { count }
        updatedAt
        image { url }
      }
    }
  }
}`;

const GET_QUERY = `
query getCollection($id: ID!, $productFirst: Int!, $productAfter: String) {
  collection(id: $id) {
    id
    title
    handle
    descriptionHtml
    productsCount { count }
    updatedAt
    image { url }
    products(first: $productFirst, after: $productAfter) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          vendor
          productType
          status
          totalInventory
        }
      }
    }
  }
}`;

export function registerCollectionTools(server: McpServer) {
  server.registerTool(
    "collections_list",
    {
      title: "List Collections",
      description: "Browse Shopify collections with optional search.",
      inputSchema: z.object({
        query: z.string().optional(),
        first: z.number().min(1).max(100).optional().default(25),
        after: z.string().optional(),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, first, after }) => {
      const data = await shopifyGraphQL(LIST_QUERY, {
        first: first ?? 25,
        after: after ?? null,
        query: query ?? null,
      });

      const collections = (data.data as any)?.collections;
      const edges = collections?.edges ?? [];
      const pageInfo = collections?.pageInfo ?? {};

      const items = edges.map((e: any) => ({
        id: e.node.id,
        title: e.node.title,
        handle: e.node.handle,
        productCount: e.node.productsCount?.count ?? 0,
        updated: e.node.updatedAt,
      }));

      return {
        content: [{ type: "text" as const, text: truncate(JSON.stringify({ count: items.length, hasNextPage: pageInfo.hasNextPage, endCursor: pageInfo.endCursor, collections: items }, null, 2)) }],
      };
    }
  );

  server.registerTool(
    "collections_get",
    {
      title: "Get Collection with Products",
      description: "Fetch a collection and its products. Supports pagination of products within the collection.",
      inputSchema: z.object({
        collection_id: z.string().describe("Collection GID or numeric ID"),
        product_first: z.number().min(1).max(100).optional().default(25),
        product_after: z.string().optional(),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ collection_id, product_first, product_after }) => {
      const gid = collection_id.startsWith("gid://")
        ? collection_id
        : `gid://shopify/Collection/${collection_id}`;

      const data = await shopifyGraphQL(GET_QUERY, {
        id: gid,
        productFirst: product_first ?? 25,
        productAfter: product_after ?? null,
      });

      const collection = (data.data as any)?.collection;
      if (!collection) {
        return { content: [{ type: "text" as const, text: `Collection not found: ${gid}` }] };
      }

      const result = {
        ...collection,
        products: {
          pageInfo: collection.products?.pageInfo,
          items: collection.products?.edges?.map((e: any) => e.node) ?? [],
        },
      };

      return {
        content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }],
      };
    }
  );
}
