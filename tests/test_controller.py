"""Tests for the FinanceController."""

import tempfile
from datetime import datetime
from decimal import Decimal
from pathlib import Path
import pytest

from pvault.controller import FinanceController


@pytest.fixture
def controller():
    """Create a controller with temporary vault."""
    with tempfile.TemporaryDirectory() as tmpdir:
        vault_path = Path(tmpdir) / "test.vault"
        yield FinanceController(str(vault_path), "test-password")


def test_add_record(controller):
    """Test adding a financial record."""
    record = controller.add_record(
        category="income",
        amount=Decimal("1000.00"),
        description="Monthly salary"
    )
    
    assert record.record_id is not None
    assert record.category == "income"
    assert record.amount == Decimal("1000.00")
    assert record.description == "Monthly salary"
    assert len(controller.records) == 1


def test_add_record_with_tags(controller):
    """Test adding a record with tags."""
    record = controller.add_record(
        category="expense",
        amount=Decimal("50.00"),
        description="Groceries",
        tags=["food", "essential"]
    )
    
    assert record.tags == ["food", "essential"]


def test_get_record(controller):
    """Test getting a record by ID."""
    added_record = controller.add_record(
        category="income",
        amount=Decimal("500.00"),
        description="Bonus"
    )
    
    retrieved_record = controller.get_record(added_record.record_id)
    
    assert retrieved_record is not None
    assert retrieved_record.record_id == added_record.record_id
    assert retrieved_record.amount == Decimal("500.00")


def test_get_nonexistent_record(controller):
    """Test getting a record that doesn't exist."""
    record = controller.get_record("nonexistent-id")
    assert record is None


def test_list_records(controller):
    """Test listing all records."""
    controller.add_record("income", Decimal("100"), "Income 1")
    controller.add_record("expense", Decimal("50"), "Expense 1")
    controller.add_record("income", Decimal("200"), "Income 2")
    
    records = controller.list_records()
    assert len(records) == 3


def test_list_records_by_category(controller):
    """Test filtering records by category."""
    controller.add_record("income", Decimal("100"), "Income 1")
    controller.add_record("expense", Decimal("50"), "Expense 1")
    controller.add_record("income", Decimal("200"), "Income 2")
    
    income_records = controller.list_records(category="income")
    assert len(income_records) == 2
    
    expense_records = controller.list_records(category="expense")
    assert len(expense_records) == 1


def test_list_records_by_tag(controller):
    """Test filtering records by tag."""
    controller.add_record("income", Decimal("100"), "Income", tags=["salary"])
    controller.add_record("expense", Decimal("50"), "Expense", tags=["food"])
    controller.add_record("income", Decimal("200"), "Bonus", tags=["bonus", "salary"])
    
    salary_records = controller.list_records(tag="salary")
    assert len(salary_records) == 2


def test_delete_record(controller):
    """Test deleting a record."""
    record = controller.add_record("income", Decimal("100"), "Test")
    
    assert len(controller.records) == 1
    
    deleted = controller.delete_record(record.record_id)
    assert deleted is True
    assert len(controller.records) == 0


def test_delete_nonexistent_record(controller):
    """Test deleting a record that doesn't exist."""
    deleted = controller.delete_record("nonexistent-id")
    assert deleted is False


def test_get_balance(controller):
    """Test calculating balance."""
    controller.add_record("income", Decimal("1000.00"), "Salary")
    controller.add_record("expense", Decimal("200.00"), "Rent")
    controller.add_record("income", Decimal("500.00"), "Bonus")
    controller.add_record("expense", Decimal("100.00"), "Food")
    
    balance = controller.get_balance()
    assert balance == Decimal("1200.00")  # 1000 + 500 - 200 - 100


def test_get_total_by_category(controller):
    """Test getting total by category."""
    controller.add_record("income", Decimal("1000.00"), "Salary")
    controller.add_record("income", Decimal("500.00"), "Bonus")
    controller.add_record("expense", Decimal("200.00"), "Rent")
    
    income_total = controller.get_total_by_category("income")
    assert income_total == Decimal("1500.00")
    
    expense_total = controller.get_total_by_category("expense")
    assert expense_total == Decimal("200.00")


def test_persistence():
    """Test that records persist across controller instances."""
    with tempfile.TemporaryDirectory() as tmpdir:
        vault_path = Path(tmpdir) / "test.vault"
        password = "test-password"
        
        # Create controller and add records
        controller1 = FinanceController(str(vault_path), password)
        controller1.add_record("income", Decimal("1000.00"), "Test")
        
        # Create new controller with same vault
        controller2 = FinanceController(str(vault_path), password)
        
        assert len(controller2.records) == 1
        assert controller2.records[0].amount == Decimal("1000.00")
