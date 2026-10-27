export async function graphqlRequest(url, { query, variables, operationName, headers = {}, signal } = {}) {
  if (!query) throw new TypeError('GraphQL query is required');
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ query, variables, operationName }), signal });
  const text = await response.text(); let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, headers: Object.fromEntries(response.headers), body, ok: response.ok };
}
