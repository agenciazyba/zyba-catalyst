const { sendJson, getRequestBody } = require("../utils/http");
const { getSessionTokenFromRequest } = require("../utils/helpers");
const { getSession } = require("../services/session");
const {
  getTravelerByEmail,
  getTripsByLoggedUser,
  getTripDetailsById,
  getTripRequirementsById,
  acknowledgeTripRequirements,
  streamZohoFile,
  streamZohoRecordPhoto
} = require("../services/zoho");

async function handleCrmRoutes(app, req, res, parsedUrl) {
  const path = parsedUrl.pathname;
  const method = (req.method || "GET").toUpperCase();

  if (method === "GET" && path === "/crm/travelers") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    const traveler = await getTravelerByEmail(session.email);

    if (!traveler) {
      sendJson(res, 404, { ok: false, error: "Traveler not found for logged user" });
      return true;
    }

    sendJson(res, 200, {
      ok: true,
      data: traveler
    });
    return true;
  }

  if (method === "GET" && path === "/crm/trips") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    const trips = await getTripsByLoggedUser(session.email);

    sendJson(res, 200, {
      ok: true,
      data: trips
    });
    return true;
  }

  const debugMatch = path.match(/^\/crm\/debug-deals$/);
  if (method === "GET" && debugMatch) {
    const { zohoGetRecord, zohoListRecords } = require("../services/zoho");
    try {
      const resData = await zohoListRecords("Sales_Orders", ["Deal_Name"], 1, 1);
      const dealId = resData[0].Deal_Name.id;
      const deal = await zohoGetRecord("Deals", dealId);
      sendJson(res, 200, { keys: Object.keys(deal), Deal_Cover: deal.Deal_Cover || "NOT_FOUND" });
    } catch(e) {
      sendJson(res, 500, { error: e.message });
    }
    return true;
  }

  const debugFile = path.match(/^\/crm\/debug-file$/);
  if (method === "GET" && debugFile) {
    const { streamZohoFile } = require("../services/zoho");
    await streamZohoFile("sg4s8e3b46c3b081340d0bc01582f1eab4cd3", res);
    return true;
  }

  const fileMatch = path.match(/^\/crm\/files\/([^/]+)$/);

  if (method === "GET" && fileMatch) {
    const fileId = fileMatch[1];
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    let zModule = "Deals";
    let zRecord = "";
    let zAttach = fileId;
    
    if (fileId.includes("_")) {
      const parts = fileId.split("_");
      if (parts.length >= 2) {
        zModule = parts[0];
        zRecord = parts[1];
        zAttach = parts.slice(2).join("_");
      }
    }

    try {
      if (zModule === "Accounts" && zRecord) {
        await streamZohoRecordPhoto(zModule, zRecord, res);
      } else {
        await streamZohoFile(zModule, zRecord, zAttach, res);
      }
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message || "Failed to download file" });
    }
    return true;
  }

  const acknowledgeMatch = path.match(/^\/crm\/trips\/([^/]+)\/requirements\/acknowledge$/);

  if (method === "POST" && acknowledgeMatch) {
    const tripId = acknowledgeMatch[1];
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    const body = await getRequestBody(req);
    const version = body.version || null;

    const updatedTrip = await acknowledgeTripRequirements(tripId, session.email, version);

    if (!updatedTrip) {
      sendJson(res, 404, { ok: false, error: "Trip not found for logged user" });
      return true;
    }

    sendJson(res, 200, {
      ok: true,
      data: updatedTrip
    });
    return true;
  }

  const tripRequirementsMatch = path.match(/^\/crm\/trips\/([^/]+)\/requirements$/);

  if (method === "GET" && tripRequirementsMatch) {
    const tripId = tripRequirementsMatch[1];
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    const requirements = await getTripRequirementsById(tripId, session.email);

    if (!requirements) {
      sendJson(res, 404, { ok: false, error: "Trip not found for logged user" });
      return true;
    }

    sendJson(res, 200, {
      ok: true,
      data: requirements
    });
    return true;
  }

  const tripDetailMatch = path.match(/^\/crm\/trips\/([^/]+)$/);

  if (method === "GET" && tripDetailMatch) {
    const tripId = tripDetailMatch[1];
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    const tripDetails = await getTripDetailsById(tripId, session.email);

    if (!tripDetails) {
      sendJson(res, 404, { ok: false, error: "Trip not found for logged user" });
      return true;
    }

    sendJson(res, 200, {
      ok: true,
      data: tripDetails
    });
    return true;
  }

  return false;
}

module.exports = {
  handleCrmRoutes
};
