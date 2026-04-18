"""
Data-contract schemas for /validate and /generate.

These models are intentionally strict (extra="forbid") so agent clients
cannot pass silent typos that later become expensive generation failures.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DataContractField(BaseModel):
    """One requested output column in the synthetic dataset."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    name: str = Field(
        ...,
        min_length=1,
        max_length=120,
        description="Stable output field name (snake_case recommended).",
    )
    type: str = Field(
        ...,
        min_length=1,
        max_length=120,
        description="Canonical type key from /api/v1/field-types.",
    )
    locale: str | None = Field(
        default=None,
        description="Optional per-field locale override (inherits request locale when absent).",
    )
    constraints: dict[str, Any] | None = Field(
        default=None,
        description="Optional type-specific constraints (e.g. country_code for phone).",
    )
    blankPercentage: float | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Optional chance (0-100) to emit null values for this field.",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Field name cannot be blank.")
        return normalized

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Field type cannot be blank.")
        return normalized


class ValidateDataContractRequest(BaseModel):
    """Strict request contract for POST /api/v1/validate."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    schema_fields: list[DataContractField] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Target schema to validate before generation.",
    )
    count: int = Field(
        default=10,
        ge=1,
        le=10000,
        description="Requested record count (validated against tier limits server-side).",
    )
    locale: Literal["en_US", "en_AE", "en_GB", "ar_AE"] = Field(
        default="en_US",
        description="Default locale for fields that do not override locale.",
    )


class ValidateDataContractResponse(BaseModel):
    """Canonical success payload returned by /validate when schema passes checks."""

    model_config = ConfigDict(extra="forbid")

    valid: Literal[True] = True
    field_count: int = Field(..., ge=1)
    estimated_records: int = Field(..., ge=1)
