const API_BASE = "http://localhost:3001/server/Zoho_api";

export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
  sessionToken?: string;
};

export type Trip = {
  id: string;
  dealName: string | null;
  subject: string | null;
  status: string | null;
  totalAmount: number | null;
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
  const response = await fetch(`${API_BASE}/auth/otp/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  return parseResponse(response);
}

export async function verifyOtp(email: string, otp: string) {
  const response = await fetch(`${API_BASE}/auth/otp/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, otp }),
  });

  return parseResponse(response);
}

export async function getTraveler(sessionToken: string) {
  const response = await fetch(`${API_BASE}/crm/travelers`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  return parseResponse(response);
}

export async function getTrips(sessionToken: string): Promise<ApiResponse<Trip[]>> {
  const response = await fetch(`${API_BASE}/crm/trips`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  return parseResponse<Trip[]>(response);
}

export async function getTripDetails(sessionToken: string, tripId: string) {
  const response = await fetch(`${API_BASE}/crm/trips/${tripId}`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  return parseResponse(response);
}

export async function getTripRequirements(sessionToken: string, tripId: string) {
  const response = await fetch(`${API_BASE}/crm/trips/${tripId}/requirements`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  return parseResponse(response);
}

export async function acknowledgeRequirements(
  sessionToken: string,
  tripId: string,
  version = "v1"
) {
  const response = await fetch(
    `${API_BASE}/crm/trips/${tripId}/requirements/acknowledge`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ version }),
    }
  );

  return parseResponse(response);
}