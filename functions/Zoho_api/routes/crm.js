const { sendJson, getRequestBody } = require("../utils/http");
const { getSessionTokenFromRequest } = require("../utils/helpers");
const { getSession } = require("../services/session");
const {
  getTravelerByEmail,
  getTripsByLoggedUser,
  getProductOrdersByLoggedUser,
  getTripDetailsById,
  getTripRequirementsById,
  acknowledgeTripRequirements,
  createFlightForLoggedUser,
  listHotelsForLoggedUser,
  listProducts,
  getProductById,
  buildShopGearsSalesOrderDraft,
  createShopGearsSalesOrder,
  getModulePicklistValues,
  streamZohoFile,
  streamZohoRecordPhoto,
  streamSalesOrderPdf,
  getInventoryTemplateIdByName
} = require("../services/zoho");
const {
  buildSessionCartOwnerKey,
  getCart,
  addCartItem,
  setCartItemQuantity,
  removeCartItem,
  clearCart,
  replaceCart,
} = require("../services/cart");
const {
  createCheckoutSession,
  getCheckoutSession,
  getCheckoutSessionLineItems,
} = require("../services/stripe");
const {
  getCheckoutStatusByTrip,
  setCheckoutStatus,
  clearCheckoutStatus,
} = require("../services/checkout-state");

async function buildTrustedCartItem(productId, fallbackItem = {}) {
  const safeProductId = String(productId || "").trim();
  if (!safeProductId) {
    throw new Error("Missing productId");
  }

  const product = await getProductById(safeProductId, {});

  if (!product) {
    throw new Error("Product not found");
  }

  if (typeof product.unitPrice !== "number" || !Number.isFinite(product.unitPrice) || product.unitPrice < 0) {
    throw new Error(`Product ${safeProductId} does not have a valid price`);
  }

  return {
    productId: safeProductId,
    productName: String(product.productName || fallbackItem.productName || "Product").trim(),
    productCode: String(product.productCode || fallbackItem.productCode || "").trim() || null,
    unitPrice: product.unitPrice,
    imageDownloadKey:
      String(
        product?.productImageCatalog?.[0]?.downloadKey ||
          product?.productImageReal?.[0]?.downloadKey ||
          fallbackItem.imageDownloadKey ||
          ""
      ).trim() || null,
    imageAlt:
      String(
        product?.productImageCatalog?.[0]?.fileName ||
          product?.productImageReal?.[0]?.fileName ||
          fallbackItem.imageAlt ||
          product.productName ||
          ""
      ).trim() || null,
    category: String(product?.category || fallbackItem.category || "").trim() || null,
    vendorName: String(product?.vendorName?.name || fallbackItem.vendorName || "").trim() || null,
  };
}

async function buildTrustedCartItems(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  return Promise.all(
    items.map(async (item) => {
      const trusted = await buildTrustedCartItem(item?.productId, item || {});
      return {
        ...trusted,
        quantity: item?.quantity,
      };
    })
  );
}

function buildCartSnapshot(tripId, items) {
  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = safeItems.reduce((sum, item) => {
    const unitPrice = typeof item?.unitPrice === "number" ? item.unitPrice : Number(item?.unitPrice || 0);
    const quantity = Math.max(0, Math.floor(Number(item?.quantity) || 0));
    return sum + unitPrice * quantity;
  }, 0);
  const totalItems = safeItems.reduce(
    (sum, item) => sum + Math.max(0, Math.floor(Number(item?.quantity) || 0)),
    0
  );

  return {
    tripId,
    items: safeItems,
    subtotal,
    totalItems,
    updatedAt: new Date().toISOString(),
  };
}

