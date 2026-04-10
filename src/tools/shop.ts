import { z } from "zod";
import { shopifyGraphQL, truncate } from "../services/shopify-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const SHOP_QUERY = `
query shopInfo {
  shop {
    name
    email
    myshopifyDomain
    primaryDomain { url host }
    plan { displayName }
    currencyCode
    timezoneAbbreviation
    billingAddress { city province country }
    productCount: productsCount { count }
    orderCount: ordersCount(query: "") { count }
  }
}`;

export function registerShopTools(server: McpServer) {
  server.registerTool(
    "shop_info",
    {
      title: "Shop Info",
      description: "Get basic information about the connected Shopify store.",
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      const data = await shopifyGraphQL(SHOP_QUERY);
      const shop = (data.data as any)?.shop;

      const result = {
        name: shop?.name,
        email: shop?.email,
        domain: shop?.primaryDomain?.url,
        myshopifyDomain: shop?.myshopifyDomain,
        plan: shop?.plan?.displayName,
        currency: shop?.currencyCode,
        timezone: shop?.timezoneAbbreviation,
        location: shop?.billingAddress
          ? `${shop.billingAddress.city}, ${shop.billingAddress.province}, ${shop.billingAddress.country}`
          : null,
        productCount: shop?.productCount?.count ?? 0,
        orderCount: shop?.orderCount?.count ?? 0,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
