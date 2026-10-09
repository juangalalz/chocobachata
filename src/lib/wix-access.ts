import "server-only";

type WixResult<T> = { ok: true; data: T } | { ok: false; status: number; body: string };

function wixHeaders(): HeadersInit {
  return {
    Authorization: process.env.WIX_API_KEY?.trim() ?? "",
    "Content-Type": "application/json",
    "wix-site-id": process.env.WIX_SITE_ID?.trim() ?? "",
  };
}

async function wix<T>(url: string, body: unknown): Promise<WixResult<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers: wixHeaders(),
    body: JSON.stringify(body),
  });
  const text = await response.text();

  if (!response.ok) {
    return { ok: false, status: response.status, body: text.slice(0, 500) };
  }

  return { ok: true, data: JSON.parse(text) as T };
}

export async function findOrCreateMember(
  email: string,
  fullName?: string,
): Promise<string> {
  const [firstName, ...rest] = (fullName ?? "").trim().split(/\s+/);
  const created = await wix<{ member: { id: string } }>(
    "https://www.wixapis.com/members/v1/members",
    {
      member: {
        loginEmail: email,
        ...(firstName
          ? { contact: { firstName, lastName: rest.join(" ") || undefined } }
          : {}),
      },
    },
  );

  if (created.ok) {
    await approveMember(created.data.member.id);
    return created.data.member.id;
  }

  if (created.status !== 409 && !created.body.toLowerCase().includes("already")) {
    throw new Error(`Wix no creó el alumno (${created.status})`);
  }

  const found = await wix<{ members: { id: string }[] }>(
    "https://www.wixapis.com/members/v1/members/query",
    {
      query: {
        filter: { loginEmail: { $eq: email } },
        paging: { limit: 1 },
      },
    },
  );

  const memberId = found.ok ? found.data.members?.[0]?.id : undefined;
  if (!memberId) {
    throw new Error("Wix ya tenía el correo, pero no pude leer el alumno");
  }

  await approveMember(memberId);
  return memberId;
}

const WELCOME_LABEL_KEY = "custom.acceso-bachata-RxzyT";

export async function sendWelcomeEmail(memberId: string): Promise<void> {
  const labeled = await wix(
    `https://www.wixapis.com/contacts/v4/contacts/${memberId}/labels`,
    { labelKeys: [WELCOME_LABEL_KEY] },
  );

  if (!labeled.ok) {
    throw new Error(`Wix no envió el correo de bienvenida (${labeled.status})`);
  }
}

export async function sendAccessEmail(email: string): Promise<void> {
  const sent = await wix<{ accepted?: boolean }>(
    "https://www.wixapis.com/members/v1/auth/members/send-set-password-email",
    { email, hideIgnoreMessage: false },
  );

  if (!sent.ok) {
    throw new Error(`Wix no envió el correo de acceso (${sent.status})`);
  }
}

async function approveMember(memberId: string): Promise<void> {
  const approved = await wix<{ member?: { status?: string } }>(
    `https://www.wixapis.com/members/v1/members/${memberId}/approve`,
    {},
  );

  if (approved.ok) {
    return;
  }

  const body = approved.body.toLowerCase();
  if (body.includes("already") || body.includes("approved")) {
    return;
  }

  throw new Error(`Wix no aprobó el alumno (${approved.status})`);
}

export async function enrollInPrograms(memberId: string): Promise<void> {
  const programIds = (process.env.WIX_PROGRAM_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  for (const programId of programIds) {
    const enrolled = await wix(
      "https://www.wixapis.com/online-programs/v3/participants",
      {
        participant: {
          memberId,
          programId,
          enrollmentInfo: { pricingType: "ADDED_MANUALLY" },
        },
      },
    );

    if (
      !enrolled.ok &&
      enrolled.status !== 409 &&
      !enrolled.body.toLowerCase().includes("already")
    ) {
      throw new Error(`Wix no inscribió el nivel ${programId} (${enrolled.status})`);
    }
  }
}
