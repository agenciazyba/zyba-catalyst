"use strict";

const https = require("https");
const { URL } = require("url");
const { normalizeEmail } = require("../utils/helpers");

/*
|--------------------------------------------------------------------------
| Token cache
|--------------------------------------------------------------------------
*/
let cachedToken = null;
let tokenExpiry = null;
let tokenPromise = null;

/*
|--------------------------------------------------------------------------
| Data cache
|--------------------------------------------------------------------------
*/
const DATA_CACHE_TTL_MS = 5 * 60 * 1000;
const dataCache = new Map();

function getDataCache(key) {
  const cached = dataCache.get(key);

  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    dataCache.delete(key);
    return null;
  }

  return cached.data;
}

function setDataCache(key, data, ttlMs = DATA_CACHE_TTL_MS) {
  const now = Date.now();

  // Garbage-collect expired entries on every insert
  for (const [k, v] of dataCache.entries()) {
    if (now > v.expiresAt) {
      dataCache.delete(k);
    }
  }

  dataCache.set(key, {
    data,
    expiresAt: now + ttlMs,
  });
}

function clearDataCacheByPrefix(prefix) {
  for (const key of dataCache.keys()) {
    if (key.startsWith(prefix)) {
      dataCache.delete(key);
    }
  }
}

/*
|--------------------------------------------------------------------------
| HTTP helper
|--------------------------------------------------------------------------
*/
function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: body ? JSON.parse(body) : {},
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            data: body,
          });
        }
      });
    });

    req.on("error", reject);

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

