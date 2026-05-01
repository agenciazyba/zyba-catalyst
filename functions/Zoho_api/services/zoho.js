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
const configuredDataCacheTtl = Number(process.env.DATA_CACHE_TTL_MS);
const DATA_CACHE_TTL_MS =
  Number.isFinite(configuredDataCacheTtl) && configuredDataCacheTtl > 0
    ? configuredDataCacheTtl
    : 5 * 60 * 1000;

const TTL_TRAVELER_MS = Number(process.env.DATA_CACHE_TTL_TRAVELER_MS || 5 * 60 * 1000);
const TTL_TRIPS_MS = Number(process.env.DATA_CACHE_TTL_TRIPS_MS || 3 * 60 * 1000);
const TTL_TRIP_DETAILS_MS = Number(process.env.DATA_CACHE_TTL_TRIP_DETAILS_MS || 2 * 60 * 1000);
const TTL_DEALS_MS = Number(process.env.DATA_CACHE_TTL_DEALS_MS || 5 * 60 * 1000);
const TTL_PRODUCTS_MS = Number(process.env.DATA_CACHE_TTL_PRODUCTS_MS || 2 * 60 * 1000);
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

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
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

function mapLookupList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (item && typeof item === "object" && item.Flights) {
        return mapLookup(item.Flights);
      }
      return mapLookup(item);
    })
    .filter((item) => item && (item.id || item.name));
}

function mapUploadedFiles(moduleApiName, recordId, value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((file) => {
      if (!file || typeof file !== "object") return null;

      const attachmentId = normalizeOptionalString(
        file.id ||
          file.attachment_Id ||
          file.attachment_id ||
          file.File_Id__s ||
          file.file_id ||
          file.Preview_Id__s ||
          file.preview_id
      );

      if (!attachmentId) return null;

      return {
        id: normalizeOptionalString(file.id) || attachmentId,
        fileId: normalizeOptionalString(file.File_Id__s || file.file_id),
        previewId: normalizeOptionalString(file.Preview_Id__s || file.preview_id),
        fileName: normalizeOptionalString(
          file.File_Name__s || file.file_name || file.name || file.Name
        ),
        downloadKey: `${moduleApiName}_${recordId}_${attachmentId}`,
      };
    })
    .filter(Boolean);
}

function mapRecordPhoto(moduleApiName, recordId, value) {
  if (!value) return null;

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    if (text.startsWith("http://") || text.startsWith("https://")) {
      return {
        raw: text,
        downloadKey: null,
      };
    }
  }

  if (!recordId) return null;

  return {
    raw: value,
    downloadKey: `${moduleApiName}_${recordId}_photo`,
  };
}

function mapLayout(value) {
  if (!value) return null;

  if (typeof value === "object") {
    return {
      id: normalizeOptionalString(value.id),
      name: normalizeOptionalString(value.name),
      displayLabel: normalizeOptionalString(value.display_label),
    };
  }

  const text = normalizeOptionalString(value);
  if (!text) return null;

  return {
    id: null,
    name: text,
    displayLabel: text,
  };
}

function mapFlightRecord(record) {
  if (!record) return null;

  return {
    id: record.id || null,
    trackingNumber: record.Name || null,
    airlineCompany: record.Airline_Company || null,
    airportDestination: record.Airport_Destination || null,
    arrival: record.Arrival || null,
    departure: record.Departure || null,
    departureAirport: record.Departure_Airport || null,
    status: record.Status || null,
    connectionsInformation: Array.isArray(record.Connection_Info)
      ? record.Connection_Info.map((row) => ({
          id: row.id || null,
          connectionAirport: row.Connection_Airport || null,
          countryCity: row.Country_City || null,
          date: row.Date || null,
          duration: row.Duration ?? null,
          time: row.Time || null,
        }))
      : [],
  };
}

function includesMultiSelect(value, target) {
  if (!value || !target) return false;

  const compareTarget = String(target).trim().toLowerCase();

  if (Array.isArray(value)) {
    return value.some((v) => String(v).trim().toLowerCase() === compareTarget);
  }

  const normalized = String(value)
    .split(";")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return normalized.includes(compareTarget);
}

