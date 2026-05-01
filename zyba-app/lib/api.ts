export function getApiBase() {
  // Single strategy for stability: frontend always hits same-origin /api.
  // Vercel rewrites /api/* -> API_PROXY_TARGET backend.
  return "/api";
}

function withSessionToken(url: string, sessionToken: string) {
  const token = String(sessionToken || "").trim();
  if (!token) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}sessionToken=${encodeURIComponent(token)}`;
}

export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
  sessionToken?: string;
};

export type CheckoutSessionResponse = {
  id?: string | null;
  url?: string | null;
};

export type CheckoutStatusResponse = {
  tripId?: string;
  status?: string | null;
  checkoutSessionId?: string | null;
  paymentStatus?: string | null;
  stripeEventId?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  customerEmail?: string | null;
  updatedAt?: string | null;
};

export type FinalizeCheckoutResponse = {
  tripId?: string;
  checkoutSessionId?: string | null;
  paymentStatus?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  customerEmail?: string | null;
  stripeEventId?: string | null;
  finalizedAt?: string | null;
};

export type Trip = {
  id: string;
  dealName: string | null;
  subject: string | null;
  status: string | null;
  totalAmount: number | null;
  documentsAcknowledged?: boolean;
  arrivalDate?: string | null;
  coverId?: string | null;
  flights?: Array<{
    id: string | null;
    name: string | null;
  }>;
};

export type FlightConnectionInput = {
  connectionAirport?: string | null;
  countryCity?: string | null;
  date?: string | null;
  duration?: number | null;
  time?: string | null;
};

export type FlightInput = {
  trackingNumber: string;
  airlineCompany?: string | null;
  airportDestination?: string | null;
  arrival?: string | null;
  departure?: string | null;
  departureAirport?: string | null;
  status?: string | null;
  connectionsInformation?: FlightConnectionInput[];
};

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: text || "Invalid JSON response",
    };
  }
}

export async function requestOtp(email: string) {
  const response = await fetch(`${getApiBase()}/auth/otp/request`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  return parseResponse(response);
}

export async function verifyOtp(email: string, otp: string) {
  const response = await fetch(`${getApiBase()}/auth/otp/verify`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, otp }),
  });

  return parseResponse(response);
}

export async function getTraveler(sessionToken: string) {
  const response = await fetch(withSessionToken(`${getApiBase()}/crm/travelers`, sessionToken), {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "X-Session-Token": sessionToken,
    },
  });

  return parseResponse(response);
}

export async function getTrips(sessionToken: string): Promise<ApiResponse<Trip[]>> {
  const response = await fetch(withSessionToken(`${getApiBase()}/crm/trips`, sessionToken), {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "X-Session-Token": sessionToken,
    },
  });

  return parseResponse<Trip[]>(response);
}

export async function getTripDetails(sessionToken: string, tripId: string) {
  const response = await fetch(
    withSessionToken(`${getApiBase()}/crm/trips/${tripId}`, sessionToken),
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "X-Session-Token": sessionToken,
      },
    }
  );

  return parseResponse(response);
}

export async function getTripRequirements(sessionToken: string, tripId: string) {
  const response = await fetch(
    withSessionToken(`${getApiBase()}/crm/trips/${tripId}/requirements`, sessionToken),
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "X-Session-Token": sessionToken,
      },
    }
  );

  return parseResponse(response);
}

export async function acknowledgeRequirements(
  sessionToken: string,
  tripId: string,
  version = "v1"
) {
  const response = await fetch(
    withSessionToken(
      `${getApiBase()}/crm/trips/${tripId}/requirements/acknowledge`,
      sessionToken
    ),
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
        "X-Session-Token": sessionToken,
      },
      body: JSON.stringify({ version }),
    }
  );

  return parseResponse(response);
}

export async function createFlight(sessionToken: string, payload: FlightInput) {
  const response = await fetch(withSessionToken(`${getApiBase()}/crm/flights`, sessionToken), {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
      "X-Session-Token": sessionToken,
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function createCheckoutSession(sessionToken: string, tripId: string) {
  const response = await fetch(
    withSessionToken(`${getApiBase()}/crm/checkout/session`, sessionToken),
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
        "X-Session-Token": sessionToken,
      },
      body: JSON.stringify({ tripId }),
    }
  );

  return parseResponse<CheckoutSessionResponse>(response);
}

export async function getCheckoutStatus(sessionToken: string, tripId: string) {
  const response = await fetch(
    withSessionToken(`${getApiBase()}/crm/checkout/status?tripId=${encodeURIComponent(tripId)}`, sessionToken),
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "X-Session-Token": sessionToken,
      },
    }
  );

  return parseResponse<CheckoutStatusResponse>(response);
}

export async function finalizeCheckout(sessionToken: string, tripId: string, sessionId?: string) {
  const response = await fetch(
    withSessionToken(`${getApiBase()}/crm/checkout/finalize`, sessionToken),
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
        "X-Session-Token": sessionToken,
      },
      body: JSON.stringify({ tripId, sessionId: sessionId || null }),
    }
  );

  return parseResponse<FinalizeCheckoutResponse>(response);
}
