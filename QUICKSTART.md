# Quick Start Guide

## Installation

```bash
pip install -r requirements.txt
pip install -e .
```

## Running the Application

```bash
# Using the installed command
pvault

# Or using Python directly
python -m pvault.cli
```

## First Time Setup

1. Run `pvault`
2. Choose a vault path (or press Enter for default: `./vault_data/finance.vault`)
3. Create a strong password (remember this - it cannot be recovered!)
4. You'll see the main menu

## Common Operations

### Adding Income
1. Choose option 1 (Add record)
2. Category: `income`
3. Amount: e.g., `5000.00`
4. Description: e.g., `Monthly salary`
5. Tags (optional): e.g., `salary, monthly`

### Adding Expense
1. Choose option 1 (Add record)
2. Category: `expense`
3. Amount: e.g., `1200.00`
4. Description: e.g., `Rent payment`
5. Tags (optional): e.g., `housing, monthly`

### Viewing Balance
- Choose option 3 to see current balance (income - expenses)

### Listing Records
1. Choose option 2
2. Optionally filter by category (income/expense)
3. Optionally filter by tag

### Deleting Records
1. Choose option 4
2. Enter the record ID (shown when listing records)

## Security Tips

- Use a strong, unique password
- Store your password in a password manager
- Backup your vault files regularly
- Never share your vault password
- The vault files are encrypted - without the password, data cannot be recovered

## Programmatic Usage

```python
from decimal import Decimal
from pvault.controller import FinanceController

# Initialize
controller = FinanceController("./my_vault.vault", "my-password")

# Add records
controller.add_record("income", Decimal("5000.00"), "Salary", tags=["monthly"])
controller.add_record("expense", Decimal("1500.00"), "Rent", tags=["housing"])

# Get balance
balance = controller.get_balance()
print(f"Balance: ${balance}")

# List records
all_records = controller.list_records()
expenses = controller.list_records(category="expense")
food_expenses = controller.list_records(tag="food")

# Get totals
income_total = controller.get_total_by_category("income")
expense_total = controller.get_total_by_category("expense")
```
