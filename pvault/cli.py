"""Command-line interface for Personal Vault Finance Controller."""

import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
import getpass

from .controller import FinanceController


class CLI:
    """Command-line interface for the finance controller."""

    def __init__(self):
        self.controller = None
        self.vault_path = None

    def run(self):
        """Run the CLI application."""
        print("=== Personal Vault Finance Controller ===")
        print()
        
        # Get vault path and password
        self.vault_path = input("Vault path (default: ./vault_data/finance.vault): ").strip()
        if not self.vault_path:
            self.vault_path = "./vault_data/finance.vault"
        
        password = getpass.getpass("Vault password: ")
        if not password:
            print("Password is required!")
            return
        
        try:
            self.controller = FinanceController(self.vault_path, password)
            print("Vault loaded successfully!")
            print()
            self.main_menu()
        except Exception as e:
            print(f"Error: {e}")
            return

    def main_menu(self):
        """Display and handle main menu."""
        while True:
            print("\n--- Main Menu ---")
            print("1. Add record")
            print("2. List records")
            print("3. View balance")
            print("4. Delete record")
            print("5. View totals by category")
            print("6. Exit")
            
            choice = input("\nChoice: ").strip()
            
            if choice == "1":
                self.add_record()
            elif choice == "2":
                self.list_records()
            elif choice == "3":
                self.view_balance()
            elif choice == "4":
                self.delete_record()
            elif choice == "5":
                self.view_totals()
            elif choice == "6":
                print("Goodbye!")
                break
            else:
                print("Invalid choice!")

    def add_record(self):
        """Add a new financial record."""
        print("\n--- Add Record ---")
        
        category = input("Category (income/expense): ").strip().lower()
        if category not in ['income', 'expense']:
            print("Category must be 'income' or 'expense'")
            return
        
        amount_str = input("Amount: ").strip()
        try:
            amount = Decimal(amount_str)
            if amount <= 0:
                print("Amount must be positive")
                return
        except InvalidOperation:
            print("Invalid amount")
            return
        
        description = input("Description: ").strip()
        if not description:
            print("Description is required")
            return
        
        tags_input = input("Tags (comma-separated, optional): ").strip()
        tags = [t.strip() for t in tags_input.split(",") if t.strip()] if tags_input else []
        
        try:
            record = self.controller.add_record(
                category=category,
                amount=amount,
                description=description,
                tags=tags
            )
            print(f"Record added with ID: {record.record_id}")
        except ValueError as e:
            print(f"Error: {e}")

    def list_records(self):
        """List financial records."""
        print("\n--- List Records ---")
        
        category_filter = input("Filter by category (optional): ").strip().lower() or None
        tag_filter = input("Filter by tag (optional): ").strip() or None
        
        records = self.controller.list_records(category=category_filter, tag=tag_filter)
        
        if not records:
            print("No records found.")
            return
        
        print(f"\nFound {len(records)} record(s):")
        for record in records:
            print(f"\nID: {record.record_id}")
            print(f"  Category: {record.category}")
            print(f"  Amount: ${record.amount}")
            print(f"  Description: {record.description}")
            print(f"  Date: {record.date.strftime('%Y-%m-%d %H:%M:%S')}")
            if record.tags:
                print(f"  Tags: {', '.join(record.tags)}")

    def view_balance(self):
        """View current balance."""
        balance = self.controller.get_balance()
        print(f"\nCurrent Balance: ${balance}")

    def delete_record(self):
        """Delete a financial record."""
        print("\n--- Delete Record ---")
        
        record_id = input("Record ID: ").strip()
        if not record_id:
            print("Record ID is required")
            return
        
        if self.controller.delete_record(record_id):
            print("Record deleted successfully!")
        else:
            print("Record not found.")

    def view_totals(self):
        """View totals by category."""
        print("\n--- Totals by Category ---")
        
        income_total = self.controller.get_total_by_category('income')
        expense_total = self.controller.get_total_by_category('expense')
        
        print(f"Total Income: ${income_total}")
        print(f"Total Expenses: ${expense_total}")
        print(f"Net: ${income_total - expense_total}")


def main():
    """Main entry point for CLI."""
    cli = CLI()
    try:
        cli.run()
    except KeyboardInterrupt:
        print("\n\nInterrupted by user. Goodbye!")
        sys.exit(0)


if __name__ == "__main__":
    main()
