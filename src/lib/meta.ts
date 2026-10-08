import "server-only";

type MetaInput = {
  eventName: "PageView" | "Lead" | "InitiateCheckout";
  eventId: string;
  sourceUrl?: string;
  clientIp?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
};

export async function sendMetaEvent(input: MetaInput): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  const token = process.env.META_CAPI_TOKEN?.trim();

  if (!pixelId || !token) {
    return;
  }

  const userData: Record<string, string> = {};

  if (input.clientIp) {
    userData.client_ip_address = input.clientIp;
  }

  if (input.userAgent) {
    userData.client_user_agent = input.userAgent;
  }

  if (input.fbc) {
    userData.fbc = input.fbc;
  }

  if (input.fbp) {
    userData.fbp = input.fbp;
  }

  if (Object.keys(userData).length === 0) {
    return;
  }

  const testCode = process.env.META_TEST_EVENT_CODE?.trim();
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.sourceUrl,
        user_data: userData,
      },
    ],
  };

  if (testCode) {
    body.test_event_code = testCode;
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    console.error("[meta]", input.eventName, response.status);
  }
}

