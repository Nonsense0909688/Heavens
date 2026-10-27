/** Build authorization headers without logging or persisting credentials. */
export function authorizationHeaders({ bearer, basic } = {}) {
  if (bearer) return { authorization: `Bearer ${bearer}` };
  if (basic) return { authorization: `Basic ${Buffer.from(basic).toString('base64')}` };
  return {};
}

export async function refreshOAuth2Token({ tokenUrl, refreshToken, clientId, clientSecret, fetchImpl = fetch }) {
  if (!tokenUrl || !refreshToken || !clientId) throw new TypeError('tokenUrl, refreshToken, and clientId are required');
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId });
  if (clientSecret) body.set('client_secret', clientSecret);
  const response = await fetchImpl(tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body });
  const data = await response.json();
  if (!response.ok) throw new Error(`OAuth2 token refresh failed (${response.status}): ${data.error_description ?? data.error ?? 'unknown error'}`);
  if (!data.access_token) throw new Error('OAuth2 response did not include access_token');
  return data;
}
