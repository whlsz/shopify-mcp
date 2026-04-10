#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerProductTools } from "./tools/products.js";
import { registerInventoryTools } from "./tools/inventory.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerCollectionTools } from "./tools/collections.js";
import { registerGraphQLTool } from "./tools/graphql.js";
import { registerShopTools } from "./tools/shop.js";

const server = new McpServer({
  name: "shopify-mcp",
  version: "0.1.0",
});

// Register all tool groups
registerShopTools(server);
registerProductTools(server);
registerInventoryTools(server);
registerOrderTools(server);
registerCollectionTools(server);
registerGraphQLTool(server);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
