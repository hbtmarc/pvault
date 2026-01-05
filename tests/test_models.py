"""Tests for the FinancialRecord model."""

from datetime import datetime
from decimal import Decimal
import pytest

from pvault.models import FinancialRecord


def test_financial_record_creation():
    """Test creating a financial record."""
    record = FinancialRecord(
        record_id="test-123",
        category="income",
        amount=Decimal("100.50"),
        description="Test income",
        date=datetime(2026, 1, 1, 12, 0, 0),
        tags=["salary", "monthly"]
    )
    
    assert record.record_id == "test-123"
    assert record.category == "income"
    assert record.amount == Decimal("100.50")
    assert record.description == "Test income"
    assert record.date == datetime(2026, 1, 1, 12, 0, 0)
    assert record.tags == ["salary", "monthly"]


def test_financial_record_to_dict():
    """Test converting record to dictionary."""
    record = FinancialRecord(
        record_id="test-456",
        category="expense",
        amount=Decimal("50.25"),
        description="Test expense",
        date=datetime(2026, 1, 2, 14, 30, 0),
        tags=["food"]
    )
    
    data = record.to_dict()
    
    assert data["record_id"] == "test-456"
    assert data["category"] == "expense"
    assert data["amount"] == "50.25"
    assert data["description"] == "Test expense"
    assert data["date"] == "2026-01-02T14:30:00"
    assert data["tags"] == ["food"]


def test_financial_record_from_dict():
    """Test creating record from dictionary."""
    data = {
        "record_id": "test-789",
        "category": "income",
        "amount": "200.00",
        "description": "Test from dict",
        "date": "2026-01-03T10:00:00",
        "tags": ["bonus"]
    }
    
    record = FinancialRecord.from_dict(data)
    
    assert record.record_id == "test-789"
    assert record.category == "income"
    assert record.amount == Decimal("200.00")
    assert record.description == "Test from dict"
    assert record.date == datetime(2026, 1, 3, 10, 0, 0)
    assert record.tags == ["bonus"]


def test_financial_record_no_tags():
    """Test creating record without tags."""
    record = FinancialRecord(
        record_id="test-no-tags",
        category="expense",
        amount=Decimal("25.00"),
        description="No tags",
        date=datetime.now()
    )
    
    assert record.tags == []
