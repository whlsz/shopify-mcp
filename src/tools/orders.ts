import { z } from "zod";
import { shopifyGraphQL, truncate } from "../services/shopify-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const LIST_QUERY = `
query listOrders($first: Int!, $after: String, $query: String, $sortKey: OrderSortKeys, $reverse: Boolean) {
  orders(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet { shopMoney { amount currencyCode } }
        subtotalPriceSet { shopMoney { amount currencyCode } }
        customer { firstName lastName email }
        lineItems(first: 5) {
          edges {
            node {
              title
              quantity
              variant { sku }
            }
          }
        }
      }
    }
  }
}`;

const GET_QUERY = `
query getOrder($id: ID!) {
  order(id: $id) {
    id
    name
    createdAt
    processedAt
    displayFinancialStatus
    displayFulfillmentStatus
    cancelledAt
    cancelReason
    note
    tags
    totalPriceSet { shopMoney { amount currencyCode } }
    subtotalPriceSet { shopMoney { amount currencyCode } }
    totalShippingPriceSet { shopMoney { amount currencyCode } }
    totalTaxSet { shopMoney { amount currencyCode } }
    totalDiscountsSet { shopMoney { amount currencyCode } }
    customer { id firstName lastName email phone }
    shippingAddress { address1 address2 city province zip country }
    lineItems(first: 50) {
      edges {
        node {
          title
          quantity
          variant { id title sku price }
          originalTotalSet { shopMoney { amount currencyCode } }
          discountedTotalSet { shopMoney { amount currencyCode } }
        }
      }
    }
    fulfillments {
      id
      status
      trackingInfo { number url company }
      createdAt
    }
  }
}`;

export function registerOrderTools(server: McpServer) {
  server.registerTool(
    "orders_list",
    {
      title: "List Orders",
      description:
        "Browse Shopify orders with search, sorting, and pagination. " +
        "Use query for Shopify search syntax (e.g. 'financial_status:paid', 'fulfillment_status:unfulfilled').",
      inputSchema: z.object({
        query: z.string().optional().describe("Shopify search query"),
        first: z.number().min(1).max(50).optional().default(25),
        after: z.string().optional(),
        sort_key: z.enum(["CREATED_AT", "UPDATED_AT", "PROCESSED_AT", "TOTAL_PRICE", "ORDER_NUMBER"]).optional().default("CREATED_AT"),
        reverse: z.boolean().optional().default(true),
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

      const orders = (data.data as any)?.orders;
      const edges = orders?.edges ?? [];
      const pageInfo = orders?.pageInfo ?? {};

      const items = edges.map((e: any) => ({
        id: e.node.id,
        name: e.node.name,
        created: e.node.createdAt,
        financial: e.node.displayFinancialStatus,
        fulfillment: e.node.displayFulfillmentStatus,
        total: e.node.totalPriceSet?.shopMoney,
        customer: e.node.customer
          ? `${e.node.customer.firstName ?? ""} ${e.node.customer.lastName ?? ""}`.trim()
          : null,
        items: e.node.lineItems?.edges?.map((l: any) => `${l.node.quantity}x ${l.node.title}`).join(", "),
      }));

      return {
        content: [{ type: "text" as const, text: truncate(JSON.stringify({ count: items.length, hasNextPage: pageInfo.hasNextPage, endCursor: pageInfo.endCursor, orders: items }, null, 2)) }],
      };
    }
  );

  server.registerTool(
    "orders_get",
    {
      title: "Get Order Details",
      description: "Fetch full details for a single order including line items, fulfillments, and shipping.",
      inputSchema: z.object({
        order_id: z.string().describe("Order GID or numeric ID"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ order_id }) => {
      const gid = order_id.startsWith("gid://")
        ? order_id
        : `gid://shopify/Order/${order_id}`;

      const data = await shopifyGraphQL(GET_QUERY, { id: gid });
      const order = (data.data as any)?.order;

      if (!order) {
        return { content: [{ type: "text" as const, text: `Order not found: ${gid}` }] };
      }

      const result = {
        ...order,
        lineItems: order.lineItems?.edges?.map((e: any) => e.node) ?? [],
      };

      return {
        content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }],
      };
    }
  );
}
