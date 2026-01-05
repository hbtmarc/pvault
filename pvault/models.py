"""Data models for financial records."""

from datetime import datetime
from decimal import Decimal
from typing import Optional


class FinancialRecord:
    """Represents a single financial record."""

    def __init__(
        self,
        record_id: str,
        category: str,
        amount: Decimal,
        description: str,
        date: datetime,
        tags: Optional[list] = None
    ):
        self.record_id = record_id
        self.category = category
        self.amount = amount
        self.description = description
        self.date = date
        self.tags = tags or []

    def to_dict(self):
        """Convert record to dictionary."""
        return {
            "record_id": self.record_id,
            "category": self.category,
            "amount": str(self.amount),
            "description": self.description,
            "date": self.date.isoformat(),
            "tags": self.tags
        }

    @classmethod
    def from_dict(cls, data):
        """Create record from dictionary."""
        return cls(
            record_id=data["record_id"],
            category=data["category"],
            amount=Decimal(data["amount"]),
            description=data["description"],
            date=datetime.fromisoformat(data["date"]),
            tags=data.get("tags", [])
        )
