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
  salesOrder?: SalesOrderSummary | null;
  updatedAt?: string | null;
};

export type SalesOrderSummary = {
  id?: string | null;
  salesOrderId?: string | null;
  salesOrderNumber?: string | null;
  subject?: string | null;
  status?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  appOrderStatus?: string | null;
  stripeCheckoutSessionId?: string | null;
  createdAt?: string | null;
  items?: Array<{
    productId?: string | null;
    productName?: string | null;
    productCode?: string | null;
    vendorName?: string | null;
    quantity?: number | null;
    unitPrice?: number | null;
  }>;
};

export type FinalizeCheckoutResponse = {
  tripId?: string;
  checkoutSessionId?: string | null;
  paymentStatus?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  customerEmail?: string | null;
  stripeEventId?: string | null;
  salesOrder?: SalesOrderSummary | null;
  finalizedAt?: string | null;
};

export type SalesOrderDryRunResponse = {
  dryRun?: boolean;
  createsZohoRecord?: boolean;
  layout?: {
    id?: string | null;
    name?: string | null;
  };
  parentTrip?: {
    id?: string | null;
    subject?: string | null;
    dealId?: string | null;
    dealName?: string | null;
    accountId?: string | null;
    accountName?: string | null;
  };
  recordData?: Record<string, unknown>;
  summary?: SalesOrderSummary | null;
};

export type Trip = {
  id: string;
  tripName?: string | null;
  dealName: string | null;
  destinationName?: string | null;
  destinationCountry?: string | null;
  subject: string | null;
  status: string | null;
  totalAmount: number | null;
  documentsAcknowledged?: boolean;
  arrivalDate?: string | null;
  departureDate?: string | null;
  coverId?: string | null;
  flights?: Array<{
    id: string | null;
    name: string | null;
  }>;
};

export type ProductOrder = {
  id: string;
  subject: string | null;
  salesOrderNumber: string | null;
  destinationName?: string | null;
  total: number | null;
  status?: string | null;
  currency?: string | null;
  paymentDate?: string | null;
  createdAt?: string | null;
  items?: Array<{
    id?: string | null;
    name: string | null;
    description?: string | null;
    quantity?: number | null;
    unitPrice?: number | null;
    total?: number | null;
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
  tripId: string;
  trackingNumber: string;
  airlineCompany?: string | null;
  airportDestination?: string | null;
  arrival?: string | null;
  departure?: string | null;
  departureAirport?: string | null;
  status?: string | null;
  connectionsInformation?: FlightConnectionInput[];
};

export type HotelRecord = {
  id?: string | null;
  bookingCode?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  checkinInformation?: string | null;
  email?: string | null;
  secondaryEmail?: string | null;
  extraNight?: number | null;
  features?: string[];
  hotelName?: {
    id?: string | null;
    name?: string | null;
    photos?: Array<{
      id?: string | null;
      fileId?: string | null;
      previewId?: string | null;
      fileName?: string | null;
      downloadKey?: string | null;
    }>;
    address?: string | null;
  } | null;
  hotelAddress?: string | null;
  hotelPhotos?: Array<{
    id?: string | null;
    fileId?: string | null;
    previewId?: string | null;
    fileName?: string | null;
    downloadKey?: string | null;
  }>;
  parentTrip?: {
    id?: string | null;
    name?: string | null;
  } | null;
  payment?: string | null;
  roomType?: string | null;
  singleRoomExtra?: number | null;
  tag?: string | null;
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

export async function appleReviewLogin(email: string, password: string) {
  const response = await fetch(`${getApiBase()}/auth/apple-review/login`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  return parseResponse(response);
}

export async function logoutSession(sessionToken: string) {
  const response = await fetch(withSessionToken(`${getApiBase()}/auth/logout`, sessionToken), {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
      "X-Session-Token": sessionToken,
    },
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

export async function getOrders(sessionToken: string): Promise<ApiResponse<ProductOrder[]>> {
  const response = await fetch(withSessionToken(`${getApiBase()}/crm/orders`, sessionToken), {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "X-Session-Token": sessionToken,
    },
  });

  return parseResponse<ProductOrder[]>(response);
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

export async function getHotels(sessionToken: string, tripId: string): Promise<ApiResponse<HotelRecord[]>> {
  const response = await fetch(
    withSessionToken(`${getApiBase()}/crm/hotels?tripId=${encodeURIComponent(tripId)}`, sessionToken),
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "X-Session-Token": sessionToken,
      },
    }
  );

  return parseResponse<HotelRecord[]>(response);
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

export async function cancelCheckout(sessionToken: string, tripId: string) {
  const response = await fetch(
    withSessionToken(`${getApiBase()}/crm/checkout/cancel`, sessionToken),
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

export async function dryRunSalesOrder(sessionToken: string, tripId: string) {
  const response = await fetch(
    withSessionToken(`${getApiBase()}/crm/checkout/sales-order/dry-run`, sessionToken),
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

  return parseResponse<SalesOrderDryRunResponse>(response);
}