function extractAttachmentId(fileValue) {
  if (!fileValue) return null;

  const item = Array.isArray(fileValue) ? fileValue[0] : fileValue;
  if (!item || typeof item !== "object") return null;

  return (
    item.id ||
    item.attachment_Id ||
    item.attachment_id ||
    item.File_Id__s ||
    item.file_id ||
    null
  );
}

function extractFirstHttpUrl(value) {
  if (!value || typeof value !== "object") return null;
  const values = Object.values(value);
  for (const entry of values) {
    if (typeof entry !== "string") continue;
    const text = entry.trim();
    if (!text) continue;
    const match = text.match(/https?:\/\/[^\s]+/i);
    if (match) return match[0];
  }
  return null;
}

function pickFirstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalIsoDate(value) {
  const text = normalizeOptionalString(value);
  if (!text) return null;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeOptionalIsoDateTime(value) {
  const text = normalizeOptionalString(value);
  if (!text) return null;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().replace(/\.\d{3}Z$/, "+00:00");
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
  const recordCacheKey = `record:${moduleApiName}:${recordId}`;
  const cachedRecord = getDataCache(recordCacheKey);
  if (cachedRecord) return cachedRecord;

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

  const record = response.data?.data?.[0] || null;
  if (record) {
    setDataCache(recordCacheKey, record, TTL_DEALS_MS);
  }

  return record;
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

async function getDealsByIds(dealIds) {
  const cleanIds = Array.from(
    new Set(
      (dealIds || [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );

  if (cleanIds.length === 0) return new Map();

  const dealsMap = new Map();
  const chunks = chunkArray(cleanIds, 50);

  for (const idsChunk of chunks) {
    const inClause = idsChunk.map((id) => `'${escapeCoql(id)}'`).join(", ");
    const query = `
      select id, Arrival_Date, Deal_Cover
      from Deals
      where (id in (${inClause}))
      limit 0, 200
    `;

    const response = await runCoqlQuery(query);
    for (const deal of response.data || []) {
      if (deal?.id) {
        dealsMap.set(String(deal.id), deal);
        setDataCache(`record:Deals:${deal.id}`, deal, TTL_DEALS_MS);
      }
    }
  }

  return dealsMap;
}

async function getFlightsByIds(flightIds) {
  const cleanIds = Array.from(
    new Set(
      (flightIds || [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );

  if (cleanIds.length === 0) return new Map();

  const flightsMap = new Map();

  await Promise.all(
    cleanIds.map(async (flightId) => {
      try {
        const record = await zohoGetRecord("Flights", flightId);
        if (record) {
          flightsMap.set(String(flightId), mapFlightRecord(record));
        }
      } catch (e) {}
    })
  );

  return flightsMap;
}

async function streamZohoFile(module, recordId, attachmentId, res) {
  const tokenRecord = await getZohoAccessToken();
  const domain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const { URL } = require("url");

  async function requestFile(fileUrl) {
    const options = {
      method: "GET",
      hostname: fileUrl.hostname,
      port: 443,
      path: fileUrl.pathname + fileUrl.search,
      headers: {
        Authorization: `Zoho-oauthtoken ${tokenRecord.access_token}`,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (zohoRes) => {
        if (zohoRes.statusCode !== 200) {
          let body = "";
          zohoRes.on("data", (d) => (body += d));
          zohoRes.on("end", () => {
            resolve({
              ok: false,
              statusCode: zohoRes.statusCode,
              body,
            });
          });
          return;
        }

        const headers = {};
        ["content-disposition", "content-type", "content-length"].forEach((h) => {
          if (zohoRes.headers[h]) headers[h] = zohoRes.headers[h];
        });

        resolve({
          ok: true,
          headers,
          stream: zohoRes,
        });
      });

      req.on("error", reject);
      req.end();
    });
  }

  const attachmentUrl = new URL(
    `${domain}/crm/v6/${escapeCoql(module)}/${escapeCoql(recordId)}/Attachments/${escapeCoql(attachmentId)}`
  );
  let fileResponse = await requestFile(attachmentUrl);

  if (!fileResponse.ok) {
    const fieldAttachmentUrl = new URL(
      `${domain}/crm/v8/${escapeCoql(module)}/${escapeCoql(recordId)}/actions/download_fields_attachment`
    );
    fieldAttachmentUrl.searchParams.set("fields_attachment_id", String(attachmentId || "").trim());
    fileResponse = await requestFile(fieldAttachmentUrl);
  }

  if (!fileResponse.ok) {
    res.writeHead(fileResponse.statusCode || 500, { "Content-Type": "application/json" });
    res.end(fileResponse.body || JSON.stringify({ error: "Failed to download file" }));
    return false;
  }

  res.writeHead(200, fileResponse.headers || {});
  fileResponse.stream.pipe(res);

  return new Promise((resolve, reject) => {
    fileResponse.stream.on("end", () => resolve(true));
    fileResponse.stream.on("error", reject);
  });
}

async function streamZohoRecordPhoto(module, recordId, res) {
  const tokenRecord = await getZohoAccessToken();
  const domain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const { URL } = require("url");
  const photoUrl = new URL(`${domain}/crm/v8/${escapeCoql(module)}/${escapeCoql(recordId)}/photo`);

  const options = {
    method: "GET",
    hostname: photoUrl.hostname,
    port: 443,
    path: photoUrl.pathname + photoUrl.search,
    headers: {
      Authorization: `Zoho-oauthtoken ${tokenRecord.access_token}`,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (zohoRes) => {
      if (zohoRes.statusCode !== 200) {
        let body = "";
        zohoRes.on("data", (d) => (body += d));
        zohoRes.on("end", () => {
          res.writeHead(zohoRes.statusCode, { "Content-Type": "application/json" });
          res.end(body);
          resolve(false);
        });
        return;
      }

      const headers = {};
      ["content-disposition", "content-type", "content-length"].forEach((h) => {
        if (zohoRes.headers[h]) headers[h] = zohoRes.headers[h];
      });

      res.writeHead(200, headers);
      zohoRes.pipe(res);

      zohoRes.on("end", () => resolve(true));
      zohoRes.on("error", reject);
    });

    req.on("error", reject);
    req.end();
  });
}

async function streamSalesOrderPdf(templateId, salesOrderId, res) {
  const tokenRecord = await getZohoAccessToken();
  const domain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const { URL } = require("url");

  const pdfUrl = new URL(
    `${domain}/crm/v8/settings/inventory_templates/${escapeCoql(templateId)}/actions/print_preview`
  );
  pdfUrl.searchParams.set("record_id", String(salesOrderId || "").trim());
  pdfUrl.searchParams.set("print_type", "pdf");

  const options = {
    method: "GET",
    hostname: pdfUrl.hostname,
    port: 443,
    path: pdfUrl.pathname + pdfUrl.search,
    headers: {
      Authorization: `Zoho-oauthtoken ${tokenRecord.access_token}`,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (zohoRes) => {
      if (zohoRes.statusCode !== 200) {
        let body = "";
        zohoRes.on("data", (d) => (body += d));
        zohoRes.on("end", () => {
          res.writeHead(zohoRes.statusCode, { "Content-Type": "application/json" });
          res.end(body || JSON.stringify({ ok: false, error: "Failed to generate Sales Order PDF" }));
          resolve(false);
        });
        return;
      }

      const headers = {};
      ["content-disposition", "content-type", "content-length"].forEach((h) => {
        if (zohoRes.headers[h]) headers[h] = zohoRes.headers[h];
      });

      if (!headers["content-disposition"]) {
        headers["content-disposition"] = `attachment; filename=\"sales-order-${salesOrderId}.pdf\"`;
      }
      if (!headers["content-type"]) {
        headers["content-type"] = "application/pdf";
      }

      res.writeHead(200, headers);
      zohoRes.pipe(res);

      zohoRes.on("end", () => resolve(true));
      zohoRes.on("error", reject);
    });

    req.on("error", reject);
    req.end();
  });
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
    console.error("ZOHO UPDATE ERROR:", JSON.stringify(response.data, null, 2));
    throw new Error(
      typeof response.data === "string"
        ? response.data
        : response.data.message || `Failed to update record in ${moduleApiName}`
    );
  }

  if (response.data && Array.isArray(response.data.data)) {
    const result = response.data.data[0];
    if (result && result.status === "error") {
      console.error("ZOHO UPDATE ERROR (200):", JSON.stringify(result, null, 2));
      throw new Error(result.message || `Failed to update record in ${moduleApiName}`);
    }
  }

  return response.data;
}

async function zohoCreateRecord(moduleApiName, recordData) {
  const token = await getZohoAccessToken();
  const body = JSON.stringify({
    data: [recordData],
  });

  const url = new URL(`/crm/v8/${moduleApiName}`, process.env.ZOHO_API_DOMAIN);

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
    console.error("ZOHO CREATE ERROR:", JSON.stringify(response.data, null, 2));
    throw new Error(
      typeof response.data === "string"
        ? response.data
        : response.data.message || `Failed to create record in ${moduleApiName}`
    );
  }

  const result = response.data?.data?.[0] || null;

  if (result && result.status === "error") {
    console.error("ZOHO CREATE ERROR (200):", JSON.stringify(result, null, 2));
    throw new Error(result.message || `Failed to create record in ${moduleApiName}`);
  }

  return result;
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

  setDataCache(cacheKey, result, TTL_TRAVELER_MS);
  return result;
}

async function getTripsByLoggedUser(email) {
  const normalizedEmail = normalizeEmail(email);
  const cacheKey = `trips:${normalizedEmail}`;

  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const query = `
    select id, Deal_Name, Subject, Status, Grand_Total, Documents_Acknowledged
    from Sales_Orders
    where ((Status in ('Approved', 'Rescheduled')) and (Account_Name.Email = '${escapeCoql(normalizedEmail)}'))
    limit 0, 200
  `;

  const response = await runCoqlQuery(query);

  const items = response.data || [];
  const dealIds = items
    .map((item) => item?.Deal_Name?.id)
    .filter(Boolean);

  let dealsById = new Map();
  try {
    dealsById = await getDealsByIds(dealIds);
  } catch (error) {
    // fallback mantém a rota funcional mesmo se COQL batch falhar
    const uniqueDealIds = Array.from(new Set(dealIds.map((id) => String(id))));
    await Promise.all(
      uniqueDealIds.map(async (dealId) => {
        try {
          const record = await zohoGetRecord("Deals", dealId);
          if (record) {
            dealsById.set(dealId, record);
          }
        } catch (e) {}
      })
    );
  }

  const tripRecordsById = new Map();
  await Promise.all(
    items.map(async (item) => {
      if (!item?.id) return;
      try {
        const record = await zohoGetRecord("Sales_Orders", item.id);
        if (record) {
          tripRecordsById.set(String(item.id), record);
        }
      } catch (e) {}
    })
  );

  const result = items.map((item) => {
      let arrivalDate = null;
      let coverId = null;
      const tripRecord = tripRecordsById.get(String(item.id));

      if (item.Deal_Name && item.Deal_Name.id) {
        const dealRecord = dealsById.get(String(item.Deal_Name.id));
        if (dealRecord) {
          arrivalDate = dealRecord.Arrival_Date || null;

          if (dealRecord.Deal_Cover) {
            const attId = extractAttachmentId(dealRecord.Deal_Cover);
            if (attId) {
              coverId = `Deals_${item.Deal_Name.id}_${attId}`;
            }
          }
        }
      }

      return {
        id: item.id || null,
        dealName: item.Deal_Name?.name || null,
        subject: item.Subject || null,
        status: item.Status || null,
        totalAmount: item.Grand_Total ?? null,
        documentsAcknowledged: item.Documents_Acknowledged === true,
        arrivalDate,
        coverId,
        flights: mapLookupList(tripRecord?.Flights),
      };
    });

  setDataCache(cacheKey, result, TTL_TRIPS_MS);
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
  const flightLookups = mapLookupList(tripRecord?.Flights || trip?.Flights);
  const flightsById = await getFlightsByIds(flightLookups.map((item) => item.id));

  const dealLookup = trip.Deal_Name || null;
  const dealId = dealLookup?.id || null;

  let deal = null;
  let vendorName = null;
  let destinationCountry = null;

  if (dealId) {
    const dealRecord = await zohoGetRecord("Deals", dealId);

    if (dealRecord) {
      const destinationLookup = mapLookup(dealRecord.Destination);
      vendorName = destinationLookup?.name || null;
      destinationCountry = dealRecord.Destination_Country || null;

      if (destinationLookup?.id && (!vendorName || !destinationCountry)) {
        try {
          const vendorRecord = await zohoGetRecord("Vendors", destinationLookup.id);
          if (vendorRecord) {
            vendorName =
              vendorName ||
              vendorRecord.Vendor_Name ||
              vendorRecord.Name ||
              vendorRecord.Deal_Name ||
              null;
            destinationCountry =
              destinationCountry ||
              vendorRecord.Destination_Country ||
              vendorRecord.Country ||
              null;
          }
        } catch (e) {}
      }

      deal = {
        id: dealRecord.id || null,
        dealName: dealRecord.Deal_Name || null,
        airport: dealRecord.Airport || null,
        arrivalDate: dealRecord.Arrival_Date || null,
        departureDate: dealRecord.Departure_Date || null,
        country: dealRecord.Country || null,
        vendorName,
        dealCover: Array.isArray(dealRecord.Deal_Cover)
          ? dealRecord.Deal_Cover.map((file) => ({
              id: file.File_Id__s || null,
              previewId: file.Preview_Id__s || null,
              fileName: file.File_Name__s || null,
            }))
          : [],
        destination: destinationLookup,
        destinationCountry,
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
                dayLink:
                  row.Day_Link ||
                  row.Link ||
                  row.Help_Link ||
                  row.URL ||
                  row.Url ||
                  extractFirstHttpUrl(row) ||
                  null,
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
      flights: flightLookups.map((item) => {
        const flight = item.id ? flightsById.get(String(item.id)) : null;
        return {
          id: item.id || null,
          name: item.name || flight?.trackingNumber || null,
          trackingNumber: flight?.trackingNumber || item.name || null,
          airlineCompany: flight?.airlineCompany || null,
          airportDestination: flight?.airportDestination || null,
          arrival: flight?.arrival || null,
          departure: flight?.departure || null,
          departureAirport: flight?.departureAirport || null,
          status: flight?.status || null,
          connectionsInformation: flight?.connectionsInformation || [],
        };
      }),
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
            id: file.id || null,
            fileId: file.File_Id__s || null,
            previewId: file.Preview_Id__s || null,
            fileName: file.File_Name__s || null,
          }))
        : [],
      documentsAcknowledged: tripRecord?.Documents_Acknowledged === true,
      documentsAcknowledgedAt: tripRecord?.Documents_Acknowledged_At || null,
      documentsRequirementsVersion:
        tripRecord?.Documents_Requirements_Version || null,
      vendorName,
      destinationCountry,
      deal: {
        id: dealLookup?.id || null,
        name: dealLookup?.name || null,
      },
    },
    deal,
  };

  setDataCache(cacheKey, result, TTL_TRIP_DETAILS_MS);
  return result;
}

async function getTripRequirementsById(tripId, email) {
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

  let destinationCountry = tripDetails.deal?.destinationCountry || null;

  if (destinationVendorId) {
    try {
      const vendorRecord = await zohoGetRecord("Vendors", destinationVendorId);
      if (vendorRecord && vendorRecord.Destination_Country) {
        destinationCountry = vendorRecord.Destination_Country;
      }
    } catch (e) {}
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
      "Description",
      "Created_Time",
      "Modified_Time",
      "Type"
    ],
    1,
    200
  );

  const normalizedOrigin = String(originCountry || "").trim().toLowerCase();
  const normalizedDestination = String(destinationCountry || "").trim().toLowerCase();

  let needToRevoke = false;
  const isAcknowledged = tripDetails.trip.documentsAcknowledged;
  const acknowledgedAt = tripDetails.trip.documentsAcknowledgedAt;
  const acknowledgedTimeMs = acknowledgedAt ? new Date(acknowledgedAt).getTime() : 0;

  const requirements = (records || [])
    .filter((item) => {
      // By default assume active if it's not explicitly false
      const isActive = item.Is_Active !== false && item.Is_Active !== "false";

      const originMatches =
        !item.Origin_Country || // Empty applies to all
        includesMultiSelect(item.Origin_Country, originCountry) ||
        includesMultiSelect(item.Origin_Country, "ALL") ||
        includesMultiSelect(item.Origin_Country, "all") ||
        (normalizedOrigin && includesMultiSelect(item.Origin_Country, normalizedOrigin));

      const destinationMatches =
        !item.Destination_Country || // Empty applies to all
        includesMultiSelect(item.Destination_Country, destinationCountry) ||
        includesMultiSelect(item.Destination_Country, "ALL") ||
        includesMultiSelect(item.Destination_Country, "all") ||
        (normalizedDestination && String(item.Destination_Country || "").trim().toLowerCase() === normalizedDestination);

      const matches = isActive && destinationMatches && originMatches;

      if (matches && isAcknowledged && acknowledgedTimeMs > 0) {
        const createdMs = item.Created_Time ? new Date(item.Created_Time).getTime() : 0;
        const modifiedMs = item.Modified_Time ? new Date(item.Modified_Time).getTime() : 0;
        if (createdMs > acknowledgedTimeMs || modifiedMs > acknowledgedTimeMs) {
          needToRevoke = true;
        }
      }

      return matches;
    })
    .map((item) => ({
      id: item.id || null,
      name: item.Name || null,
      originCountry: item.Origin_Country || null,
      destinationCountry: item.Destination_Country || null,
      type: item.Type || null,
      description: item.Description || null,
      helpLink: item.Help_Link || null,
      isMandatory: item.Is_Mandatory === true,
      isActive: item.Is_Active === true,
    }));

  if (needToRevoke) {
    try {
      await zohoUpdateRecord("Sales_Orders", tripId, {
        Documents_Acknowledged: false
      });
      // Update local object so current response is clean
      tripDetails.trip.documentsAcknowledged = false;
      // Invalidate related caches so frontend loads fresh status
      clearDataCacheByPrefix(`trip-details:${tripId}:`);
      clearDataCacheByPrefix("trips:");
    } catch (e) {
      console.error("Failed to revoke document acknowledgment:", e.message);
    }
  }

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

  return result;
}

