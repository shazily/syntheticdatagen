"""Pydantic models; every field includes description= for agent tool docs."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FieldDefinition(BaseModel):
    """A single field in the data generation schema."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    name: str = Field(
        ...,
        description="Output column name. Use snake_case. e.g. 'customer_email'",
    )
    type: str = Field(
        ...,
        description="Field type key from GET /capabilities. e.g. 'email', 'phone', 'iban', 'uuid'",
    )
    locale: str | None = Field(
        None,
        description="Locale override for this field. Inherits request locale if absent. e.g. 'en_AE'",
    )
    constraints: dict[str, Any] | None = Field(
        None,
        description="Type-specific constraints. e.g. {'country_code': '+971'} for UAE phone. See /capabilities for per-type constraints.",
    )
    blankPercentage: float | None = Field(
        None,
        description="Optional 0–100 chance the value is null (matches n8n simple-generator field option).",
    )


class GenerationRequest(BaseModel):
    """
    Request body for POST /api/v1/generate.

    Dual-compatible: accepts legacy n8n keys (`schema`, `recordCount`, `exportFormat`)
    and new API keys (`schema_fields`, `count`, `output_format`).
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_keys(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        out = {**data}
        if "schema_fields" not in out and "schema" in out:
            out["schema_fields"] = out.pop("schema")
        if "count" not in out and "recordCount" in out:
            out["count"] = out.pop("recordCount")
        if "output_format" not in out and "exportFormat" in out:
            out["output_format"] = out.pop("exportFormat")
        if "count" not in out and "num_rows" in out:
            out["count"] = out.pop("num_rows")
        return out

    schema_fields: list[FieldDefinition] = Field(
        ...,
        description="List of fields to generate. Minimum 1, maximum 50. Call GET /capabilities to see all available field types. JSON key `schema` is accepted (n8n / frontend).",
    )
    count: int = Field(
        10,
        ge=1,
        le=10000,
        description="Number of records. Free tier max: 100. Pro max: 5000. x402 max: 10000. JSON key `recordCount` accepted.",
    )
    locale: str = Field(
        "en_US",
        description="Default locale for all fields. Supported: en_US, en_AE, en_GB, ar_AE. Affects phone format, address style, currency.",
    )
    output_format: Literal["json", "csv", "jsonl", "excel", "xml"] = Field(
        "json",
        description='Response shape. Matches frontend exportFormat: csv, json, jsonl, excel, xml (excel/xml return JSON records).',
    )
    sampleData: list[dict[str, Any]] | None = Field(
        None,
        description="Optional sample rows from Schema Builder / AI mode (n8n contract); ignored by this API for now.",
    )
    fieldPatterns: dict[str, list[Any]] | None = Field(
        None,
        description="Optional pattern map from AI mode (n8n contract); ignored by this API for now.",
    )


class ConversationalError(BaseModel):
    """Structured error for Accept: application/vnd.agentic+json clients."""

    error: bool = Field(True, description="Always true for this error shape.")
    field: str | None = Field(
        None,
        description="Which schema field caused this error, if applicable.",
    )
    message: str = Field(
        ...,
        description="Natural language explanation of what went wrong.",
    )
    correction_hint: str = Field(
        ...,
        description="Specific actionable instruction to fix the problem.",
    )
    suggested_fix: dict[str, Any] | None = Field(
        None,
        description="Corrected FieldDefinition fragment ready to substitute into the request.",
    )
    upgrade_required: bool = Field(
        False,
        description="True if this error is caused by tier limits.",
    )
    upgrade_url: str | None = Field(
        None,
        description="Upgrade page URL when upgrade_required is True.",
    )


class GenerationResponse(BaseModel):
    """Successful generation payload (JSON body)."""

    records: list[dict[str, Any]] = Field(
        ...,
        description="Generated data records.",
    )
    count: int = Field(..., description="Number of records returned.")
    locale: str = Field(..., description="Locale used for generation.")
    tier: str = Field(
        ...,
        description="Which access tier served this request: free, pro, enterprise, or x402.",
    )
    usage: dict[str, Any] = Field(
        ...,
        description="Usage summary: {calls_today, calls_remaining, records_today}. For x402 calls, shows payment_hash instead.",
    )
    generation_id: str = Field(
        ...,
        description="UUID for debugging and support.",
    )
    output_format: str = Field(
        "json",
        description="Echo of requested output_format / exportFormat.",
    )


class FieldTypeDefinition(BaseModel):
    """One supported synthetic field type."""

    name: str = Field(
        ...,
        description="Type key to use in schema_fields[].type",
    )
    category: str = Field(..., description="High-level grouping for tier gating.")
    description: str = Field(
        ...,
        description="What this field generates. Written for LLM consumption.",
    )
    example_value: str = Field(
        ...,
        description="Example of a generated value.",
    )
    required_constraints: list[str] = Field(
        default_factory=list,
        description="Constraint keys that must appear on the field for some locales/types.",
    )
    locale_notes: str | None = Field(
        None,
        description="Locale-specific notes for agents.",
    )
    tier_required: str = Field(
        "free",
        description="Minimum tier needed to use this field type.",
    )


class AiGenerateRequest(BaseModel):
    """
    AI mode: provide column names only; the service infers canonical types and generates values via LLM.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    field_names: list[str] = Field(
        ...,
        min_length=1,
        max_length=80,
        description="Output column names (snake_case or camelCase). Types are inferred; values are AI-generated.",
    )
    count: int = Field(
        10,
        ge=1,
        le=100000,
        description="Rows to generate. Free tier: max 100 for AI mode. Pro/Enterprise: higher limits.",
    )
    locale: str = Field(
        "en_US",
        description="Default locale hint for the model (en_US, en_AE, en_GB, ar_AE).",
    )
    output_format: Literal["json", "csv", "jsonl"] = Field(
        "json",
        description="Response serialization for records.",
    )
    domain_hint: str | None = Field(
        None,
        max_length=2000,
        description="Optional short context (e.g. 'UAE ice cream shops') to steer type inference.",
    )


class CapabilityManifest(BaseModel):
    """
    Machine-readable capability description scoped to the caller's tier.
    """

    api_version: str = Field(..., description="API semantic version string.")
    tier: str = Field(..., description="Tier this manifest was computed for.")
    available_field_types: list[FieldTypeDefinition] = Field(
        ...,
        description="Field types visible for this tier.",
    )
    supported_locales: list[dict[str, Any]] = Field(
        ...,
        description="Locales with optional notes.",
    )
    limits: dict[str, Any] = Field(..., description="Effective tier limits.")
    example_requests: list[dict[str, Any]] = Field(
        ...,
        description="Copy-paste examples for agents.",
    )
    payment_options: dict[str, Any] = Field(
        ...,
        description="Both API key tiers and x402 per-call pricing.",
    )
