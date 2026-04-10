# @whlzs25/shopify-mcp

MCP server for the Shopify Admin API. Gives AI agents (Claude Code, Cursor, etc.) direct access to a Shopify store's products, orders, inventory, collections, and raw GraphQL.

## Tools

| Tool | Description |
|------|-------------|
| `shop_info` | Store name, plan, product/order counts |
| `products_list` | Browse products with search, filters, sort, pagination |
| `products_get` | Full product details (variants, images, metafields) |
| `products_update` | Update title, description, vendor, type, tags, status |
| `products_count` | Quick count with query filter |
| `inventory_levels` | Inventory by variant across locations |
| `inventory_locations` | List all store locations |
| `orders_list` | Browse orders with search, sort, pagination |
| `orders_get` | Full order details (line items, fulfillments, shipping) |
| `collections_list` | Browse collections |
| `collections_get` | Collection details with products |
| `graphql_raw` | Execute any Shopify Admin GraphQL query/mutation |

## Setup

```bash
npm install
npm run build
```

### Environment Variables

```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxx
```

### Claude Code (.mcp.json)

```json
{
  "shopify": {
    "type": "stdio",
    "command": "npx",
    "args": ["tsx", "/path/to/shopify-mcp/src/index.ts"],
    "env": {
      "SHOPIFY_STORE_DOMAIN": "your-store.myshopify.com",
      "SHOPIFY_ADMIN_TOKEN": "shpat_xxxxxxxxxxxx"
    }
  }
}
```

## Examples

- "How many products are in draft?" → `products_count` with query `status:draft`
- "Show me all Collective products" → `products_list` with query `tag:Collective`
- "What's the inventory for product 12345?" → `inventory_levels`
- "Update vendor to Nike for product 12345" → `products_update`
- "Get today's orders" → `orders_list` with query `created_at:>2026-04-10`

## License

MIT - Built by WHLZS