async function acknowledgeTripRequirements(tripId, email, version = null) {
  const tripDetails = await getTripDetailsById(tripId, email);

  if (!tripDetails) {
    return null;
  }

  const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');

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

async function createFlightForLoggedUser(email, payload = {}) {
  const traveler = await getTravelerByEmail(email);

  if (!traveler) {
    return null;
  }

  const trackingNumber = normalizeOptionalString(
    pickFirstValue(payload.trackingNumber, payload.name, payload.Name)
  );
  const airlineCompany = normalizeOptionalString(
    pickFirstValue(payload.airlineCompany, payload.Airline_Company)
  );
  const airportDestination = normalizeOptionalString(
    pickFirstValue(payload.airportDestination, payload.Airport_Destination)
  );
  const arrival = normalizeOptionalIsoDateTime(
    pickFirstValue(payload.arrival, payload.Arrival)
  );
  const departure = normalizeOptionalIsoDateTime(
    pickFirstValue(payload.departure, payload.Departure)
  );
  const departureAirport = normalizeOptionalString(
    pickFirstValue(payload.departureAirport, payload.Departure_Airport)
  );
  const status = normalizeOptionalString(
    pickFirstValue(payload.status, payload.Status)
  );

  const connectionRows = Array.isArray(
    pickFirstValue(payload.connectionsInformation, payload.Connection_Info)
  )
    ? pickFirstValue(payload.connectionsInformation, payload.Connection_Info)
    : [];

  if (!trackingNumber) {
    throw new Error("Tracking Number is required");
  }

  const zohoPayload = {
    Name: trackingNumber,
    Airline_Company: airlineCompany,
    Airport_Destination: airportDestination,
    Arrival: arrival,
    Departure: departure,
    Departure_Airport: departureAirport,
    Status: status,
    Connection_Info: connectionRows
      .map((row) => ({
        Connection_Airport: normalizeOptionalString(
          pickFirstValue(row?.connectionAirport, row?.Connection_Airport)
        ),
        Country_City: normalizeOptionalString(
          pickFirstValue(row?.countryCity, row?.Country_City)
        ),
        Date: normalizeOptionalIsoDate(
          pickFirstValue(row?.date, row?.Date)
        ),
        Duration: normalizeOptionalNumber(
          pickFirstValue(row?.duration, row?.Duration)
        ),
        Time: normalizeOptionalString(
          pickFirstValue(row?.time, row?.Time)
        ),
      }))
      .filter((row) =>
        row.Connection_Airport ||
        row.Country_City ||
        row.Date ||
        row.Duration !== null ||
        row.Time
      ),
  };

  const created = await zohoCreateRecord("Flights", zohoPayload);

  clearDataCacheByPrefix("record:Flights:");

  return {
    id: created?.details?.id || null,
    trackingNumber,
    airlineCompany,
    airportDestination,
    arrival,
    departure,
    departureAirport,
    status,
    connectionsInformation: zohoPayload.Connection_Info.map((row) => ({
      connectionAirport: row.Connection_Airport,
      countryCity: row.Country_City,
      date: row.Date,
      duration: row.Duration,
      time: row.Time,
    })),
    traveler: {
      id: traveler.id || null,
      email: traveler.email || null,
      travelerName: traveler.travelerName || null,
    },
    zoho: created,
  };
}

function mapProductRecord(record) {
  if (!record) return null;

  return {
    id: record.id || null,
    color: normalizeOptionalString(record.Color),
    description: normalizeOptionalString(record.Description),
    recordImage: mapRecordPhoto("Products", record.id || null, record.Record_Image),
    destinationRelated: Array.isArray(record.Destination_Related)
      ? record.Destination_Related.map((item) => mapLookup(item?.Destination_Related || item)).filter(
          (item) => item && (item.id || item.name)
        )
      : [],
    layout: mapLayout(record.Layout),
    productActive:
      record.Product_Active === true ||
      String(record.Product_Active || "").trim().toLowerCase() === "true",
    productCode: normalizeOptionalString(record.Product_Code),
    lureImageCatalog: mapUploadedFiles("Products", record.id || null, record.Lure_Image_Catalog),
    lureImageReal: mapUploadedFiles("Products", record.id || null, record.Lure_Image_Real),
    productName: normalizeOptionalString(record.Product_Name),
    unitPrice: normalizeOptionalNumber(record.Unit_Price),
    vendorName: mapLookup(record.Vendor_Name),
  };
}

async function listProducts(payload = {}) {
  const page = Math.max(1, Number(payload.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(payload.perPage) || 50));
  const layout = normalizeOptionalString(payload.layout) || "Lures and Flies";
  const productActive =
    payload.productActive === undefined || payload.productActive === null || payload.productActive === ""
      ? true
      : String(payload.productActive).trim().toLowerCase() === "true";
  const search = normalizeOptionalString(payload.search);
  const vendorName = normalizeOptionalString(payload.vendorName);
  const destinationRelated = normalizeOptionalString(payload.destinationRelated);
  const destinationRelatedId = normalizeOptionalString(payload.destinationRelatedId);
  const cacheKey = `products:list:${JSON.stringify({
    page,
    perPage,
    layout,
    productActive,
    search,
    vendorName,
    destinationRelated,
    destinationRelatedId,
  })}`;

  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const records = await zohoListRecords(
    "Products",
    [
      "Color",
      "Description",
      "Record_Image",
      "Destination_Related",
      "Layout",
      "Product_Active",
      "Product_Code",
      "Lure_Image_Catalog",
      "Lure_Image_Real",
      "Product_Name",
      "Unit_Price",
      "Vendor_Name",
    ],
    1,
    200
  );

  const normalizedLayout = layout.trim().toLowerCase();
  const normalizedSearch = search ? search.toLowerCase() : null;
  const normalizedVendor = vendorName ? vendorName.toLowerCase() : null;
  const normalizedDestination = destinationRelated ? destinationRelated.toLowerCase() : null;
  const normalizedDestinationId = destinationRelatedId ? destinationRelatedId.toLowerCase() : null;

  const hydratedRecords =
    normalizedDestination || normalizedDestinationId
      ? await Promise.all(
          (records || []).map(async (record) => {
            if (!record?.id) return record;
            try {
              return await zohoGetRecord("Products", record.id);
            } catch {
              return record;
            }
          })
        )
      : records || [];

  const filteredItems = hydratedRecords
    .map(mapProductRecord)
    .filter(Boolean)
    .filter((item) => {
      const layoutName = String(
        item.layout?.displayLabel || item.layout?.name || ""
      )
        .trim()
        .toLowerCase();
      if (normalizedLayout && layoutName !== normalizedLayout) return false;
      if (productActive && item.productActive !== true) return false;
      if (
        normalizedSearch &&
        !String(item.productName || "").toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }
      if (
        normalizedVendor &&
        String(item.vendorName?.name || "").trim().toLowerCase() !== normalizedVendor
      ) {
        return false;
      }
      if (
        normalizedDestinationId &&
        !item.destinationRelated.some(
          (entry) => String(entry?.id || "").trim().toLowerCase() === normalizedDestinationId
        )
      ) {
        return false;
      }
      if (
        normalizedDestination &&
        !item.destinationRelated.some(
          (entry) => String(entry?.name || "").trim().toLowerCase() === normalizedDestination
        )
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => String(a.productName || "").localeCompare(String(b.productName || "")));

  const offset = (page - 1) * perPage;
  const items = filteredItems.slice(offset, offset + perPage);

  const result = {
    items,
    page,
    perPage,
    count: filteredItems.length,
    filters: {
      layout,
      productActive,
      search,
      vendorName,
      destinationRelated,
      destinationRelatedId,
    },
  };

  setDataCache(cacheKey, result, TTL_PRODUCTS_MS);
  return result;
}

async function getProductById(productId, payload = {}) {
  const layout = normalizeOptionalString(payload.layout) || "Lures and Flies";
  const cacheKey = `products:detail:${productId}:${layout}`;
  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const record = await zohoGetRecord("Products", productId);
  const product = mapProductRecord(record);
  if (!product) return null;

  const layoutName = String(product.layout?.displayLabel || product.layout?.name || "")
    .trim()
    .toLowerCase();

  if (layoutName && layoutName !== layout.trim().toLowerCase()) {
    return null;
  }

  setDataCache(cacheKey, product, TTL_PRODUCTS_MS);
  return product;
}

module.exports = {
  getZohoAccessToken,
  getTravelerByEmail,
  getTripsByLoggedUser,
  getTripDetailsById,
  getTripRequirementsById,
  acknowledgeTripRequirements,
  streamZohoFile,
  streamZohoRecordPhoto,
  streamSalesOrderPdf,
  runCoqlQuery,
  zohoGetRecord,
  zohoListRecords,
  createFlightForLoggedUser,
  listProducts,
  getProductById
};
