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
const TTL_TRIP_DETAILS_MS = Number(process.env.DATA_CACHE_TTL_TRIP_DETAILS_MS || 5 * 60 * 1000);
const TTL_DEALS_MS = Number(process.env.DATA_CACHE_TTL_DEALS_MS || 5 * 60 * 1000);
const TTL_PRODUCTS_MS = Number(process.env.DATA_CACHE_TTL_PRODUCTS_MS || 2 * 60 * 1000);
const dataCache = new Map();
const DEFAULT_OPERATIONS_ACCESS_EMAILS = [
  "sales@zybaoutdoors.com",
  "fishingtrips@zybaoutdoors.com",
  "fishingtrips@zuybaoutdoors.com",
];
const DEFAULT_VISIBLE_TRIP_STATUSES = ["Approved", "Rescheduled"];

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
    trackingNumber: record.Flight_Number || record.Name || null,
    airlineCompany: record.Airline_Company || null,
    airportDestination: record.Airport_Destination || null,
    arrival: record.Arrival || null,
    departure: record.Departure || null,
    departureAirport: record.Departure_Airport || null,
    status: record.Status || null,
    ticketFile: mapUploadedFiles("Flights", record.id, record.Ticket_File),
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

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeOptionalString(item))
      .filter(Boolean);
  }

  return normalizeOptionalString(value)
    ? String(value)
        .split(";")
        .map((item) => normalizeOptionalString(item))
        .filter(Boolean)
    : [];
}

function mapHotelRecord(record) {
  if (!record) return null;

  return {
    id: record.id || null,
    bookingCode: normalizeOptionalString(record.Name),
    checkIn: record.Check_in || null,
    checkOut: record.Check_out || null,
    checkinInformation: normalizeOptionalString(record.Checkin_information),
    parentTrip: mapLookup(record.Parent_Trip),
    email: normalizeOptionalString(record.Email),
    secondaryEmail: normalizeOptionalString(record.Secondary_Email),
    extraNight: normalizeOptionalNumber(record.Extra_Night),
    features: normalizeStringArray(record.Features),
    hotelName: mapLookup(record.Hotel_name),
    payment: normalizeOptionalString(record.Payment),
    roomType: normalizeOptionalString(record.Room_type),
    singleRoomExtra: normalizeOptionalNumber(record.Price),
    tag: normalizeOptionalString(record.Tag),
    recordImage: mapRecordPhoto("Hotels", record.id || null, record.Record_Image),
  };
}

function mapVendorHotelPhotos(vendorRecord) {
  if (!vendorRecord?.id) return [];
  return mapUploadedFiles("Vendors", vendorRecord.id, vendorRecord.Photos);
}

