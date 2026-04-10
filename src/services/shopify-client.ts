/**
 * Shopify Admin GraphQL client.
 * Reads SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN from env.
 */

const API_VERSION = "2025-04";

interface GraphQLResponse<T = Record<string, unknown>> {
  data?: T;
  errors?: Array<{ message: string; locations?: unknown[]; path?: string[] }>;
  extensions?: { cost?: { requestedQueryCost: number; actualQueryCost: number; throttleStatus: { maximumAvailable: number; currentlyAvailable: number; restoreRate: number } } };
}

function getConfig() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token) {
    throw new Error(
      "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN environment variables"
    );
  }
  const host = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return { host, token };
}

export async function shopifyGraphQL<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>
): Promise<GraphQLResponse<T>> {
  const { host, token } = getConfig();
  const endpoint = `https://${host}/admin/api/${API_VERSION}/graphql.json`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    const msgs = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Shopify GraphQL: ${msgs}`);
  }

  return json;
}

export function truncate(text: string, limit = 25000): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + `\n\n... (truncated, ${text.length} total chars)`;
}
