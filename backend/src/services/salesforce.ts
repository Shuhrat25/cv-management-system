interface SFCreateResponse {
  id: string;
  success: boolean;
  errors: any[];
}

interface SFTokenResponse {
  access_token: string;
  instance_url: string;
}

let cachedToken: { access_token: string; instance_url: string } | null = null;

export async function getSalesforceToken(): Promise<SFTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: process.env.SF_CLIENT_ID!,
    client_secret: process.env.SF_CLIENT_SECRET!,
    username: process.env.SF_USERNAME!,
    password: process.env.SF_PASSWORD!,
  });

  const response = await fetch(`${process.env.SF_LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Salesforce auth failed: ${response.status} ${errText}`);
  }

  const data = (await response.json()) as SFTokenResponse;
  cachedToken = data;
  return data;
}

export async function createSalesforceRecord(
  objectName: string,
  payload: Record<string, any>
): Promise<SFCreateResponse> {
  const { access_token, instance_url } = await getSalesforceToken();

  const response = await fetch(
    `${instance_url}/services/data/v60.0/sobjects/${objectName}/`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const data = (await response.json()) as SFCreateResponse;

  if (!response.ok) {
    throw new Error(`Salesforce API error: ${JSON.stringify(data)}`);
  }

  return data;
}