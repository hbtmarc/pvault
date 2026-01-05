# Personal Vault Finance Controller

A secure, encrypted application for managing personal financial records. Keep track of your income, expenses, and financial transactions with military-grade encryption.

## Features

- **🔒 Secure Encryption**: All financial data is encrypted using Fernet (AES-128) with password-based key derivation (PBKDF2)
- **💰 Financial Tracking**: Track income and expenses with categories, descriptions, and tags
- **📊 Balance Reports**: View your current balance and totals by category
- **🏷️ Flexible Tagging**: Organize records with custom tags
- **💾 Persistent Storage**: All data is securely saved to an encrypted vault file
- **🖥️ CLI Interface**: Easy-to-use command-line interface

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/hbtmarc/pvault.git
cd pvault

# Install dependencies
pip install -r requirements.txt

# Install the package
pip install -e .
```

## Usage

### Command-Line Interface

Run the CLI application:

```bash
pvault
```

Or directly with Python:

```bash
python -m pvault.cli
```

The CLI will prompt you for:
1. Vault path (default: `./vault_data/finance.vault`)
2. Password for encryption/decryption

### Main Menu Options

1. **Add Record**: Add a new income or expense record
2. **List Records**: View all records with optional filtering by category or tag
3. **View Balance**: See your current balance (income - expenses)
4. **Delete Record**: Remove a record by ID
5. **View Totals by Category**: See total income and expenses
6. **Exit**: Close the application

### Example Workflow

```
=== Personal Vault Finance Controller ===

Vault path (default: ./vault_data/finance.vault): 
Vault password: ****
Vault loaded successfully!

--- Main Menu ---
1. Add record
2. List records
3. View balance
4. Delete record
5. View totals by category
6. Exit

Choice: 1

--- Add Record ---
Category (income/expense): income
Amount: 5000
Description: Monthly salary
Tags (comma-separated, optional): salary, monthly
Record added with ID: a1b2c3d4-5678-90ef-ghij-klmnopqrstuv

Choice: 3

Current Balance: $5000
```

### Programmatic Usage

You can also use the library programmatically in your Python code:

```python
from decimal import Decimal
from pvault.controller import FinanceController

# Initialize the controller
controller = FinanceController("./my_vault.vault", "my-secure-password")

# Add income record
income = controller.add_record(
    category="income",
    amount=Decimal("5000.00"),
    description="Monthly salary",
    tags=["salary", "monthly"]
)

# Add expense record
expense = controller.add_record(
    category="expense",
    amount=Decimal("1500.00"),
    description="Rent payment",
    tags=["housing", "monthly"]
)

# Get current balance
balance = controller.get_balance()
print(f"Current balance: ${balance}")

# List all records
all_records = controller.list_records()

# Filter by category
expenses = controller.list_records(category="expense")

# Get totals
total_income = controller.get_total_by_category("income")
total_expenses = controller.get_total_by_category("expense")
```

## Development

### Setup Development Environment

```bash
# Install development dependencies
pip install -r requirements-dev.txt
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=pvault --cov-report=html

# Run specific test file
pytest tests/test_controller.py
```

### Running Tests with Verbose Output

```bash
pytest -v
```

## Security Features

- **Encryption**: Uses Fernet (symmetric encryption) with AES-128 in CBC mode
- **Key Derivation**: PBKDF2-HMAC-SHA256 with 100,000 iterations
- **Salt**: Unique salt per vault for key derivation
- **Password Protection**: All vault data requires password to decrypt
- **No Plain Text**: Financial data is never stored in plain text

## Data Storage

The vault stores encrypted financial records in a binary file. Each vault has:
- A `.vault` file containing encrypted data
- A `.salt` file containing the encryption salt

**Important**: Keep your password safe! If you lose your password, you cannot recover your data.

## Project Structure

```
pvault/
├── pvault/
│   ├── __init__.py
│   ├── cli.py          # Command-line interface
│   ├── controller.py   # Main finance controller
│   ├── models.py       # Data models
│   └── storage.py      # Secure encrypted storage
├── tests/
│   ├── test_controller.py
│   ├── test_models.py
│   └── test_storage.py
├── requirements.txt
├── requirements-dev.txt
├── pyproject.toml
└── README.md
```

## Requirements

- Python 3.8 or higher
- cryptography >= 42.0.0

## License

This project is provided as-is for personal use.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Security Notice

This application uses strong encryption to protect your financial data. However:
- Always use a strong, unique password
- Keep backups of your vault files
- Store your password securely (password manager recommended)
- This is a personal finance tool - for professional use, consult with financial advisors
