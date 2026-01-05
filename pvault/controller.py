"""Finance controller for managing financial records."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from .models import FinancialRecord
from .storage import SecureStorage


class FinanceController:
    """Main controller for personal vault finance management."""

    def __init__(self, vault_path: str, password: str):
        """Initialize the finance controller.
        
        Args:
            vault_path: Path to the vault storage file
            password: Password for vault encryption
        """
        self.storage = SecureStorage(vault_path, password)
        self.records = []
        self._load_records()

    def _load_records(self):
        """Load records from storage."""
        data = self.storage.load()
        self.records = [
            FinancialRecord.from_dict(record_data)
            for record_data in data.get("records", [])
        ]

    def _save_records(self):
        """Save records to storage."""
        data = {
            "records": [record.to_dict() for record in self.records]
        }
        self.storage.save(data)

    def add_record(
        self,
        category: str,
        amount: Decimal,
        description: str,
        date: Optional[datetime] = None,
        tags: Optional[List[str]] = None
    ) -> FinancialRecord:
        """Add a new financial record.
        
        Args:
            category: Category of the record (must be 'income' or 'expense')
            amount: Amount of money
            description: Description of the transaction
            date: Date of transaction (defaults to now)
            tags: Optional list of tags
            
        Returns:
            The created FinancialRecord
            
        Raises:
            ValueError: If category is not 'income' or 'expense'
        """
        if category not in ('income', 'expense'):
            raise ValueError("Category must be 'income' or 'expense'")
        
        if date is None:
            date = datetime.now()
        
        record = FinancialRecord(
            record_id=str(uuid.uuid4()),
            category=category,
            amount=amount,
            description=description,
            date=date,
            tags=tags
        )
        
        self.records.append(record)
        self._save_records()
        return record

    def get_record(self, record_id: str) -> Optional[FinancialRecord]:
        """Get a record by ID.
        
        Args:
            record_id: The unique ID of the record
            
        Returns:
            The FinancialRecord if found, None otherwise
        """
        for record in self.records:
            if record.record_id == record_id:
                return record
        return None

    def list_records(
        self,
        category: Optional[str] = None,
        tag: Optional[str] = None
    ) -> List[FinancialRecord]:
        """List all records, optionally filtered.
        
        Args:
            category: Optional category filter
            tag: Optional tag filter
            
        Returns:
            List of matching FinancialRecords
        """
        filtered_records = self.records

        if category:
            filtered_records = [
                r for r in filtered_records if r.category == category
            ]

        if tag:
            filtered_records = [
                r for r in filtered_records if tag in r.tags
            ]

        return filtered_records

    def delete_record(self, record_id: str) -> bool:
        """Delete a record by ID.
        
        Args:
            record_id: The unique ID of the record to delete
            
        Returns:
            True if deleted, False if not found
        """
        for i, record in enumerate(self.records):
            if record.record_id == record_id:
                del self.records[i]
                self._save_records()
                return True
        return False

    def get_balance(self) -> Decimal:
        """Calculate total balance.
        
        Returns:
            Total balance (income - expenses)
        """
        balance = Decimal('0')
        for record in self.records:
            if record.category == 'income':
                balance += record.amount
            elif record.category == 'expense':
                balance -= record.amount
        return balance

    def get_total_by_category(self, category: str) -> Decimal:
        """Get total amount for a category.
        
        Args:
            category: Category to sum
            
        Returns:
            Total amount for category
        """
        total = Decimal('0')
        for record in self.records:
            if record.category == category:
                total += record.amount
        return total
