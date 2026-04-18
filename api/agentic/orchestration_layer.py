"""
Reference orchestration flow for agentic generation lifecycle.

validate -> generate request -> 402 invoice -> escrow lock confirmation -> generation -> lineage.
"""

from __future__ import annotations

from dataclasses import dataclass

from .lineage import LineageReceipt, issue_lineage_receipt
from .schemas import ValidateDataContractRequest
from .settlement_guard import SettlementContext, guard_settlement_before_generation


@dataclass(frozen=True)
class OrchestrationResult:
    records: list[dict]
    lineage_receipt: LineageReceipt
    settlement_meta: dict


class AgenticOrchestrator:
    """
    Composable orchestrator.

    Generation callable contract:
      async def generate_fn(request: ValidateDataContractRequest) -> list[dict]
    """

    def __init__(self, generate_fn):
        self._generate_fn = generate_fn

    async def execute(
        self,
        *,
        data_contract: ValidateDataContractRequest,
        agent_address: str,
        nonce: int,
        payment_tx_hash: str,
        expected_amount_micro_usdc: int,
        generation_engine: str,
        model_version: str,
    ) -> OrchestrationResult:
        settlement_meta = await guard_settlement_before_generation(
            SettlementContext(
                agent_address=agent_address,
                nonce=nonce,
                payment_tx_hash=payment_tx_hash,
                expected_amount_micro_usdc=expected_amount_micro_usdc,
            )
        )

        records = await self._generate_fn(data_contract)
        field_names = [field.name for field in data_contract.schema_fields]
        lineage_receipt = issue_lineage_receipt(
            generation_engine=generation_engine,
            model_version=model_version,
            field_names=field_names,
            record_count=len(records),
        )

        return OrchestrationResult(
            records=records,
            lineage_receipt=lineage_receipt,
            settlement_meta=settlement_meta,
        )
