import { z } from "zod";
import { shopifyGraphQL, truncate } from "../services/shopify-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const LIST_QUERY = `
query listProducts($first: Int!, $after: String, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
  products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id
        title
        productType
        vendor
        status
        tags
        totalInventory
        createdAt
        updatedAt
        images(first: 1) { edges { node { url } } }
      }
    }
  }
}`;

const GET_QUERY = `
query getProduct($id: ID!) {
  product(id: $id) {
    id
    title
    descriptionHtml
    productType
    vendor
    status
    tags
    totalInventory
    createdAt
    updatedAt
    images(first: 10) { edges { node { id url altText width height } } }
    variants(first: 50) {
      edges {
        node {
          id
          title
          sku
          price
          compareAtPrice
          inventoryQuantity
          selectedOptions { name value }
        }
      }
    }
    metafields(first: 30) { edges { node { namespace key value type } } }
  }
}`;

const UPDATE_MUTATION = `
mutation productUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id title vendor productType tags status }
    userErrors { field message }
  }
}`;

export function registerProductTools(server: McpServer) {
  server.registerTool(
    "products_list",
    {
      title: "List Products",
      description:
        "Browse Shopify products with search, filtering, sorting, and pagination. " +
        "Use query for Shopify search syntax (e.g. 'tag:Collective', 'vendor:Nike', 'created_at:>2026-01-01').",
      inputSchema: z.object({
        query: z.string().optional().describe("Shopify search query (e.g. 'tag:Collective status:draft')"),
        first: z.number().min(1).max(100).optional().default(25).describe("Number of products to return (max 100)"),
        after: z.string().optional().describe("Cursor for pagination"),
        sort_key: z.enum(["CREATED_AT", "UPDATED_AT", "TITLE", "PRODUCT_TYPE", "VENDOR", "INVENTORY_TOTAL", "BEST_SELLING"]).optional().default("CREATED_AT"),
        reverse: z.boolean().optional().default(true).describe("Reverse sort order (true = newest first)"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, first, after, sort_key, reverse }) => {
      const data = await shopifyGraphQL(LIST_QUERY, {
        first: first ?? 25,
        after: after ?? null,
        query: query ?? null,
        sortKey: sort_key ?? "CREATED_AT",
        reverse: reverse ?? true,
      });

      const products = data.data as any;
      const edges = products?.products?.edges ?? [];
      const pageInfo = products?.products?.pageInfo ?? {};

      const items = edges.map((e: any) => ({
        id: e.node.id,
        title: e.node.title,
        type: e.node.productType,
        vendor: e.node.vendor,
        status: e.node.status,
        tags: e.node.tags,
        inventory: e.node.totalInventory,
        created: e.node.createdAt,
        thumbnail: e.node.images?.edges?.[0]?.node?.url ?? null,
      }));

      const result = {
        count: items.length,
        hasNextPage: pageInfo.hasNextPage,
        endCursor: pageInfo.endCursor,
        products: items,
      };

      return {
        content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }],
      };
    }
  );

  server.registerTool(
    "products_get",
    {
      title: "Get Product Details",
      description:
        "Fetch full details for a single product including variants, images, and metafields. " +
        "Pass either a GID (gid://shopify/Product/123) or numeric ID (123).",
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

      const data = await shopifyGraphQL(GET_QUERY, { id: gid });
      const product = (data.data as any)?.product;

      if (!product) {
        return { content: [{ type: "text" as const, text: `Product not found: ${gid}` }] };
      }

      const result = {
        ...product,
        images: product.images?.edges?.map((e: any) => e.node) ?? [],
        variants: product.variants?.edges?.map((e: any) => e.node) ?? [],
        metafields: product.metafields?.edges?.map((e: any) => e.node) ?? [],
      };

      return {
        content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }],
      };
    }
  );

  server.registerTool(
    "products_update",
    {
      title: "Update Product",
      description:
        "Update a Shopify product's title, description, vendor, product type, tags, or status. " +
        "Only include fields you want to change.",
      inputSchema: z.object({
        product_id: z.string().describe("Product GID or numeric ID"),
        title: z.string().optional(),
        description_html: z.string().optional(),
        vendor: z.string().optional(),
        product_type: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ product_id, title, description_html, vendor, product_type, tags, status }) => {
      const gid = product_id.startsWith("gid://")
        ? product_id
        : `gid://shopify/Product/${product_id}`;

      const input: Record<string, unknown> = { id: gid };
      if (title !== undefined) input.title = title;
      if (description_html !== undefined) input.descriptionHtml = description_html;
      if (vendor !== undefined) input.vendor = vendor;
      if (product_type !== undefined) input.productType = product_type;
      if (tags !== undefined) input.tags = tags;
      if (status !== undefined) input.status = status;

      const data = await shopifyGraphQL(UPDATE_MUTATION, { input });
      const result = (data.data as any)?.productUpdate;
      const errors = result?.userErrors ?? [];

      if (errors.length > 0) {
        return {
          content: [{ type: "text" as const, text: `Update failed:\n${errors.map((e: any) => `${e.field}: ${e.message}`).join("\n")}` }],
        };
      }

      return {
        content: [{ type: "text" as const, text: `Updated product ${result.product.id}: ${result.product.title}` }],
      };
    }
  );

  server.registerTool(
    "products_count",
    {
      title: "Count Products",
      description: "Count products matching a query. Useful for quick stats like 'how many Collective products are in draft?'",
      inputSchema: z.object({
        query: z.string().optional().describe("Shopify search query"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query }) => {
      const countQuery = `query countProducts($query: String) { productsCount(query: $query) { count } }`;
      const data = await shopifyGraphQL(countQuery, { query: query ?? null });
      const count = (data.data as any)?.productsCount?.count ?? 0;

      return {
        content: [{ type: "text" as const, text: `Product count: ${count}${query ? ` (query: "${query}")` : ""}` }],
      };
    }
  );
}