function mapVendorHotelAddress(vendorRecord) {
  if (!vendorRecord) return null;

  const parts = [
    vendorRecord.Street,
    vendorRecord.City,
    vendorRecord.State,
    vendorRecord.Zip_Code,
    vendorRecord.Destination_Country,
  ]
    .map((item) => normalizeOptionalString(item))
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

async function attachVendorPhotosToHotels(hotels) {
  const vendorIds = Array.from(
    new Set(
      (hotels || [])
        .map((hotel) => normalizeOptionalString(hotel?.hotelName?.id))
        .filter(Boolean)
    )
  );

  if (vendorIds.length === 0) return hotels;

  const vendorsById = new Map();
  await Promise.all(
    vendorIds.map(async (vendorId) => {
      try {
        const vendorRecord = await zohoGetRecord("Vendors", vendorId);
        if (vendorRecord) {
          vendorsById.set(vendorId, vendorRecord);
        }
      } catch (e) {}
    })
  );

  return hotels.map((hotel) => {
    const vendorId = normalizeOptionalString(hotel?.hotelName?.id);
    const vendorRecord = vendorId ? vendorsById.get(vendorId) : null;
    const photos = mapVendorHotelPhotos(vendorRecord);
    const address = mapVendorHotelAddress(vendorRecord);

    return {
      ...hotel,
      hotelAddress: address,
      hotelName: hotel.hotelName
        ? {
            ...hotel.hotelName,
            photos,
            address,
          }
        : hotel.hotelName,
      hotelPhotos: photos,
    };
  });
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

function getOperationsAccessEmails() {
  return String(process.env.OPERATIONS_ACCESS_EMAILS || DEFAULT_OPERATIONS_ACCESS_EMAILS.join(","))
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function hasOperationsTripAccess(email) {
  const normalizedEmail = normalizeEmail(email);
  return Boolean(normalizedEmail && getOperationsAccessEmails().includes(normalizedEmail));
}

function getVisibleTripStatuses() {
  return String(process.env.VISIBLE_TRIP_STATUSES || DEFAULT_VISIBLE_TRIP_STATUSES.join(","))
    .split(",")
    .map((status) => normalizeOptionalString(status))
    .filter(Boolean);
}

function buildVisibleTripStatusClause() {
  const statuses = getVisibleTripStatuses();
  const values = statuses.length ? statuses : DEFAULT_VISIBLE_TRIP_STATUSES;
  return `Status in (${values.map((status) => `'${escapeCoql(status)}'`).join(", ")})`;
}

function buildTripsAccessWhereClause(email, options = {}) {
  const normalizedEmail = normalizeEmail(email);
  const statusClause = buildVisibleTripStatusClause();
  const allowOperationsAccess = options?.allowOperationsAccess === true;

  if (allowOperationsAccess && hasOperationsTripAccess(normalizedEmail)) {
    return `(${statusClause})`;
  }

  return `((${statusClause}) and (Account_Name.Email = '${escapeCoql(normalizedEmail)}'))`;
}

function buildOperationsTraveler(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!hasOperationsTripAccess(normalizedEmail)) return null;

  const label = normalizedEmail.startsWith("sales@") ? "Zyba Sales" : "Zyba Fishing Trips";

  return {
    id: null,
    travelerName: label,
    email: normalizedEmail,
    gender: null,
    passport: null,
    passportExpiration: null,
    recordImage: null,
    country: null,
    isOperationsUser: true,
  };
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalBoolean(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["true", "yes", "1"].includes(text)) return true;
  if (["false", "no", "0"].includes(text)) return false;
  return null;
}

function normalizeMultiSelect(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        normalizeOptionalString(
          item && typeof item === "object"
            ? item.name || item.display_value || item.value || item.id
            : item
        )
      )
      .filter(Boolean);
  }
  return String(value)
    .split(";")
    .map(normalizeOptionalString)
    .filter(Boolean);
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

async function zohoGetRecord(moduleApiName, recordId, options = {}) {
  const bypassCache = options?.bypassCache === true;
  const recordCacheKey = `record:${moduleApiName}:${recordId}`;
  const cachedRecord = bypassCache ? null : getDataCache(recordCacheKey);
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
  if (record && !bypassCache) {
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

async function zohoGetModuleFields(moduleApiName) {
  const safeModule = normalizeOptionalString(moduleApiName);
  if (!safeModule) return [];

  const cacheKey = `fields:${safeModule}`;
  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const token = await getZohoAccessToken();
  const url = new URL("/crm/v8/settings/fields", process.env.ZOHO_API_DOMAIN);
  url.searchParams.set("module", safeModule);

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
        : response.data.message || `Failed to fetch fields from ${safeModule}`
    );
  }

  const fields = Array.isArray(response.data?.fields) ? response.data.fields : [];
  setDataCache(cacheKey, fields, TTL_PRODUCTS_MS);
  return fields;
}

async function zohoGetModuleLayouts(moduleApiName) {
  const safeModule = normalizeOptionalString(moduleApiName);
  if (!safeModule) return [];

  const cacheKey = `layouts:${safeModule}`;
  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const token = await getZohoAccessToken();
  const url = new URL("/crm/v8/settings/layouts", process.env.ZOHO_API_DOMAIN);
  url.searchParams.set("module", safeModule);

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
        : response.data.message || `Failed to fetch layouts from ${safeModule}`
    );
  }

  const layouts = Array.isArray(response.data?.layouts) ? response.data.layouts : [];
  setDataCache(cacheKey, layouts, TTL_PRODUCTS_MS);
  return layouts;
}

async function zohoGetInventoryTemplates(moduleApiName) {
  const safeModule = normalizeOptionalString(moduleApiName);
  const cacheKey = `inventory-templates:${safeModule || "all"}`;
  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const token = await getZohoAccessToken();
  const url = new URL("/crm/v8/settings/inventory_templates", process.env.ZOHO_API_DOMAIN);

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
        : response.data.message || "Failed to fetch inventory templates"
    );
  }

  const templates = Array.isArray(response.data?.inventory_templates)
    ? response.data.inventory_templates
    : [];
  const filtered = safeModule
    ? templates.filter((template) => template?.module?.api_name === safeModule)
    : templates;

  setDataCache(cacheKey, filtered, TTL_PRODUCTS_MS);
  return filtered;
}

async function getInventoryTemplateIdByName(templateName, moduleApiName = "Sales_Orders") {
  const safeTemplateName = normalizeOptionalString(templateName);
  if (!safeTemplateName) return null;

  const templates = await zohoGetInventoryTemplates(moduleApiName);
  const template = templates.find(
    (item) =>
      String(item?.name || "")
        .trim()
        .toLowerCase() === safeTemplateName.toLowerCase()
  );

  return normalizeOptionalString(template?.id);
}

function mapPicklistOption(option) {
  const displayValue = normalizeOptionalString(option?.display_value || option?.display_label || option?.actual_value);
  const actualValue = normalizeOptionalString(option?.actual_value || option?.reference_value || displayValue);
  if (!displayValue && !actualValue) return null;

  return {
    id: normalizeOptionalString(option?.id),
    displayValue: displayValue || actualValue,
    actualValue: actualValue || displayValue,
    type: normalizeOptionalString(option?.type),
    sequenceNumber: normalizeOptionalNumber(option?.sequence_number),
    colorCode: normalizeOptionalString(option?.colour_code || option?.color_code),
  };
}

