/**
 * api-contacts — External API for creating contacts.
 *
 * SEC-002: Origin-aware CORS (shared module).
 * SEC-003: Tenant ownership validation.
 * SEC-007: Uses shared error envelope, tenant scope, and CORS utilities.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { getCorsHeaders, handleCorsPreflightResponse } from "../_shared/cors.ts";
import { withErrorEnvelope, successResponse, errorResponse, ERROR_CODES } from "../_shared/errorEnvelope.ts";
import { requireTenantId } from "../_shared/tenantScope.ts";

Deno.serve(withErrorEnvelope(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed. Use POST.", ERROR_CODES.VALIDATION_ERROR, 405);
  }

  // Validate API Key
  const authHeader = req.headers.get("Authorization");
  const expectedApiKey = Deno.env.get("CONTACTS_API_KEY");

  if (!expectedApiKey) {
    console.error("CONTACTS_API_KEY not configured");
    return errorResponse(req, "Server configuration error", ERROR_CODES.INTERNAL_ERROR, 500);
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(req, "Missing or invalid Authorization header. Use: Bearer <API_KEY>", ERROR_CODES.UNAUTHORIZED, 401);
  }

  const providedApiKey = authHeader.replace("Bearer ", "");
  if (providedApiKey !== expectedApiKey) {
    return errorResponse(req, "Invalid API key", ERROR_CODES.UNAUTHORIZED, 401);
  }

  // Parse request body
  const body = await req.json();
  const { name, title, email, phone, notes, opportunity_id, tenant_id } = body;

  // SEC-003: Require and validate tenant_id
  try {
    requireTenantId(tenant_id);
  } catch {
    return errorResponse(req, "tenant_id is required and must be a valid UUID", ERROR_CODES.VALIDATION_ERROR);
  }

  // Validate required fields
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse(req, "Name is required and must be a non-empty string", ERROR_CODES.VALIDATION_ERROR);
  }

  // Validate field lengths
  if (name.length > 100) return errorResponse(req, "Name must be less than 100 characters", ERROR_CODES.VALIDATION_ERROR);
  if (title && title.length > 100) return errorResponse(req, "Title must be less than 100 characters", ERROR_CODES.VALIDATION_ERROR);
  if (email && email.length > 255) return errorResponse(req, "Email must be less than 255 characters", ERROR_CODES.VALIDATION_ERROR);
  if (phone && phone.length > 30) return errorResponse(req, "Phone must be less than 30 characters", ERROR_CODES.VALIDATION_ERROR);
  if (notes && notes.length > 2000) return errorResponse(req, "Notes must be less than 2000 characters", ERROR_CODES.VALIDATION_ERROR);

  // Basic email format validation
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(req, "Invalid email format", ERROR_CODES.VALIDATION_ERROR);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Validate tenant exists
  const { data: tenantCheck, error: tenantErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", tenant_id)
    .single();

  if (tenantErr || !tenantCheck) {
    return errorResponse(req, "Invalid tenant_id — tenant not found", ERROR_CODES.NOT_FOUND);
  }

  // Prepare contact data
  const contactData: Record<string, unknown> = {
    name: name.trim(),
    title: title?.trim() || null,
    email: email?.trim() || null,
    phone: phone?.trim() || null,
    notes: notes?.trim() || null,
    is_primary: false,
    tenant_id,
  };

  // Validate opportunity ownership if provided
  if (opportunity_id) {
    const { data: opp, error: oppError } = await supabase
      .from("opportunities")
      .select("id, tenant_id")
      .eq("id", opportunity_id)
      .single();

    if (oppError || !opp) {
      return errorResponse(req, "Invalid opportunity_id - opportunity not found", ERROR_CODES.NOT_FOUND);
    }

    if (opp.tenant_id && opp.tenant_id !== tenant_id) {
      return errorResponse(req, "opportunity_id does not belong to the specified tenant", ERROR_CODES.FORBIDDEN, 403);
    }

    contactData.opportunity_id = opportunity_id;
  }

  // Insert contact
  const { data: contact, error: insertError } = await supabase
    .from("contacts")
    .insert(contactData)
    .select()
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return errorResponse(req, "Failed to create contact", ERROR_CODES.INTERNAL_ERROR, 500);
  }

  return successResponse(req, {
    id: contact.id,
    contact_id: contact.contact_id,
    name: contact.name,
    title: contact.title,
    email: contact.email,
    phone: contact.phone,
    notes: contact.notes,
    opportunity_id: contact.opportunity_id,
    tenant_id: contact.tenant_id,
    created_at: contact.created_at,
  }, undefined, 201);
}));