function buildCartSnapshotFromStripeLineItems(tripId, lineItems) {
  const items = Array.isArray(lineItems?.data)
    ? lineItems.data
        .map((lineItem) => {
          const product = lineItem?.price?.product || {};
          const metadata = product?.metadata || {};
          const productId = String(metadata.productId || "").trim();
          const productName = String(product.name || lineItem.description || "").trim();
          const quantity = Math.max(0, Math.floor(Number(lineItem.quantity) || 0));
          const unitAmount = Number(lineItem?.price?.unit_amount);
          const unitPrice = Number.isFinite(unitAmount) ? unitAmount / 100 : null;

          if (!productId || !productName || quantity <= 0 || unitPrice === null) {
            return null;
          }

          const brandMatch = String(product.description || "").match(/^Brand:\s*(.+)$/i);

          return {
            productId,
            productName,
            productCode: String(metadata.productCode || "").trim() || null,
            category: null,
            unitPrice,
            quantity,
            imageDownloadKey: null,
            imageAlt: productName,
            vendorName: brandMatch?.[1]?.trim() || null,
          };
        })
        .filter(Boolean)
    : [];

  return buildCartSnapshot(tripId, items);
}

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

  if (method === "GET" && path === "/crm/orders") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    try {
      const orders = await getProductOrdersByLoggedUser(session.email);
      sendJson(res, 200, {
        ok: true,
        data: orders,
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || "Failed to load orders",
      });
    }

    return true;
  }

  const productOrderPdfMatch = path.match(/^\/crm\/orders\/([^/]+)\/pdf$/);

  if (method === "GET" && productOrderPdfMatch) {
    const orderId = productOrderPdfMatch[1];
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    const orders = await getProductOrdersByLoggedUser(session.email);
    const order = orders.find((item) => String(item.id) === String(orderId));

    if (!order) {
      sendJson(res, 404, { ok: false, error: "Order not found for logged user" });
      return true;
    }

    const requestedTemplateName =
      parsedUrl.searchParams.get("templateName") ||
      process.env.PRODUCT_ORDER_TEMPLATE_NAME ||
      "Product Order";
    const templateId =
      parsedUrl.searchParams.get("templateId") ||
      process.env.PRODUCT_ORDER_TEMPLATE_ID ||
      (await getInventoryTemplateIdByName(requestedTemplateName, "Sales_Orders"));

    if (!templateId) {
      sendJson(res, 400, {
        ok: false,
        error:
          `Missing Product Order template. Set PRODUCT_ORDER_TEMPLATE_ID or create an inventory template named ${requestedTemplateName}.`,
      });
      return true;
    }

    try {
      await streamSalesOrderPdf(templateId, orderId, res);
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message || "Failed to download Order PDF" });
    }

    return true;
  }

  if (method === "POST" && path === "/crm/flights") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    try {
      const body = await getRequestBody(req);
      const flight = await createFlightForLoggedUser(session.email, body);

      if (!flight) {
        sendJson(res, 404, { ok: false, error: "Traveler not found for logged user" });
        return true;
      }

      sendJson(res, 201, {
        ok: true,
        data: flight
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "Failed to create flight"
      });
    }

    return true;
  }

  if (method === "GET" && path === "/crm/hotels") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    try {
      const hotels = await listHotelsForLoggedUser(session.email, {
        tripId: parsedUrl.searchParams.get("tripId"),
      });

      if (!hotels) {
        sendJson(res, 404, { ok: false, error: "Trip not found for logged user" });
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        data: hotels,
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "Failed to load hotels",
      });
    }

    return true;
  }

  if (method === "GET" && path === "/crm/products") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    try {
      const data = await listProducts({
        page: parsedUrl.searchParams.get("page"),
        perPage: parsedUrl.searchParams.get("perPage"),
        layout: parsedUrl.searchParams.get("layout"),
        category: parsedUrl.searchParams.get("category"),
        productActive: parsedUrl.searchParams.get("productActive"),
        search: parsedUrl.searchParams.get("search"),
        vendorName: parsedUrl.searchParams.get("vendorName"),
        destinationRelated: parsedUrl.searchParams.get("destinationRelated"),
        destinationRelatedId: parsedUrl.searchParams.get("destinationRelatedId"),
      });

      sendJson(res, 200, { ok: true, data });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || "Failed to list products",
      });
    }

    return true;
  }

  if (method === "GET" && path === "/crm/products/categories") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    try {
      const data = await getModulePicklistValues("Products", "Category");
      sendJson(res, 200, { ok: true, data });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || "Failed to list product categories",
      });
    }

    return true;
  }

  if (method === "GET" && path === "/crm/cart") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    const tripId = String(parsedUrl.searchParams.get("tripId") || "").trim();

    if (!tripId) {
      sendJson(res, 400, { ok: false, error: "tripId is required" });
      return true;
    }

    try {
      const cart = await getCart(app, buildSessionCartOwnerKey(token), tripId);
      sendJson(res, 200, { ok: true, data: cart });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || "Failed to load cart",
      });
    }

    return true;
  }

  if (method === "GET" && path === "/crm/checkout/status") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    const tripId = String(parsedUrl.searchParams.get("tripId") || "").trim();

    if (!tripId) {
      sendJson(res, 400, { ok: false, error: "tripId is required" });
      return true;
    }

    try {
      let status = await getCheckoutStatusByTrip(app, tripId);

      // `paid_finalized` represents a completed prior checkout and should not
      // keep blocking a future order cycle for the same trip.
      if (status?.status === "paid_finalized") {
        status = await clearCheckoutStatus(app, tripId, status.checkoutSessionId || "");
      }

      sendJson(res, 200, { ok: true, data: status });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || "Failed to load checkout status",
      });
    }

    return true;
  }

  if (method === "DELETE" && path === "/crm/cart") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    const tripId = String(parsedUrl.searchParams.get("tripId") || "").trim();

    if (!tripId) {
      sendJson(res, 400, { ok: false, error: "tripId is required" });
      return true;
    }

    try {
      const cart = await clearCart(app, buildSessionCartOwnerKey(token), tripId);
      sendJson(res, 200, { ok: true, data: cart });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || "Failed to clear cart",
      });
    }

    return true;
  }

  if (method === "POST" && path === "/crm/cart/items") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    try {
      const body = await getRequestBody(req);
      const tripId = String(body?.tripId || "").trim();

      if (!tripId) {
        sendJson(res, 400, { ok: false, error: "tripId is required" });
        return true;
      }

      const checkoutStatus = await getCheckoutStatusByTrip(app, tripId);
      if (checkoutStatus?.status === "paid_finalized") {
        await clearCheckoutStatus(app, tripId, checkoutStatus.checkoutSessionId || "");
      }

      const trustedItem = await buildTrustedCartItem(body?.item?.productId, body?.item || {});
      const cart = await addCartItem(app, buildSessionCartOwnerKey(token), tripId, trustedItem, body?.quantity);
      sendJson(res, 200, { ok: true, data: cart });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error?.message || String(error) || "Failed to add cart item",
      });
    }

    return true;
  }

  if (method === "POST" && path === "/crm/checkout/session") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    try {
      const body = await getRequestBody(req);
      const tripId = String(body?.tripId || "").trim();

      if (!tripId) {
        sendJson(res, 400, { ok: false, error: "tripId is required" });
        return true;
      }

      const cart = await getCart(app, buildSessionCartOwnerKey(token), tripId);

      if (!cart?.items?.length) {
        sendJson(res, 400, { ok: false, error: "Cart is empty" });
        return true;
      }

      const trustedItems = await buildTrustedCartItems(cart.items);
      const trustedCart = await replaceCart(app, buildSessionCartOwnerKey(token), tripId, trustedItems);

      const origin =
        String(req.headers.origin || "").trim() ||
        `${req.headers["x-forwarded-proto"] || "http"}://${req.headers["x-forwarded-host"] || req.headers.host}`;

      const checkoutSession = await createCheckoutSession({
        cart: trustedCart,
        tripId,
        customerEmail: session.email,
        cartOwnerKey: buildSessionCartOwnerKey(token),
        origin,
      });

      await setCheckoutStatus(app, {
        tripId,
        status: "pending",
        checkoutSessionId: checkoutSession.id || null,
        paymentStatus: "unpaid",
        stripeEventId: null,
        amountTotal: trustedCart.subtotal,
        currency: "usd",
        customerEmail: session.email,
        cartSnapshot: trustedCart,
      });

      sendJson(res, 200, {
        ok: true,
        data: {
          id: checkoutSession.id || null,
          url: checkoutSession.url || null,
        },
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error?.message || "Failed to create checkout session",
      });
    }

    return true;
  }

  if (method === "POST" && path === "/crm/checkout/sales-order/dry-run") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    try {
      const body = await getRequestBody(req);
      const tripId = String(body?.tripId || "").trim();

      if (!tripId) {
        sendJson(res, 400, { ok: false, error: "tripId is required" });
        return true;
      }

      const cart = await getCart(app, buildSessionCartOwnerKey(token), tripId);

      if (!cart?.items?.length) {
        sendJson(res, 400, { ok: false, error: "Cart is empty" });
        return true;
      }

      const trustedItems = await buildTrustedCartItems(cart.items);
      const cartSnapshot = buildCartSnapshot(tripId, trustedItems);
      const dryRunSessionId = `dry_run_${Date.now()}`;
      const draft = await buildShopGearsSalesOrderDraft({
        tripId,
        checkoutStatus: {
          tripId,
          checkoutSessionId: dryRunSessionId,
          paymentStatus: "paid",
          amountTotal: cartSnapshot.subtotal,
          currency: "usd",
          customerEmail: session.email,
          cartSnapshot,
        },
        stripeSession: {
          id: dryRunSessionId,
          payment_status: "paid",
          amount_total: Math.round(cartSnapshot.subtotal * 100),
          currency: "usd",
          payment_intent: "dry_run",
        },
      });

      sendJson(res, 200, {
        ok: true,
        data: {
          dryRun: true,
          createsZohoRecord: false,
          ...draft,
        },
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error?.message || "Failed to build Sales Order dry run",
      });
    }

    return true;
  }

  if (method === "POST" && path === "/crm/checkout/finalize") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    try {
      const body = await getRequestBody(req);
      const tripId = String(body?.tripId || "").trim();
      const sessionId = String(body?.sessionId || "").trim();

      if (!tripId) {
        sendJson(res, 400, { ok: false, error: "tripId is required" });
        return true;
      }

      let checkoutStatus = await getCheckoutStatusByTrip(app, tripId);
      let stripeSession = null;
      let isPaid =
        checkoutStatus?.status === "paid" || checkoutStatus?.paymentStatus === "paid";

      if (!isPaid && sessionId) {
        stripeSession = await getCheckoutSession(sessionId);
        const stripeTripId = String(
          stripeSession?.metadata?.tripId || stripeSession?.client_reference_id || ""
        ).trim();

        if (stripeTripId && stripeTripId !== tripId) {
          sendJson(res, 409, {
            ok: false,
            error: "Stripe session does not match this trip",
          });
          return true;
        }

        if (stripeSession?.payment_status === "paid") {
          checkoutStatus = await setCheckoutStatus(app, {
            tripId,
            status: "paid",
            checkoutSessionId: stripeSession?.id || checkoutStatus.checkoutSessionId || null,
            paymentStatus: stripeSession?.payment_status || null,
            stripeEventId: checkoutStatus.stripeEventId || null,
            amountTotal:
              typeof stripeSession?.amount_total === "number" && Number.isFinite(stripeSession.amount_total)
                ? stripeSession.amount_total / 100
                : checkoutStatus.amountTotal ?? null,
            currency: stripeSession?.currency || checkoutStatus.currency || null,
            customerEmail:
              stripeSession?.customer_details?.email ||
              stripeSession?.customer_email ||
              checkoutStatus.customerEmail ||
              null,
            cartSnapshot: checkoutStatus.cartSnapshot || null,
            salesOrder: checkoutStatus.salesOrder || null,
            salesOrderError: checkoutStatus.salesOrderError || null,
          });
          isPaid = true;
        }
      }

      if (!isPaid) {
        sendJson(res, 409, {
          ok: false,
          error: "Checkout is not confirmed as paid yet",
        });
        return true;
      }

      if (!stripeSession && (sessionId || checkoutStatus.checkoutSessionId)) {
        stripeSession = await getCheckoutSession(sessionId || checkoutStatus.checkoutSessionId);
      }

      if (!checkoutStatus.cartSnapshot?.items?.length) {
        const fallbackCart = await getCart(app, buildSessionCartOwnerKey(token), tripId);
        if (fallbackCart?.items?.length) {
          checkoutStatus = await setCheckoutStatus(app, {
            ...checkoutStatus,
            tripId,
            cartSnapshot: fallbackCart,
          });
        }
      }

      if (!checkoutStatus.cartSnapshot?.items?.length && stripeSession?.id) {
        const stripeLineItems = await getCheckoutSessionLineItems(stripeSession.id);
        const cartSnapshot = buildCartSnapshotFromStripeLineItems(tripId, stripeLineItems);
        if (cartSnapshot?.items?.length) {
          checkoutStatus = await setCheckoutStatus(app, {
            ...checkoutStatus,
            tripId,
            cartSnapshot,
          });
        }
      }

      const salesOrder =
        checkoutStatus.salesOrder ||
        (await createShopGearsSalesOrder({
          tripId,
          checkoutStatus,
          stripeSession,
        }));

      const finalizedSummary = {
        tripId,
        checkoutSessionId: checkoutStatus.checkoutSessionId || null,
        paymentStatus: checkoutStatus.paymentStatus || null,
        amountTotal: checkoutStatus.amountTotal ?? null,
        currency: checkoutStatus.currency || null,
        customerEmail: checkoutStatus.customerEmail || null,
        stripeEventId: checkoutStatus.stripeEventId || null,
        salesOrder,
        finalizedAt: checkoutStatus.finalizedAt || new Date().toISOString(),
      };

      await clearCart(app, buildSessionCartOwnerKey(token), tripId);
      await setCheckoutStatus(app, {
        ...checkoutStatus,
        tripId,
        status: "paid_finalized",
        salesOrder,
        salesOrderError: null,
        finalizedAt: finalizedSummary.finalizedAt,
      });

      sendJson(res, 200, {
        ok: true,
        data: finalizedSummary,
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error?.message || "Failed to finalize checkout",
      });
    }

    return true;
  }

  const cartItemMatch = path.match(/^\/crm\/cart\/items\/([^/]+)$/);

  if (method === "PATCH" && cartItemMatch) {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    try {
      const body = await getRequestBody(req);
      const tripId = String(body?.tripId || "").trim();
      const productId = decodeURIComponent(cartItemMatch[1] || "");

      if (!tripId) {
        sendJson(res, 400, { ok: false, error: "tripId is required" });
        return true;
      }

      const cart = await setCartItemQuantity(
        app,
        buildSessionCartOwnerKey(token),
        tripId,
        productId,
        body?.quantity
      );
      sendJson(res, 200, { ok: true, data: cart });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "Failed to update cart item",
      });
    }

    return true;
  }

  if (method === "DELETE" && cartItemMatch) {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    const tripId = String(parsedUrl.searchParams.get("tripId") || "").trim();
    const productId = decodeURIComponent(cartItemMatch[1] || "");

    if (!tripId) {
      sendJson(res, 400, { ok: false, error: "tripId is required" });
      return true;
    }

    try {
      const cart = await removeCartItem(app, buildSessionCartOwnerKey(token), tripId, productId);
      sendJson(res, 200, { ok: true, data: cart });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || "Failed to remove cart item",
      });
    }

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
      const match = fileId.match(/^(.+)_([^_]+)_([^_]+)$/);
      if (match) {
        zModule = match[1];
        zRecord = match[2];
        zAttach = match[3];
      }
    }

    try {
      if ((zModule === "Accounts" && zRecord) || (zAttach === "photo" && zRecord)) {
        await streamZohoRecordPhoto(zModule, zRecord, res);
      } else {
        await streamZohoFile(zModule, zRecord, zAttach, res);
      }
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message || "Failed to download file" });
    }
    return true;
  }

  const productDetailMatch = path.match(/^\/crm\/products\/([^/]+)$/);

  if (method === "GET" && productDetailMatch) {
    const productId = productDetailMatch[1];
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    try {
      const product = await getProductById(productId, {
        layout: parsedUrl.searchParams.get("layout"),
        category: parsedUrl.searchParams.get("category"),
      });

      if (!product) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        data: {
          product,
        },
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || "Failed to load product",
      });
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

  const tripSalesOrderPdfMatch = path.match(/^\/crm\/trips\/([^/]+)\/sales-order\/pdf$/);

  if (method === "GET" && tripSalesOrderPdfMatch) {
    const tripId = tripSalesOrderPdfMatch[1];
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session || !session.email) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return true;
    }

    const tripDetails = await getTripDetailsById(tripId, session.email);
    if (!tripDetails || !tripDetails.trip?.id) {
      sendJson(res, 404, { ok: false, error: "Trip not found for logged user" });
      return true;
    }

    const templateId =
      parsedUrl.searchParams.get("templateId") ||
      process.env.SALES_ORDER_TEMPLATE_ID ||
      "";

    if (!templateId) {
      sendJson(res, 400, {
        ok: false,
        error: "Missing templateId. Set query param templateId or SALES_ORDER_TEMPLATE_ID env var.",
      });
      return true;
    }

    try {
      await streamSalesOrderPdf(templateId, tripId, res);
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message || "Failed to download Sales Order PDF" });
    }
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
