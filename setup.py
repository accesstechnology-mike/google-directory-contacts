#!/usr/bin/env python3
"""
Setup and verification script for Google Workspace Shared Contacts Manager
"""

import os
import sys
import json
import subprocess
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        return False
    print(f"✅ Python {sys.version.split()[0]} detected")
    return True

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import flask
        import google.auth
        import google.oauth2.service_account
        import requests
        print("✅ All required dependencies are installed")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Run: pip install -r requirements.txt")
        return False

def check_credentials_file():
    """Check if credentials.json exists and is valid"""
    if not os.path.exists('credentials.json'):
        print("❌ credentials.json file not found")
        print("Please download your service account key from Google Cloud Console")
        return False
    
    try:
        with open('credentials.json', 'r') as f:
            creds = json.load(f)
        
        required_fields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id']
        missing_fields = [field for field in required_fields if field not in creds]
        
        if missing_fields:
            print(f"❌ credentials.json is missing required fields: {missing_fields}")
            return False
        
        if creds.get('type') != 'service_account':
            print("❌ credentials.json is not a service account key")
            return False
        
        print("✅ credentials.json file is valid")
        return True
        
    except json.JSONDecodeError:
        print("❌ credentials.json is not valid JSON")
        return False
    except Exception as e:
        print(f"❌ Error reading credentials.json: {e}")
        return False

def check_env_file():
    """Check if .env file exists and has required variables"""
    if not os.path.exists('.env'):
        print("❌ .env file not found")
        print("Copy .env.example to .env and update with your values")
        return False
    
    required_vars = ['WORKSPACE_DOMAIN', 'SERVICE_ACCOUNT_FILE', 'ADMIN_EMAIL']
    
    with open('.env', 'r') as f:
        env_content = f.read()
    
    missing_vars = []
    for var in required_vars:
        if f"{var}=" not in env_content or f"{var}=your-" in env_content or f"{var}=example" in env_content:
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ .env file is missing or has placeholder values for: {missing_vars}")
        return False
    
    print("✅ .env file is configured")
    return True

def create_env_file():
    """Create .env file from template if it doesn't exist"""
    if not os.path.exists('.env') and os.path.exists('.env.example'):
        print("📝 Creating .env file from template...")
        import shutil
        shutil.copy('.env.example', '.env')
        print("✅ Created .env file. Please edit it with your values.")
        return True
    return False

def install_dependencies():
    """Install dependencies from requirements.txt"""
    try:
        print("📦 Installing dependencies...")
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
        print("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to install dependencies")
        return False

def main():
    """Main setup and verification function"""
    print("🚀 Google Workspace Shared Contacts Manager Setup")
    print("=" * 50)
    
    all_checks_passed = True
    
    # Check Python version
    if not check_python_version():
        all_checks_passed = False
    
    # Check if requirements.txt exists
    if not os.path.exists('requirements.txt'):
        print("❌ requirements.txt not found")
        all_checks_passed = False
    else:
        print("✅ requirements.txt found")
    
    # Offer to install dependencies
    if not check_dependencies():
        response = input("Would you like to install dependencies now? (y/n): ")
        if response.lower() == 'y':
            if install_dependencies():
                if not check_dependencies():
                    all_checks_passed = False
            else:
                all_checks_passed = False
        else:
            all_checks_passed = False
    
    # Create .env file if needed
    create_env_file()
    
    # Check environment configuration
    if not check_env_file():
        all_checks_passed = False
    
    # Check credentials file
    if not check_credentials_file():
        all_checks_passed = False
    
    print("\n" + "=" * 50)
    
    if all_checks_passed:
        print("🎉 Setup verification complete! All checks passed.")
        print("\nNext steps:")
        print("1. Ensure your Google Workspace admin settings are configured")
        print("2. Run the application: python app.py")
        print("3. Open http://localhost:5000 in your browser")
    else:
        print("❌ Setup verification failed. Please fix the issues above.")
        print("\nFor help, check the README.md file or:")
        print("- Google Cloud Console: https://console.cloud.google.com/")
        print("- Google Admin Console: https://admin.google.com/")
    
    return all_checks_passed

if __name__ == "__main__":
    main()