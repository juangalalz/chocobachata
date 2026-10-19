import "server-only";

type WixResult<T> = { ok: true; data: T } | { ok: false; status: number; body: string };

function wixHeaders(): HeadersInit {
  return {
    Authorization: process.env.WIX_API_KEY?.trim() ?? "",
    "Content-Type": "application/json",
    "wix-site-id": process.env.WIX_SITE_ID?.trim() ?? "",
  };
}

async function wix<T>(
  url: string,
  body?: unknown,
  method: "POST" | "DELETE" = "POST",
): Promise<WixResult<T>> {
  const response = await fetch(url, {
    method,
    headers: wixHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();

  if (!response.ok) {
    return { ok: false, status: response.status, body: text.slice(0, 500) };
  }

  return { ok: true, data: (text ? JSON.parse(text) : {}) as T };
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

  const memberId = await findMemberId(email);
  if (!memberId) {
    throw new Error("Wix ya tenía el correo, pero no pude leer el alumno");
  }

  await approveMember(memberId);
  return memberId;
}

export async function findMemberId(email: string): Promise<string | undefined> {
  const found = await wix<{ members: { id: string }[] }>(
    "https://www.wixapis.com/members/v1/members/query",
    {
      query: {
        filter: { loginEmail: { $eq: email } },
        paging: { limit: 1 },
      },
    },
  );

  return found.ok ? found.data.members?.[0]?.id : undefined;
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

function programIds(): string[] {
  return (process.env.WIX_PROGRAM_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

// "Mis programas" de Wix pone arriba el último programa al que se unió el alumno.
// Inscribimos del último nivel al primero, con un segundo entre cada uno, para que
// el Nivel 1 quede el primero de la lista y el alumno empiece desde cero.
// (En las pruebas se pone a 0 con WIX_ENROLL_GAP_MS.)
function enrollGapMs(): number {
  return Number(process.env.WIX_ENROLL_GAP_MS ?? 1000);
}

export async function enrollInPrograms(memberId: string): Promise<void> {
  const ids = programIds().reverse();
  for (const [index, programId] of ids.entries()) {
    if (index > 0) {
      await new Promise((done) => setTimeout(done, enrollGapMs()));
    }

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

type Participant = {
  id: string;
  programId: string;
  enrollmentStatus?: string;
  progressStatus?: string;
  enrollmentInfo?: { pricingType?: string };
};

export type MemberActivity = {
  lastLogin: string | null;
  // Pasa a true cuando el alumno abre el enlace del correo para crear la contraseña.
  emailVerified: boolean;
  // Si empezó (o terminó) alguno de los tres niveles.
  started: boolean;
};

// Lo que hizo el alumno en Wix desde que lo inscribimos. undefined si Wix no respondió
// (para no avisar de más por un fallo de Wix).
export async function memberActivity(memberId: string): Promise<MemberActivity | undefined> {
  const response = await fetch(
    `https://www.wixapis.com/contacts/v4/contacts/${memberId}?fieldsets=FULL`,
    { headers: wixHeaders() },
  );
  const found = await wix<{ participants?: Participant[] }>(
    "https://www.wixapis.com/online-programs/v3/participants/query",
    { query: { filter: { memberId: { $eq: memberId } }, cursorPaging: { limit: 100 } } },
  );
  if (!response.ok || !found.ok) {
    return undefined;
  }

  const data = (await response.json()) as {
    contact?: { memberInfo?: { emailVerified?: boolean; sessionInfo?: { lastWebLogin?: string } } };
  };
  const ids = new Set(programIds());
  return {
    lastLogin: data.contact?.memberInfo?.sessionInfo?.lastWebLogin ?? null,
    emailVerified: data.contact?.memberInfo?.emailVerified === true,
    started: (found.data.participants ?? []).some(
      (participant) =>
        ids.has(participant.programId) &&
        participant.progressStatus != null &&
        participant.progressStatus !== "NOT_STARTED",
    ),
  };
}

// Quita los tres niveles que inscribió la web. Las inscripciones que el alumno
// haya pagado directamente en Wix no se tocan.
export async function removeFromPrograms(memberId: string): Promise<number> {
  const ids = new Set(programIds());
  const found = await wix<{ participants?: Participant[] }>(
    "https://www.wixapis.com/online-programs/v3/participants/query",
    {
      query: {
        filter: { memberId: { $eq: memberId } },
        cursorPaging: { limit: 100 },
      },
    },
  );

  if (!found.ok) {
    throw new Error(`Wix no devolvió las inscripciones (${found.status})`);
  }

  const toRemove = (found.data.participants ?? []).filter(
    (participant) =>
      ids.has(participant.programId) &&
      participant.enrollmentStatus === "JOINED" &&
      participant.enrollmentInfo?.pricingType === "ADDED_MANUALLY",
  );

  for (const participant of toRemove) {
    const removed = await wix(
      `https://www.wixapis.com/online-programs/v3/participants/${participant.id}`,
      undefined,
      "DELETE",
    );

    if (!removed.ok && removed.status !== 404) {
      throw new Error(
        `Wix no quitó el nivel ${participant.programId} (${removed.status})`,
      );
    }
  }

  return toRemove.length;
}