async function getModulePicklistValues(moduleApiName, fieldApiName) {
  const safeModule = normalizeOptionalString(moduleApiName);
  const safeField = normalizeOptionalString(fieldApiName);
  if (!safeModule || !safeField) {
    return {
      module: safeModule || null,
      field: safeField || null,
      options: [],
    };
  }

  const cacheKey = `picklist:${safeModule}:${safeField}`;
  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const fields = await zohoGetModuleFields(safeModule);
  const field = fields.find((entry) => {
    const apiName = String(entry?.api_name || "").trim().toLowerCase();
    const fieldLabel = String(entry?.field_label || "").trim().toLowerCase();
    return apiName === safeField.toLowerCase() || fieldLabel === safeField.toLowerCase();
  });

  if (!field) {
    const result = {
      module: safeModule,
      field: safeField,
      options: [],
    };
    setDataCache(cacheKey, result, TTL_PRODUCTS_MS);
    return result;
  }

  let rawOptions = [];

  if (field.id) {
    const token = await getZohoAccessToken();
    const url = new URL(
      `/crm/v8/settings/fields/${field.id}/pick_list_values`,
      process.env.ZOHO_API_DOMAIN
    );
    url.searchParams.set("module", safeModule);

    const response = await httpsRequest({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${token.access_token}`,
        Accept: "application/json",
      },
    });

    if (response.statusCode < 400) {
      rawOptions = Array.isArray(response.data?.pick_list_values)
        ? response.data.pick_list_values
        : [];
    }
  }

  if (rawOptions.length === 0 && Array.isArray(field.pick_list_values)) {
    rawOptions = field.pick_list_values;
  }

  const options = rawOptions
    .map(mapPicklistOption)
    .filter(Boolean)
    .sort((a, b) => {
      const aOrder = Number.isFinite(a.sequenceNumber) ? a.sequenceNumber : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(b.sequenceNumber) ? b.sequenceNumber : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.displayValue || "").localeCompare(String(b.displayValue || ""));
    });

  const result = {
    module: safeModule,
    field: safeField,
    fieldId: normalizeOptionalString(field.id),
    options,
  };

  setDataCache(cacheKey, result, TTL_PRODUCTS_MS);
  return result;
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
      select id, Deal_Name, Arrival_Date, Departure_Date, Deal_Cover, Destination
      from Deals
      where (id in (${inClause}))
      limit 0, 200
    `;

    const response = await runCoqlQuery(query);
    for (const deal of response.data || []) {
      if (deal?.id) {
        dealsMap.set(String(deal.id), deal);
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

async function getFlightsByParentTrip(tripId) {
  const safeTripId = normalizeOptionalString(tripId);
  if (!safeTripId) return [];

  const cacheKey = `flights-by-parent-trip:${safeTripId}`;
  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const items = [];
  const perPage = 200;
  for (let page = 1; page <= 5; page += 1) {
    const pageItems = await zohoListRecords(
      "Flights",
      ["Name", "Flight_Number", "Parent_Trip"],
      page,
      perPage
    );
    items.push(
      ...pageItems.filter((item) => String(item?.Parent_Trip?.id || "") === safeTripId)
    );

    if (pageItems.length < perPage) break;
  }

  const flights = (
    await Promise.all(
      items.map(async (item) => {
        if (!item?.id) return null;
        try {
          const record = await zohoGetRecord("Flights", item.id);
          return mapFlightRecord(record);
        } catch (e) {
          return {
            id: item.id || null,
            trackingNumber: item.Flight_Number || item.Name || null,
            ticketFile: [],
            connectionsInformation: [],
          };
        }
      })
    )
  )
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = new Date(a.departure || a.arrival || 0).getTime();
      const bTime = new Date(b.departure || b.arrival || 0).getTime();
      return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
    });

  setDataCache(cacheKey, flights, TTL_TRIP_DETAILS_MS);
  return flights;
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

  clearDataCacheByPrefix(`record:${moduleApiName}:${recordId}`);

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

  if (!item) {
    const operationsTraveler = buildOperationsTraveler(normalizedEmail);
    if (operationsTraveler) {
      setDataCache(cacheKey, operationsTraveler, TTL_TRAVELER_MS);
      return operationsTraveler;
    }

    return null;
  }

  const accountRecord = await zohoGetRecord("Accounts", item.id);
  const result = mapTravelerAccount(accountRecord || item);

  setDataCache(cacheKey, result, TTL_TRAVELER_MS);
  return result;
}

async function getTravelerByAccountId(accountId) {
  const safeAccountId = normalizeOptionalString(accountId);
  if (!safeAccountId) return null;

  const cacheKey = `traveler-account:${safeAccountId}`;
  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const accountRecord = await zohoGetRecord("Accounts", safeAccountId);
  const result = mapTravelerAccount(accountRecord);

  if (result) {
    setDataCache(cacheKey, result, TTL_TRAVELER_MS);
  }

  return result;
}

function mapTravelerAccount(record) {
  if (!record) return null;

  return {
    id: normalizeOptionalString(record.id),
    travelerName: normalizeOptionalString(record.Account_Name || record.Name),
    email: normalizeOptionalString(record.Email),
    gender: normalizeOptionalString(record.Gender),
    passport: normalizeOptionalString(record.Passport),
    passportExpiration: normalizeOptionalString(record.Passport_Expiration),
    recordImage: record.Record_Image || null,
    country: normalizeOptionalString(record.Country),
  };
}

async function getTripsByLoggedUser(email) {
  const normalizedEmail = normalizeEmail(email);
  const isOperationsAccess = hasOperationsTripAccess(normalizedEmail);
  const cacheKey = isOperationsAccess
    ? `trips:operations:${getVisibleTripStatuses().join("|")}`
    : `trips:${normalizedEmail}`;

  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const query = `
    select id, Deal_Name, Subject, Status, Grand_Total, Documents_Acknowledged
    from Sales_Orders
    where ${buildTripsAccessWhereClause(normalizedEmail, { allowOperationsAccess: true })}
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

  const vendorIds = Array.from(
    new Set(
      Array.from(dealsById.values())
        .map((deal) => deal?.Destination?.id)
        .filter(Boolean)
        .map((id) => String(id))
    )
  );

  const vendorsById = new Map();
  await Promise.all(
    vendorIds.map(async (vendorId) => {
      try {
        const vendorRecord = await zohoGetRecord("Vendors", vendorId);
        if (vendorRecord) {
          vendorsById.set(vendorId, vendorRecord);
        }
      } catch (e) {}
    })
  );

  const result = items.map((item) => {
      let arrivalDate = null;
      let departureDate = null;
      let coverId = null;
      let tripName = item.Subject || item.Deal_Name?.name || null;
      let destinationName = item.Deal_Name?.name || null;
      let destinationCountry = null;

      if (item.Deal_Name && item.Deal_Name.id) {
        const dealRecord = dealsById.get(String(item.Deal_Name.id));
        if (dealRecord) {
          arrivalDate = dealRecord.Arrival_Date || null;
          departureDate = dealRecord.Departure_Date || null;
          tripName = item.Subject || dealRecord.Deal_Name || item.Deal_Name?.name || null;

          const destinationLookup = mapLookup(dealRecord.Destination);
          const vendorRecord = destinationLookup?.id
            ? vendorsById.get(String(destinationLookup.id))
            : null;

          destinationName =
            destinationLookup?.name ||
            vendorRecord?.Vendor_Name ||
            vendorRecord?.Name ||
            vendorRecord?.Deal_Name ||
            destinationName;
          destinationCountry =
            vendorRecord?.Destination_Country ||
            vendorRecord?.Country ||
            null;

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
        tripName,
        dealName: item.Deal_Name?.name || null,
        destinationName,
        destinationCountry,
        subject: item.Subject || null,
        status: item.Status || null,
        totalAmount: item.Grand_Total ?? null,
        documentsAcknowledged: item.Documents_Acknowledged === true,
        arrivalDate,
        departureDate,
        coverId,
      };
    });

  setDataCache(cacheKey, result, TTL_TRIPS_MS);
  return result;
}

async function getProductOrdersByLoggedUser(email) {
  const normalizedEmail = normalizeEmail(email);
  const cacheKey = `product-orders:${normalizedEmail}`;

  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const query = `
    select id, Subject, SO_Number, Grand_Total, Status, Stripe_Currency, App_Order_Created_At, Deal_Name
    from Sales_Orders
    where ((Shop_Gears_Order = true) and (Account_Name.Email = '${escapeCoql(normalizedEmail)}'))
    limit 0, 200
  `;

  const response = await runCoqlQuery(query);
  const items = response.data || [];

  const recordsById = new Map();
  await Promise.all(
    items.map(async (item) => {
      if (!item?.id) return;
      try {
        const record = await zohoGetRecord("Sales_Orders", item.id);
        if (record) {
          recordsById.set(String(item.id), record);
        }
      } catch (e) {}
    })
  );

  const result = items
    .map((item) => {
      const record = recordsById.get(String(item.id)) || item;
      const orderedItems = Array.isArray(record.Ordered_Items) ? record.Ordered_Items : [];

      return {
        id: item.id || null,
        subject: normalizeOptionalString(record.Subject || item.Subject),
        salesOrderNumber: item.SO_Number ? String(item.SO_Number) : normalizeOptionalString(record.SO_Number),
        destinationName:
          normalizeOptionalString(record.Deal_Name?.name || item.Deal_Name?.name) ||
          normalizeOptionalString(record.Subject || item.Subject)?.replace(/^Shop Gears\s*-\s*/i, "") ||
          null,
        total:
          normalizeOptionalNumber(record.Grand_Total) ??
          normalizeOptionalNumber(item.Grand_Total) ??
          normalizeOptionalNumber(record.Stripe_Amount_Total),
        status: normalizeOptionalString(record.Status || item.Status),
        currency:
          normalizeOptionalString(record.Stripe_Currency || item.Stripe_Currency) || "usd",
        paymentDate:
          normalizeOptionalString(
            record.App_Order_Created_At || item.App_Order_Created_At || record.Created_Time
          ),
        createdAt:
          normalizeOptionalString(
            record.App_Order_Created_At || item.App_Order_Created_At || record.Created_Time
          ),
        items: orderedItems
          .map((subItem) => {
            const quantity = normalizeOptionalNumber(subItem.Quantity);
            const unitPrice = normalizeOptionalNumber(subItem.List_Price);
            const total =
              normalizeOptionalNumber(subItem.Net_Total) ??
              normalizeOptionalNumber(subItem.Total) ??
              (quantity !== null && unitPrice !== null ? quantity * unitPrice : null);

            return {
              id: normalizeOptionalString(subItem.id) || normalizeOptionalString(subItem.Product_Name?.id),
              name:
                normalizeOptionalString(subItem.Product_Name?.name || subItem.Product_Name) ||
                normalizeOptionalString(subItem.Description) ||
                "Product",
              description: normalizeOptionalString(subItem.Description),
              quantity,
              unitPrice,
              total,
            };
          })
          .filter((subItem) => subItem.id || subItem.name),
      };
    })
    .filter((item) => item.id)
    .sort((a, b) => String(b.createdAt || b.id).localeCompare(String(a.createdAt || a.id)));

  setDataCache(cacheKey, result, TTL_TRIPS_MS);
  return result;
}

async function getTripDetailsById(tripId, email, options = {}) {
  const bypassCache = options?.bypassCache === true;
  const includeFlights = options?.includeFlights !== false;
  const normalizedEmail = normalizeEmail(email);
  const allowOperationsAccess = options?.allowOperationsAccess === true;
  const isOperationsAccess = allowOperationsAccess && hasOperationsTripAccess(normalizedEmail);
  const cacheKey = `trip-details:${tripId}:${isOperationsAccess ? "operations" : normalizedEmail}`;

  const cached = bypassCache ? null : getDataCache(cacheKey);
  if (cached) return cached;

  const tripQuery = `
    select id, Deal_Name, Account_Name, Subject, Status, Grand_Total
    from Sales_Orders
    where ((id = '${escapeCoql(tripId)}') and ${
      isOperationsAccess
        ? buildVisibleTripStatusClause()
        : `(Account_Name.Email = '${escapeCoql(normalizedEmail)}')`
    })
    limit 0, 1
  `;

  const tripResponse = await runCoqlQuery(tripQuery);
  const trip = tripResponse.data?.[0];

  if (!trip) {
    return null;
  }

  const tripRecord = await zohoGetRecord("Sales_Orders", tripId, { bypassCache });
  const flights = includeFlights ? await getFlightsByParentTrip(tripId) : [];
  const accountLookup = mapLookup(tripRecord?.Account_Name || trip.Account_Name);
  let accountRecord = null;

  if (accountLookup?.id) {
    try {
      accountRecord = await zohoGetRecord("Accounts", accountLookup.id);
    } catch (e) {}
  }

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

      if (destinationLookup?.id) {
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
        country: destinationCountry,
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
      flights: flights.map((flight) => ({
        id: flight.id || null,
        name: flight.trackingNumber || null,
        trackingNumber: flight.trackingNumber || null,
        airlineCompany: flight.airlineCompany || null,
        airportDestination: flight.airportDestination || null,
        arrival: flight.arrival || null,
        departure: flight.departure || null,
        departureAirport: flight.departureAirport || null,
        status: flight.status || null,
        ticketFile: flight.ticketFile || [],
        connectionsInformation: flight.connectionsInformation || [],
      })),
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
      account: {
        id: accountLookup?.id || null,
        name:
          normalizeOptionalString(accountRecord?.Account_Name || accountRecord?.Name) ||
          accountLookup?.name ||
          null,
        email: normalizeOptionalString(accountRecord?.Email),
        country: normalizeOptionalString(accountRecord?.Country),
      },
      vendorName,
      destinationCountry,
      deal: {
        id: dealLookup?.id || null,
        name: dealLookup?.name || null,
      },
    },
    deal,
  };

  if (!bypassCache && includeFlights) {
    setDataCache(cacheKey, result, TTL_TRIP_DETAILS_MS);
  }
  return result;
}

async function getTripRequirementsById(tripId, email, options = {}) {
  const tripDetails = await getTripDetailsById(tripId, email, {
    bypassCache: true,
    includeFlights: false,
    allowOperationsAccess: options?.allowOperationsAccess === true,
  });

  if (!tripDetails) {
    return null;
  }

  const tripAccount = tripDetails.trip?.account || null;
  const traveler = options?.allowOperationsAccess === true && hasOperationsTripAccess(email)
    ? (await getTravelerByAccountId(tripAccount?.id)) ||
      (tripAccount?.email ? await getTravelerByEmail(tripAccount.email) : null)
    : await getTravelerByEmail(email);

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
  const tripDetails = await getTripDetailsById(tripId, email, {
    bypassCache: true,
    includeFlights: false,
  });

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

  return await getTripDetailsById(tripId, email, {
    bypassCache: true,
    includeFlights: false,
  });
}

async function createFlightForLoggedUser(email, payload = {}) {
  const tripId = normalizeOptionalString(
    pickFirstValue(payload.tripId, payload.parentTripId, payload.Parent_Trip)
  );

  if (!tripId) {
    throw new Error("Parent Trip is required");
  }

  const tripDetails = await getTripDetailsById(tripId, email);

  if (!tripDetails?.trip?.id) {
    return null;
  }

  const trackingNumber = normalizeOptionalString(
    pickFirstValue(
      payload.trackingNumber,
      payload.flightNumber,
      payload.Flight_Number,
      payload.name,
      payload.Name
    )
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
    Flight_Number: trackingNumber,
    Airline_Company: airlineCompany,
    Airport_Destination: airportDestination,
    Arrival: arrival,
    Departure: departure,
    Departure_Airport: departureAirport,
    Status: status,
    Parent_Trip: { id: tripId },
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
  clearDataCacheByPrefix(`flights-by-parent-trip:${tripId}`);
  clearDataCacheByPrefix(`trip-details:${tripId}:`);

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
    parentTrip: {
      id: tripDetails.trip.id,
      subject: tripDetails.trip.subject || null,
    },
    zoho: created,
  };
}

async function listHotelsForLoggedUser(email, payload = {}, options = {}) {
  const tripId = normalizeOptionalString(
    pickFirstValue(payload.tripId, payload.parentTripId, payload.Parent_Trip)
  );

  if (!tripId) {
    throw new Error("Parent Trip is required");
  }

  const tripDetails = await getTripDetailsById(tripId, email, {
    allowOperationsAccess: options?.allowOperationsAccess === true,
  });

  if (!tripDetails?.trip?.id) {
    return null;
  }

  const cacheKey = `hotels-by-parent-trip:${tripId}`;
  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const records = await zohoListRecords(
    "Hotels",
    [
      "Name",
      "Check_in",
      "Check_out",
      "Checkin_information",
      "Parent_Trip",
      "Email",
      "Secondary_Email",
      "Extra_Night",
      "Features",
      "Hotel_name",
      "Payment",
      "Room_type",
      "Price",
      "Tag",
      "Record_Image",
    ],
    1,
    200
  );

  const hotels = records
    .map((record) => mapHotelRecord(record))
    .filter(Boolean)
    .filter((hotel) =>
      String(hotel.parentTrip?.id || "") === String(tripId)
    )
    .sort((a, b) => {
      const aTime = new Date(a.checkIn || a.checkOut || 0).getTime();
      const bTime = new Date(b.checkIn || b.checkOut || 0).getTime();
      return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
    });

  const enrichedHotels = await attachVendorPhotosToHotels(hotels);

  setDataCache(cacheKey, enrichedHotels, TTL_TRIP_DETAILS_MS);
  return enrichedHotels;
}

function mapProductRecord(record) {
  if (!record) return null;

  const connectedTo = Array.isArray(record.Connected_To__s)
    ? record.Connected_To__s.map((item) => mapLookup(item?.Connected_To__s || item)).filter(
        (item) => item && (item.id || item.name)
      )
    : [];

  return {
    id: record.id || null,
    category: normalizeOptionalString(record.Category),
    color: normalizeOptionalString(record.Color),
    commissionRate: normalizeOptionalNumber(record.Commission_Rate),
    connectedTo,
    createdBy: normalizeOptionalString(record.Created_By),
    description: normalizeOptionalString(record.Description),
    productCategory: normalizeOptionalString(record.Product_Category),
    recordImage: mapRecordPhoto("Products", record.id || null, record.Record_Image),
    destinationRelated: Array.isArray(record.Destination_Related)
      ? record.Destination_Related.map((item) => mapLookup(item?.Destination_Related || item)).filter(
          (item) => item && (item.id || item.name)
        )
      : [],
    extraDay: normalizeOptionalString(record.Extra_Day),
    handler: mapLookup(record.Handler),
    layout: mapLayout(record.Layout),
    manufacturer: normalizeOptionalString(record.Manufacturer),
    modifiedBy: normalizeOptionalString(record.Modified_By),
    owner: mapLookup(record.Owner),
    productActive: normalizeOptionalBoolean(record.Product_Active) === true,
    productCode: normalizeOptionalString(record.Product_Code),
    essential: normalizeOptionalBoolean(record.Essential) === true,
    productRecommended:
      normalizeOptionalBoolean(
        pickFirstValue(record.Product_Recommended, record.Highly_Recommended, record.Recommended)
      ) === true,
    productImageCatalog: mapUploadedFiles(
      "Products",
      record.id || null,
      record.Product_Image_Catalog
    ),
    productImageReal: mapUploadedFiles(
      "Products",
      record.id || null,
      record.Product_Image_Real
    ),
    productName: normalizeOptionalString(record.Product_Name),
    qtyOrdered: normalizeOptionalNumber(record.Qty_Ordered),
    qtyInDemand: normalizeOptionalNumber(record.Qty_in_Demand),
    reorderLevel: normalizeOptionalNumber(record.Reorder_Level),
    salesEndDate: normalizeOptionalIsoDate(record.Sales_End_Date),
    salesStartDate: normalizeOptionalIsoDate(record.Sales_Start_Date),
    singlePrice: normalizeOptionalNumber(record.Single_Price),
    supportExpiryDate: normalizeOptionalIsoDate(record.Support_Expiry_Date),
    supportStartDate: normalizeOptionalIsoDate(record.Support_Start_Date),
    tag: normalizeOptionalString(record.Tag),
    tax: normalizeMultiSelect(record.Tax),
    taxable: normalizeOptionalBoolean(record.Taxable),
    unitPrice: normalizeOptionalNumber(pickFirstValue(record.Unit_Price, record.Single_Price)),
    usageUnit: normalizeOptionalString(record.Usage_Unit),
    vendorName: mapLookup(record.Vendor_Name),
  };
}

async function listProducts(payload = {}) {
  const page = Math.max(1, Number(payload.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(payload.perPage) || 50));
  const layout = normalizeOptionalString(payload.layout);
  const category = normalizeOptionalString(payload.category);
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
    category,
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
      "Category",
      "Color",
      "Commission_Rate",
      "Connected_To__s",
      "Created_By",
      "Description",
      "Product_Category",
      "Record_Image",
      "Destination_Related",
      "Extra_Day",
      "Handler",
      "Layout",
      "Manufacturer",
      "Modified_By",
      "Owner",
      "Product_Active",
      "Product_Code",
      "Essential",
      "Product_Image_Catalog",
      "Product_Image_Real",
      "Product_Name",
      "Qty_Ordered",
      "Qty_in_Demand",
      "Reorder_Level",
      "Sales_End_Date",
      "Sales_Start_Date",
      "Single_Price",
      "Support_Expiry_Date",
      "Support_Start_Date",
      "Tag",
      "Tax",
      "Taxable",
      "Unit_Price",
      "Usage_Unit",
      "Vendor_Name",
    ],
    1,
    200
  );

  const normalizedLayout = layout ? layout.trim().toLowerCase() : null;
  const normalizedCategory = category ? category.trim().toLowerCase() : null;
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
      if (
        normalizedCategory &&
        String(item.category || "").trim().toLowerCase() !== normalizedCategory
      ) {
        return false;
      }
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
      category,
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
  const layout = normalizeOptionalString(payload.layout);
  const category = normalizeOptionalString(payload.category);
  const cacheKey = `products:detail:${productId}:${layout || ""}:${category || ""}`;
  const cached = getDataCache(cacheKey);
  if (cached) return cached;

  const record = await zohoGetRecord("Products", productId);
  const product = mapProductRecord(record);
  if (!product) return null;

  const layoutName = String(product.layout?.displayLabel || product.layout?.name || "")
    .trim()
    .toLowerCase();

  if (layout && layoutName && layoutName !== layout.trim().toLowerCase()) {
    return null;
  }

  if (
    category &&
    String(product.category || "").trim().toLowerCase() !== category.trim().toLowerCase()
  ) {
    return null;
  }

  setDataCache(cacheKey, product, TTL_PRODUCTS_MS);
  return product;
}

function normalizeCheckoutItemsForSalesOrder(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const productId = normalizeOptionalString(item?.productId);
      const productName = normalizeOptionalString(item?.productName);
      const quantity = Math.max(0, Math.floor(Number(item?.quantity) || 0));
      const unitPrice = normalizeOptionalNumber(item?.unitPrice);

      if (!productId || !productName || quantity <= 0 || unitPrice === null) {
        return null;
      }

      return {
        productId,
        productName,
        productCode: normalizeOptionalString(item?.productCode),
        vendorName: normalizeOptionalString(item?.vendorName),
        quantity,
        unitPrice,
      };
    })
    .filter(Boolean);
}

function mapShopGearsSalesOrder(record, fallback = {}) {
  if (!record || typeof record !== "object") return null;

  const id = normalizeOptionalString(record.id || fallback.id || fallback.salesOrderId);
  if (!id) return null;

  return {
    id,
    salesOrderId: id,
    salesOrderNumber: normalizeOptionalString(record.SO_Number || fallback.salesOrderNumber),
    subject: normalizeOptionalString(record.Subject || fallback.subject),
    status: normalizeOptionalString(record.Status || fallback.status),
    amountTotal:
      normalizeOptionalNumber(record.Grand_Total) ??
      normalizeOptionalNumber(record.Stripe_Amount_Total) ??
      normalizeOptionalNumber(fallback.amountTotal),
    currency: normalizeOptionalString(record.Stripe_Currency || fallback.currency),
    appOrderStatus: normalizeOptionalString(record.App_Order_Status || fallback.appOrderStatus),
    stripeCheckoutSessionId: normalizeOptionalString(
      record.Stripe_Checkout_Session_ID || fallback.stripeCheckoutSessionId
    ),
    createdAt: normalizeOptionalString(record.App_Order_Created_At || fallback.createdAt),
    items: Array.isArray(fallback.items) ? fallback.items : [],
  };
}

async function findShopGearsSalesOrderByStripeSession(stripeCheckoutSessionId) {
  const safeSessionId = normalizeOptionalString(stripeCheckoutSessionId);
  if (!safeSessionId) return null;

  const query = `
    select id, SO_Number, Subject, Status, Grand_Total, Stripe_Amount_Total, Stripe_Currency, App_Order_Status, Stripe_Checkout_Session_ID, App_Order_Created_At
    from Sales_Orders
    where Stripe_Checkout_Session_ID = '${escapeCoql(safeSessionId)}'
    limit 0, 1
  `;

  const response = await runCoqlQuery(query);
  const existing = response.data?.[0] || null;
  if (!existing?.id) return null;

  try {
    const record = await zohoGetRecord("Sales_Orders", existing.id);
    return mapShopGearsSalesOrder(record, {
      stripeCheckoutSessionId: safeSessionId,
    });
  } catch {
    return mapShopGearsSalesOrder(existing, {
      stripeCheckoutSessionId: safeSessionId,
    });
  }
}

async function getProductOrdersLayout() {
  const configuredLayoutId = normalizeOptionalString(process.env.ZOHO_PRODUCT_ORDERS_LAYOUT_ID);
  const configuredLayoutName =
    normalizeOptionalString(process.env.ZOHO_PRODUCT_ORDERS_LAYOUT_NAME) || "Product Orders";

  const layouts = await zohoGetModuleLayouts("Sales_Orders");
  const layout =
    (configuredLayoutId
      ? layouts.find((item) => String(item?.id || "").trim() === configuredLayoutId)
      : null) ||
    layouts.find(
      (item) =>
        String(item?.name || item?.display_label || "")
          .trim()
          .toLowerCase() === configuredLayoutName.toLowerCase()
    );

  if (!layout?.id) {
    throw new Error(`Zoho Sales_Orders layout not found: ${configuredLayoutName}`);
  }

  return {
    id: String(layout.id).trim(),
    name: normalizeOptionalString(layout.name || layout.display_label) || configuredLayoutName,
  };
}

async function buildShopGearsSalesOrderDraft({ tripId, checkoutStatus, stripeSession }) {
  const safeTripId = normalizeOptionalString(tripId);
  const safeSessionId = normalizeOptionalString(
    stripeSession?.id || checkoutStatus?.checkoutSessionId
  );

  if (!safeTripId) {
    throw new Error("Missing tripId for Sales Order");
  }

  if (!safeSessionId) {
    throw new Error("Missing Stripe Checkout Session ID for Sales Order");
  }

  const cartSnapshot = checkoutStatus?.cartSnapshot || null;
  const items = normalizeCheckoutItemsForSalesOrder(cartSnapshot?.items);
  if (!items.length) {
    throw new Error("Missing checkout cart snapshot for Sales Order");
  }

  const tripRecord = await zohoGetRecord("Sales_Orders", safeTripId);
  if (!tripRecord?.id) {
    throw new Error("Parent trip Sales Order not found");
  }

  const layout = await getProductOrdersLayout();
  const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
  const amountTotal =
    typeof stripeSession?.amount_total === "number" && Number.isFinite(stripeSession.amount_total)
      ? stripeSession.amount_total / 100
      : normalizeOptionalNumber(checkoutStatus?.amountTotal) ?? normalizeOptionalNumber(cartSnapshot?.subtotal);
  const currency = normalizeOptionalString(stripeSession?.currency || checkoutStatus?.currency) || "usd";
  const subjectBase =
    normalizeOptionalString(tripRecord.Subject) ||
    normalizeOptionalString(tripRecord.Deal_Name?.name) ||
    safeTripId;
  const subject = `Shop Gears - ${subjectBase}`;

  const recordData = {
    Layout: { id: layout.id },
    Subject: subject,
    Status: "Completed",
    Payment_Terms: "Credit card",
    Parent_Trip_ID: safeTripId,
    Shop_Gears_Order: true,
    App_Order_Status: "zoho_created",
    App_Order_Created_At: createdAt,
    Stripe_Checkout_Session_ID: safeSessionId,
    Stripe_Payment_Intent_ID: normalizeOptionalString(stripeSession?.payment_intent),
    Stripe_Payment_Status: normalizeOptionalString(stripeSession?.payment_status) || "paid",
    Stripe_Amount_Total: amountTotal,
    Stripe_Currency: currency,
    Discount: 0,
    Tax: 0,
    Adjustment: 0,
    Ordered_Items: items.map((item) => {
      const description = [
        item.productCode ? `SKU: ${item.productCode}` : null,
        item.vendorName ? `Brand: ${item.vendorName}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      return {
        Product_Name: { id: item.productId },
        Quantity: item.quantity,
        List_Price: item.unitPrice,
        Discount: 0,
        Tax: 0,
        Description: description || item.productName,
      };
    }),
  };

  if (tripRecord.Deal_Name?.id) {
    recordData.Deal_Name = { id: tripRecord.Deal_Name.id };
  }

  if (tripRecord.Account_Name?.id) {
    recordData.Account_Name = { id: tripRecord.Account_Name.id };
  }

  const summary = mapShopGearsSalesOrder(
    { id: "dry_run", ...recordData },
    {
      id: "dry_run",
      subject,
      status: recordData.Status,
      amountTotal,
      currency,
      appOrderStatus: recordData.App_Order_Status,
      stripeCheckoutSessionId: safeSessionId,
      createdAt,
      items,
    }
  );

  return {
    layout,
    parentTrip: {
      id: safeTripId,
      subject: normalizeOptionalString(tripRecord.Subject),
      dealId: normalizeOptionalString(tripRecord.Deal_Name?.id),
      dealName: normalizeOptionalString(tripRecord.Deal_Name?.name),
      accountId: normalizeOptionalString(tripRecord.Account_Name?.id),
      accountName: normalizeOptionalString(tripRecord.Account_Name?.name),
    },
    recordData,
    summary,
  };
}

async function createShopGearsSalesOrder({ tripId, checkoutStatus, stripeSession }) {
  const safeSessionId = normalizeOptionalString(
    stripeSession?.id || checkoutStatus?.checkoutSessionId
  );

  const existing = await findShopGearsSalesOrderByStripeSession(safeSessionId);
  if (existing) return existing;

  const draft = await buildShopGearsSalesOrderDraft({ tripId, checkoutStatus, stripeSession });
  const recordData = draft.recordData;
  const created = await zohoCreateRecord("Sales_Orders", recordData);
  const createdId = normalizeOptionalString(created?.details?.id);
  if (!createdId) {
    throw new Error("Zoho did not return the created Sales Order id");
  }

  let createdRecord = null;
  try {
    createdRecord = await zohoGetRecord("Sales_Orders", createdId);
  } catch {}

  return mapShopGearsSalesOrder(createdRecord || { id: createdId }, {
    id: createdId,
    subject: draft.summary?.subject,
    status: draft.summary?.status,
    amountTotal: draft.summary?.amountTotal,
    currency: draft.summary?.currency,
    appOrderStatus: draft.summary?.appOrderStatus,
    stripeCheckoutSessionId: draft.summary?.stripeCheckoutSessionId,
    createdAt: draft.summary?.createdAt,
    items: draft.summary?.items,
  });
}

module.exports = {
  getZohoAccessToken,
  getTravelerByEmail,
  getTripsByLoggedUser,
  getProductOrdersByLoggedUser,
  getTripDetailsById,
  getTripRequirementsById,
  acknowledgeTripRequirements,
  streamZohoFile,
  streamZohoRecordPhoto,
  streamSalesOrderPdf,
  getInventoryTemplateIdByName,
  runCoqlQuery,
  zohoGetRecord,
  zohoListRecords,
  zohoCreateRecord,
  createFlightForLoggedUser,
  listHotelsForLoggedUser,
  listProducts,
  getProductById,
  buildShopGearsSalesOrderDraft,
  createShopGearsSalesOrder,
  getModulePicklistValues
};