/*
|--------------------------------------------------------------------------
| Utility helpers
|--------------------------------------------------------------------------
*/
function escapeCoql(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function mapLookup(value) {
  if (!value) return null;

  if (typeof value === "object") {
    return {
      id: value.id || null,
      name: value.name || value.display_value || null,
    };
  }

  return {
    id: null,
    name: String(value),
  };
}

function includesMultiSelect(value, target) {
  if (!value || !target) return false;

  if (Array.isArray(value)) {
    return value.includes(target);
  }

  const normalized = String(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.includes(target);
}

/*
|--------------------------------------------------------------------------
| Zoho OAuth token (with concurrency lock)
|--------------------------------------------------------------------------
*/
async function getZohoAccessToken() {
  const now = Date.now();

  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken;
  }

  // If another caller is already refreshing, wait for that same promise
  if (tokenPromise) {
    return tokenPromise;
  }

  tokenPromise = (async () => {
    try {
      const postData =
        "grant_type=refresh_token" +
        "&client_id=" + encodeURIComponent(process.env.ZOHO_CLIENT_ID) +
        "&client_secret=" + encodeURIComponent(process.env.ZOHO_CLIENT_SECRET) +
        "&refresh_token=" + encodeURIComponent(process.env.ZOHO_REFRESH_TOKEN);

      const url = new URL("/oauth/v2/token", process.env.ZOHO_ACCOUNTS_URL);

      const response = await httpsRequest(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(postData),
          },
        },
        postData
      );

      if (response.data && response.data.access_token) {
        cachedToken = response.data;
        tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
        return cachedToken;
      }

      throw new Error(
        typeof response.data === "string"
          ? response.data
          : response.data.error ||
              response.data.message ||
              "Failed to generate Zoho token"
      );
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

/*
|--------------------------------------------------------------------------
| Zoho CRM generic operations
|--------------------------------------------------------------------------
*/
async function runCoqlQuery(selectQuery) {
  const token = await getZohoAccessToken();
  const body = JSON.stringify({ select_query: selectQuery });
  const url = new URL("/crm/v8/coql", process.env.ZOHO_API_DOMAIN);

  const response = await httpsRequest(
    {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${token.access_token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body
  );

  if (response.statusCode >= 400) {
    throw new Error(
      typeof response.data === "string"
        ? response.data
        : response.data.message || "Failed to execute COQL query"
    );
  }

  return response.data;
}

async function zohoGetRecord(moduleApiName, recordId) {
  const token = await getZohoAccessToken();
  const url = new URL(
    `/crm/v8/${moduleApiName}/${recordId}`,
    process.env.ZOHO_API_DOMAIN
  );

  const response = await httpsRequest({
    hostname: url.hostname,
    path: url.pathname,
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${token.access_token}`,
      Accept: "application/json",
    },
  });

  if (response.statusCode >= 400) {
    throw new Error(
      typeof response.data === "string"
        ? response.data
        : response.data.message || `Failed to fetch record from ${moduleApiName}`
    );
  }

  return response.data?.data?.[0] || null;
}

async function zohoListRecords(moduleApiName, fields = [], page = 1, perPage = 200) {
  const token = await getZohoAccessToken();

  const url = new URL(`/crm/v8/${moduleApiName}`, process.env.ZOHO_API_DOMAIN);

  if (fields.length > 0) {
    url.searchParams.set("fields", fields.join(","));
  }

  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  const response = await httpsRequest({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${token.access_token}`,
      Accept: "application/json",
    },
  });

  if (response.statusCode >= 400) {
    throw new Error(
      typeof response.data === "string"
        ? response.data
        : response.data.message || `Failed to list records from ${moduleApiName}`
    );
  }

  return response.data?.data || [];
}

async function zohoUpdateRecord(moduleApiName, recordId, recordData) {
  const token = await getZohoAccessToken();
  const body = JSON.stringify({
    data: [recordData],
  });

  const url = new URL(
    `/crm/v8/${moduleApiName}/${recordId}`,
    process.env.ZOHO_API_DOMAIN
  );

  const response = await httpsRequest(
    {
      hostname: url.hostname,
      path: url.pathname,
      method: "PUT",
      headers: {
        Authorization: `Zoho-oauthtoken ${token.access_token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body
  );

  if (response.statusCode >= 400) {
    throw new Error(
      typeof response.data === "string"
        ? response.data
        : response.data.message || `Failed to update record in ${moduleApiName}`
    );
  }

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Business logic
|--------------------------------------------------------------------------
*/
async function getTravelerByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const cacheKey = `traveler:${normalizedEmail}`;

  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const query = `
    select id, Account_Name, Email, Gender, Passport, Passport_Expiration, Record_Image
    from Accounts
    where (Email = '${escapeCoql(normalizedEmail)}')
    limit 0, 1
  `;

  const response = await runCoqlQuery(query);
  const item = response.data?.[0];

  if (!item) return null;

  const accountRecord = await zohoGetRecord("Accounts", item.id);

  const result = {
    id: item.id || null,
    travelerName: item.Account_Name || null,
    email: item.Email || null,
    gender: item.Gender || null,
    passport: item.Passport || null,
    passportExpiration: item.Passport_Expiration || null,
    recordImage: item.Record_Image || null,
    country: accountRecord?.Country || null,
  };

  setDataCache(cacheKey, result);
  return result;
}

async function getTripsByLoggedUser(email) {
  const normalizedEmail = normalizeEmail(email);
  const cacheKey = `trips:${normalizedEmail}`;

  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const query = `
    select id, Deal_Name, Subject, Status, Grand_Total
    from Sales_Orders
    where ((Status = 'Aproval') and (Account_Name.Email = '${escapeCoql(normalizedEmail)}'))
    limit 0, 200
  `;

  const response = await runCoqlQuery(query);

  const result = (response.data || []).map((item) => ({
    id: item.id || null,
    dealName: item.Deal_Name?.name || null,
    subject: item.Subject || null,
    status: item.Status || null,
    totalAmount: item.Grand_Total ?? null,
  }));

  setDataCache(cacheKey, result);
  return result;
}

async function getTripDetailsById(tripId, email) {
  const normalizedEmail = normalizeEmail(email);
  const cacheKey = `trip-details:${tripId}:${normalizedEmail}`;

  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const tripQuery = `
    select id, Deal_Name, Subject, Status, Grand_Total
    from Sales_Orders
    where ((id = '${escapeCoql(tripId)}') and (Account_Name.Email = '${escapeCoql(normalizedEmail)}'))
    limit 0, 1
  `;

  const tripResponse = await runCoqlQuery(tripQuery);
  const trip = tripResponse.data?.[0];

  if (!trip) {
    return null;
  }

  const tripRecord = await zohoGetRecord("Sales_Orders", tripId);

  const dealLookup = trip.Deal_Name || null;
  const dealId = dealLookup?.id || null;

  let deal = null;

  if (dealId) {
    const dealRecord = await zohoGetRecord("Deals", dealId);

    if (dealRecord) {
      deal = {
        id: dealRecord.id || null,
        dealName: dealRecord.Deal_Name || null,
        airport: dealRecord.Airport || null,
        arrivalDate: dealRecord.Arrival_Date || null,
        departureDate: dealRecord.Departure_Date || null,
        country: dealRecord.Country || null,
        dealCover: Array.isArray(dealRecord.Deal_Cover)
          ? dealRecord.Deal_Cover.map((file) => ({
              id: file.File_Id__s || null,
              previewId: file.Preview_Id__s || null,
              fileName: file.File_Name__s || null,
            }))
          : [],
        destination: mapLookup(dealRecord.Destination),
        destinationCountry: dealRecord.Destination_Country || null,
        fishingDays: dealRecord.Fishing_Days ?? null,
        included: dealRecord.Included || null,
        notIncluded: dealRecord.Not_Included || null,
        itinerary: Array.isArray(dealRecord.Itinerary)
          ? dealRecord.Itinerary
              .map((row) => ({
                id: row.id || null,
                day: row.Day || null,
                dayTitle: row.Day_Title || null,
                dayDescription: row.Day_Description || null,
                dayType: row.Day_Type || null,
              }))
              .sort((a, b) => new Date(a.day) - new Date(b.day))
          : [],
      };
    }
  }

  const result = {
    trip: {
      id: trip.id || null,
      subject: trip.Subject || null,
      status: trip.Status || null,
      totalAmount: trip.Grand_Total ?? null,
      hotelName: tripRecord?.Hotel_Name || null,
      hotelInformation: tripRecord?.Hotel_Information || null,
      hotelConfirmationCode: tripRecord?.Hotel_Confirmation_Code || null,
      hotelAddress: tripRecord?.Hotel_Address || null,
      checkIn: tripRecord?.Check_In || null,
      checkOut: tripRecord?.Check_Out || null,
      driverName: tripRecord?.Driver_Name || null,
      driverPhone: tripRecord?.Driver_Phone || null,
      driverInformation: tripRecord?.Driver_Information || null,
      licensePlate: tripRecord?.License_Plate || null,
      carPhoto: Array.isArray(tripRecord?.Car_Photo)
        ? tripRecord.Car_Photo.map((file) => ({
            id: file.File_Id__s || null,
            previewId: file.Preview_Id__s || null,
            fileName: file.File_Name__s || null,
          }))
        : [],
      documentsAcknowledged: tripRecord?.Documents_Acknowledged === true,
      documentsAcknowledgedAt: tripRecord?.Documents_Acknowledged_At || null,
      documentsRequirementsVersion:
        tripRecord?.Documents_Requirements_Version || null,
      deal: {
        id: dealLookup?.id || null,
        name: dealLookup?.name || null,
      },
    },
    deal,
  };

  setDataCache(cacheKey, result);
  return result;
}

async function getTripRequirementsById(tripId, email) {
  const normalizedEmail = normalizeEmail(email);
  const cacheKey = `trip-requirements:${tripId}:${normalizedEmail}`;

  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const tripDetails = await getTripDetailsById(tripId, email);

  if (!tripDetails) {
    return null;
  }

  const traveler = await getTravelerByEmail(email);

  if (!traveler) {
    return {
      trip: tripDetails.trip,
      deal: tripDetails.deal,
      traveler: null,
      requirements: [],
    };
  }

  const destinationVendorId = tripDetails.deal?.destination?.id || null;

  let destinationCountry = null;

  if (destinationVendorId) {
    const vendorRecord = await zohoGetRecord("Vendors", destinationVendorId);
    destinationCountry = vendorRecord?.Destination_Country || null;
  }

  const originCountry = traveler.country || null;

  const records = await zohoListRecords(
    "Travel_Requirements",
    [
      "Name",
      "Origin_Country",
      "Is_Mandatory",
      "Is_Active",
      "Help_Link",
      "Destination_Country",
      "Description"
    ],
    1,
    200
  );

  const normalizedOrigin = String(originCountry || "").trim().toLowerCase();
  const normalizedDestination = String(destinationCountry || "").trim().toLowerCase();

  const requirements = (records || [])
    .filter((item) => {
      const isActive = item.Is_Active === true;

      const itemDestination = String(item.Destination_Country || "")
        .trim()
        .toLowerCase();

      const destinationMatches =
        normalizedDestination && itemDestination === normalizedDestination;

      const originMatches =
        includesMultiSelect(item.Origin_Country, originCountry) ||
        includesMultiSelect(item.Origin_Country, "ALL") ||
        includesMultiSelect(item.Origin_Country, normalizedOrigin) ||
        includesMultiSelect(item.Origin_Country, "all");

      return isActive && destinationMatches && originMatches;
    })
    .map((item) => ({
      id: item.id || null,
      name: item.Name || null,
      originCountry: item.Origin_Country || null,
      destinationCountry: item.Destination_Country || null,
      type: null,
      description: item.Description || null,
      helpLink: item.Help_Link || null,
      isMandatory: item.Is_Mandatory === true,
      isActive: item.Is_Active === true,
    }));

  const result = {
    trip: tripDetails.trip,
    deal: {
      ...tripDetails.deal,
      destinationCountry,
    },
    traveler: {
      id: traveler.id || null,
      email: traveler.email || null,
      travelerName: traveler.travelerName || null,
      originCountry,
    },
    requirements,
  };

  setDataCache(cacheKey, result);
  return result;
}

async function acknowledgeTripRequirements(tripId, email, version = null) {
  const tripDetails = await getTripDetailsById(tripId, email);

  if (!tripDetails) {
    return null;
  }

  const nowIso = new Date().toISOString();

  await zohoUpdateRecord("Sales_Orders", tripId, {
    Documents_Acknowledged: true,
    Documents_Acknowledged_At: nowIso,
    Documents_Requirements_Version: version || null,
  });

  // Invalidate all related caches so fresh data is returned
  clearDataCacheByPrefix(`trip-details:${tripId}:`);
  clearDataCacheByPrefix(`trip-requirements:${tripId}:`);
  clearDataCacheByPrefix("trips:");

  return await getTripDetailsById(tripId, email);
}

module.exports = {
  getZohoAccessToken,
  getTravelerByEmail,
  getTripsByLoggedUser,
  getTripDetailsById,
  getTripRequirementsById,
  acknowledgeTripRequirements,
};