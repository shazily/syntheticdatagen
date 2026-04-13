"""Synthetic record generation using Faker; Ollama for unknown types via ollama_service."""

from __future__ import annotations

import json
import os
import sys
import uuid as uuid_lib
from typing import Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from ollama_service import OllamaService
except ImportError:
    OllamaService = None  # type: ignore[misc, assignment]

from faker import Faker

from models import FieldDefinition


class DataGenerator:
    def __init__(self) -> None:
        host = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        model = os.getenv("OLLAMA_MODEL", "llama2")
        self.ollama = OllamaService(host=host, model=model) if OllamaService else None

    def generate(
        self,
        fields: list[FieldDefinition],
        count: int,
        locale: str,
        output_format: str,
    ) -> list[dict[str, Any]]:
        """
        Generate synthetic records.
        Uses Faker for known field types; Ollama sample generation for unknown types.
        """
        fake_locale = locale.replace("_", "-")
        fake = Faker(fake_locale)
        records: list[dict[str, Any]] = []

        def phone_val(fdef: FieldDefinition) -> str:
            cc = (fdef.constraints or {}).get("country_code")
            if cc == "+971":
                return fake.numerify(text="+971 5# ### ####")
            return fake.phone_number()

        def iban_val(fdef: FieldDefinition) -> str:
            pref = (fdef.constraints or {}).get("country_prefix", "AE")
            try:
                return fake.iban() if not pref else fake.iban(country_code=str(pref))
            except Exception:
                return fake.iban()

        faker_map: dict[str, Any] = {
            "firstName": lambda fd: fake.first_name(),
            "lastName": lambda fd: fake.last_name(),
            "email": lambda fd: fake.email(),
            "phone": phone_val,
            "address": lambda fd: fake.address().replace("\n", ", "),
            "birthdate": lambda fd: fake.date_of_birth().isoformat(),
            "company": lambda fd: fake.company(),
            "jobTitle": lambda fd: fake.job(),
            "department": lambda fd: fake.random_element(
                elements=("Operations", "Finance", "HR", "Engineering", "Sales")
            ),
            "creditCard": lambda fd: fake.credit_card_number(),
            "currency": lambda fd: fake.currency_code(),
            "amount": lambda fd: round(fake.random.uniform(10, 50000), 2),
            "iban": iban_val,
            "accountNumber": lambda fd: fake.numerify(text="##########"),
            "invoiceNumber": lambda fd: fake.bothify(text="INV-####-????"),
            "taxId": lambda fd: fake.bothify(text="###-##-####"),
            "ledgerCode": lambda fd: fake.bothify(text="####-????"),
            "costCenter": lambda fd: fake.bothify(text="CC-???-###"),
            "transactionId": lambda fd: f"txn_{uuid_lib.uuid4().hex[:16]}",
            "transactionAmount": lambda fd: round(fake.random.uniform(-9999, 9999), 2),
            "paymentStatus": lambda fd: fake.random_element(
                elements=("AUTHORIZED", "CAPTURED", "SETTLED", "FAILED", "REFUNDED")
            ),
            "uuid": lambda fd: str(uuid_lib.uuid4()),
            "ipAddress": lambda fd: fake.ipv4(),
            "url": lambda fd: fake.url(),
            "username": lambda fd: fake.user_name(),
            "date": lambda fd: fake.date_between(start_date="-50y", end_date="today").isoformat(),
            "dateTime": lambda fd: fake.date_time().isoformat(),
            "integer": lambda fd: fake.random_int(1, 100000),
            "decimal": lambda fd: round(fake.random.uniform(0, 10000), 4),
            "percentage": lambda fd: round(fake.random.uniform(0, 100), 2),
            "middleName": lambda fd: fake.first_name(),
            "fullName": lambda fd: fake.name(),
            "gender": lambda fd: fake.random_element(elements=("Female", "Male", "Non-binary", "Prefer not to say")),
            "age": lambda fd: fake.random_int(18, 85),
            "nationality": lambda fd: fake.country(),
            "country": lambda fd: fake.country(),
            "city": lambda fd: fake.city(),
            "state": lambda fd: fake.state(),
            "zipCode": lambda fd: fake.zipcode(),
            "region": lambda fd: fake.state_abbr(),
            "latitude": lambda fd: str(round(fake.latitude(), 6)),
            "longitude": lambda fd: str(round(fake.longitude(), 6)),
            "timezone": lambda fd: fake.random_element(
                elements=("UTC", "America/New_York", "Europe/London", "Asia/Dubai", "Asia/Singapore")
            ),
            "website": lambda fd: fake.url(),
            "macAddress": lambda fd: fake.mac_address(),
            "userAgent": lambda fd: fake.user_agent(),
            "color": lambda fd: fake.safe_hex_color() if hasattr(fake, "safe_hex_color") else fake.hex_color(),
            "language": lambda fd: fake.language_name(),
            "brandName": lambda fd: fake.company(),
            "productName": lambda fd: fake.catch_phrase(),
            "sku": lambda fd: fake.bothify(text="???-####-??"),
            "flavorName": lambda fd: fake.random_element(
                elements=("Vanilla", "Chocolate", "Strawberry", "Mint chip", "Salted caramel", "Mango sorbet")
            ),
            "weightKg": lambda fd: round(fake.random.uniform(0.1, 25.0), 2),
            "heightCm": lambda fd: fake.random_int(120, 210),
            "bloodType": lambda fd: fake.random_element(elements=("A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-")),
            "passportNumber": lambda fd: fake.bothify(text="??######"),
            "driversLicense": lambda fd: fake.bothify(text="?##-###-####"),
            "ssnLastFour": lambda fd: fake.numerify(text="####"),
            "bankName": lambda fd: f"{fake.company()} Bank",
            "swiftCode": lambda fd: fake.bothify(text="??????##???"),
            "orderNumber": lambda fd: fake.bothify(text="ORD-########"),
            "shipmentStatus": lambda fd: fake.random_element(
                elements=("PENDING", "PICKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED")
            ),
            "shipmentTrackingId": lambda fd: fake.bothify(text="1Z################"),
            "reviewScore": lambda fd: round(fake.random.uniform(1, 5), 1),
            "text": lambda fd: fake.sentence(nb_words=8),
            "notes": lambda fd: fake.paragraph(nb_sentences=2),
            "tags": lambda fd: ", ".join(fake.words(nb=4)),
            "employeeId": lambda fd: fake.bothify(text="EMP-#####"),
            "occupation": lambda fd: fake.job(),
            "industry": lambda fd: fake.random_element(elements=("Retail", "Finance", "Healthcare", "Technology", "Hospitality")),
        }

        for _ in range(count):
            record: dict[str, Any] = {}
            for field in fields:
                gen_fn = faker_map.get(field.type)
                if gen_fn:
                    try:
                        record[field.name] = gen_fn(field)
                    except Exception:
                        record[field.name] = None
                elif self.ollama:
                    record[field.name] = self._ollama_generate_field(field)
                else:
                    record[field.name] = f"[{field.type}]"
            records.append(record)

        return records

    def _ollama_generate_field(self, field: FieldDefinition) -> Any:
        """Fallback: ask Ollama for one structured sample row and read the column."""
        if not self.ollama:
            return None
        try:
            schema = [
                {
                    "name": field.name,
                    "type": field.type,
                    "description": f"Synthetic {field.type} value",
                }
            ]
            samples = self.ollama.generate_data_samples(schema, 1)
            if samples and isinstance(samples[0], dict) and field.name in samples[0]:
                return samples[0][field.name]
        except Exception:
            return None
        return None


def format_output(records: list[dict[str, Any]], output_format: str) -> Any:
    """Return payload fragment for non-JSON transports."""
    if output_format == "csv":
        if not records:
            return ""
        keys = list(records[0].keys())
        lines = [",".join(keys)]
        for row in records:
            vals = []
            for k in keys:
                v = row.get(k)
                s = json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)
                if "," in s or '"' in s:
                    s = '"' + s.replace('"', '""') + '"'
                vals.append(s)
            lines.append(",".join(vals))
        return "\n".join(lines)
    if output_format == "jsonl":
        return "\n".join(json.dumps(r, ensure_ascii=False) for r in records)
    return None
